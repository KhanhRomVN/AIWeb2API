import { isProviderEnabled } from './provider.service';
import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import type { SendMessageOptions } from '../provider/types';
import { getDb } from './db';
import crypto from 'crypto';
import { countMessagesTokens, countTokens } from '../utils/tokenizer';
import { recordSuccess } from './stats.service';

const logger = createLogger('ChatService');

// Lock mechanism to prevent concurrent conversation creation for the same account
// Key: `${accountId}:${provider_id}` (or just accountId if provider_id not available)
// Value: Promise that resolves to the real conversation ID from provider
const pendingConversations = new Map<string, Promise<string>>();

interface ConversationOptions {
  credential: string;
  provider_id: string;
  limit?: number;
  page?: number;
}

interface ConversationDetailOptions {
  credential: string;
  provider_id: string;
  conversationId: string;
}

export type { SendMessageOptions };

// Helper function to make HTTPS requests
// Helper function to make HTTPS requests - Removed as it's no longer used

// Main service functions

export const sendMessage = async (
  options: SendMessageOptions,
): Promise<void> => {
  const {
    provider_id,
    messages,
    conversationId,
    parent_message_id,
    onContent,
    onDone,
    onSessionCreated,
    accountId,
  } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  // Try dynamic registry first
  const provider = providerRegistry.getProvider(provider_id);
  if (!provider) {
    throw new Error(
      `Provider ${provider_id} not supported for sending messages`,
    );
  }

  // Determine lock key for pending conversation
  // Use accountId + provider_id to isolate per-account-per-provider
  // If no accountId, fallback to provider_id only (less safe but handles anonymous)
  const lockKey = accountId ? `${accountId}:${provider_id}` : provider_id;

  // Shared context object used by both setup logic and wrappedOptions callbacks
  // to avoid forward-reference issues with wrappedOptions itself.
  const pendingCtx: {
    resolveConversation: ((id: string) => void) | null;
    lockKey: string | null;
  } = { resolveConversation: null, lockKey: null };

  let activeConversationId: string;
  let isNewConversation = !conversationId;

  if (isNewConversation) {
    // Check if there's already a pending conversation creation for this account+provider
    const pendingPromise = pendingConversations.get(lockKey);
    if (pendingPromise) {
      logger.info(
        `[ChatService] Waiting for pending conversation creation for ${lockKey}`,
      );
      activeConversationId = await pendingPromise;
      isNewConversation = false; // We're reusing an existing conversation, not creating a new one
      logger.info(
        `[ChatService] Reusing conversation ${activeConversationId} from pending promise`,
      );
    } else {
      // Create a temporary ID and a promise that will be resolved when provider returns real ID
      const tempId = crypto.randomUUID();
      activeConversationId = tempId;

      // Create a promise that will be resolved by onSessionCreated callback
      const conversationPromise = new Promise<string>((resolve) => {
        pendingCtx.resolveConversation = resolve;
      });
      pendingCtx.lockKey = lockKey;
      pendingConversations.set(lockKey, conversationPromise);

      logger.info(
        `[ChatService] Created pending conversation promise for ${lockKey} with tempId ${tempId}`,
      );
    }
  } else {
    // conversationId is defined here because isNewConversation is false only when conversationId is truthy
    activeConversationId = conversationId!;
  }

  let accumulatedAssistantContent = '';

  // Helper to save messages
  const saveMessage = (role: string, content: string) => {
    if (!activeConversationId) return;
    const db = getDb();
    const timestamp = Date.now();

    try {
      // Ensure conversation exists
      db.prepare(
        `INSERT OR IGNORE INTO local_conversations (id, provider_id, account_id, title, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        activeConversationId,
        provider_id,
        accountId || 'anonymous',
        messages[messages.length - 1]?.content.substring(0, 50) || 'New Chat',
        timestamp,
        timestamp,
      );

      // Save message
      db.prepare(
        `INSERT INTO local_messages (id, conversation_id, role, content, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        crypto.randomUUID(),
        activeConversationId,
        role,
        content,
        timestamp,
      );

      // Update timestamp
      db.prepare(
        'UPDATE local_conversations SET updated_at = ? WHERE id = ?',
      ).run(timestamp, activeConversationId);
    } catch (e) {
      logger.error(`Failed to save ${role} message`, e);
    }
  };

  logger.info(
    `sendMessage — provider: ${provider_id}, session: ${activeConversationId}`,
  );

  // 1. Save User Message immediately
  if (activeConversationId) {
    saveMessage('user', messages[messages.length - 1]?.content || '');
  }

  // If this is a new session (no conversationId provided), notify caller of the chosen ID
  if (!conversationId && onSessionCreated) {
    onSessionCreated(activeConversationId);
  }

  // 2. Wrap callbacks for persistence
  const wrappedOptions: SendMessageOptions = {
    ...options,
    onContent: (content) => {
      accumulatedAssistantContent += content;
      if (onContent) onContent(content);
    },
    onSessionCreated: (sessionId) => {
      const oldId = activeConversationId;
      activeConversationId = sessionId;

      // Resolve pending conversation promise if this is a new conversation
      if (isNewConversation) {
        const { resolveConversation: resolveConv, lockKey: lockKeyFromCtx } =
          pendingCtx;
        if (resolveConv && lockKeyFromCtx) {
          logger.info(
            `[ChatService] Resolving pending conversation promise for ${lockKeyFromCtx} with real ID ${sessionId}`,
          );
          resolveConv(sessionId);
          // Clean up
          pendingCtx.resolveConversation = null;
          pendingCtx.lockKey = null;
          // Remove from map shortly after resolving
          setTimeout(() => {
            pendingConversations.delete(lockKeyFromCtx);
          }, 100);
        }
      }

      if (oldId && oldId !== sessionId) {
        const db = getDb();
        try {
          db.transaction(() => {
            // 1. Copy old conversation to new ID if it doesn't exist
            const oldConv = db
              .prepare('SELECT * FROM local_conversations WHERE id = ?')
              .get(oldId) as any;
            if (oldConv) {
              db.prepare(
                `INSERT OR IGNORE INTO local_conversations (id, provider_id, account_id, title, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
              ).run(
                sessionId,
                oldConv.provider_id,
                oldConv.account_id,
                oldConv.title,
                oldConv.created_at,
                oldConv.updated_at,
              );
            }

            // 2. Update messages to point to new ID
            db.prepare(
              'UPDATE local_messages SET conversation_id = ? WHERE conversation_id = ?',
            ).run(sessionId, oldId);

            // 3. Delete old conversation
            db.prepare('DELETE FROM local_conversations WHERE id = ?').run(
              oldId,
            );
          })();
        } catch (e) {
          logger.warn('Failed to migrate session', e);
        }
      }

      if (onSessionCreated) onSessionCreated(sessionId);
    },
    onDone: () => {
      // Clean up pending conversation map entry if it still exists (error case where onSessionCreated never called)
      if (isNewConversation) {
        const lockKeyFromCtx = pendingCtx.lockKey;
        if (lockKeyFromCtx && pendingConversations.has(lockKeyFromCtx)) {
          logger.warn(
            `[ChatService] Cleaning up stale pending conversation for ${lockKeyFromCtx} (onDone without onSessionCreated)`,
          );
          pendingConversations.delete(lockKeyFromCtx);
        }
        // Clean up resolve function references
        pendingCtx.resolveConversation = null;
        pendingCtx.lockKey = null;
      }

      // 3. Save Assistant Message on completion
      if (activeConversationId && accumulatedAssistantContent) {
        saveMessage('assistant', accumulatedAssistantContent);
      }

      if (!accumulatedAssistantContent) {
        logger.warn(
          `[sendMessage] Provider ${provider_id} completed with empty content (session: ${activeConversationId})`,
        );
      }

      // Calculate tokens for request and response
      const requestTokens = countMessagesTokens(messages);
      const responseTokens = countTokens(accumulatedAssistantContent);
      const totalTokens = requestTokens + responseTokens;

      // Auto-save metrics
      recordSuccess(
        accountId || 'anonymous',
        provider_id,
        options.model || 'unknown',
        totalTokens,
        activeConversationId,
      );

      // Refresh account usage in background if accountId is present
      if (accountId) {
        const { accountRefreshService } = require('./account-refresh.service');
        accountRefreshService.refreshUsage(accountId).catch((err: any) => {
          logger.warn(
            `Failed to refresh usage for account ${accountId}: ${err.message}`,
          );
        });
      }

      if (onDone) onDone();
    },
  };

  return await provider.handleMessage(wrappedOptions);
};
