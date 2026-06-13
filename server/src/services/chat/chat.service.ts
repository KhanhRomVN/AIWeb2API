/**
 * Chat Service (core)
 * Orchestrates sending a message through a provider,
 * persisting conversation/messages, and recording metrics.
 */
import { isProviderEnabled } from '../provider.service';
import { createLogger } from '../../utils/logger';
import { providerRegistry } from '../../provider/registry';
import type { SendMessageOptions } from '../../types';
import crypto from 'crypto';
import { saveMessage, migrateConversationId } from './chat-persistence.service';
import { recordChatMetrics } from './chat-metrics.service';

export type { SendMessageOptions };

const logger = createLogger('ChatService');

// ---------------------------------------------------------------------------
// Lock mechanism: prevents concurrent conversation creation for the same account
// ---------------------------------------------------------------------------
const pendingConversations = new Map<string, Promise<string>>();

export const sendMessage = async (options: SendMessageOptions): Promise<void> => {
  const {
    provider_id,
    messages,
    conversationId,
    onContent,
    onDone,
    onSessionCreated,
    accountId,
  } = options;

  if (!(await isProviderEnabled(provider_id))) {
    throw new Error(`Provider ${provider_id} is disabled`);
  }

  const provider = providerRegistry.getProvider(provider_id);
  if (!provider) {
    throw new Error(`Provider ${provider_id} not supported for sending messages`);
  }

  const lockKey = accountId ? `${accountId}:${provider_id}` : provider_id;

  const pendingCtx: {
    resolveConversation: ((id: string) => void) | null;
    lockKey: string | null;
  } = { resolveConversation: null, lockKey: null };

  let activeConversationId: string;
  let isNewConversation = !conversationId;

  if (isNewConversation) {
    const pendingPromise = pendingConversations.get(lockKey);
    if (pendingPromise) {
      logger.info(`[ChatService] Waiting for pending conversation for ${lockKey}`);
      activeConversationId = await pendingPromise;
      isNewConversation = false;
      logger.info(`[ChatService] Reusing conversation ${activeConversationId}`);
    } else {
      activeConversationId = crypto.randomUUID();

      const conversationPromise = new Promise<string>((resolve) => {
        pendingCtx.resolveConversation = resolve;
      });
      pendingCtx.lockKey = lockKey;
      pendingConversations.set(lockKey, conversationPromise);

      logger.info(
        `[ChatService] Created pending conversation for ${lockKey} with tempId ${activeConversationId}`,
      );
    }
  } else {
    activeConversationId = conversationId!;
  }

  let accumulatedAssistantContent = '';

  logger.info(
    `sendMessage — provider: ${provider_id}, session: ${activeConversationId}`,
  );

  // Save user message immediately
  if (activeConversationId) {
    saveMessage(
      activeConversationId,
      provider_id,
      accountId || 'anonymous',
      messages,
      'user',
      messages[messages.length - 1]?.content || '',
    );
  }

  // Notify caller of the tentative conversation ID for new sessions
  if (!conversationId && onSessionCreated) {
    onSessionCreated(activeConversationId);
  }

  const wrappedOptions: SendMessageOptions = {
    ...options,
    onContent: (content: string) => {
      accumulatedAssistantContent += content;
      if (onContent) onContent(content);
    },
    onSessionCreated: (sessionId: string) => {
      const oldId = activeConversationId;
      activeConversationId = sessionId;

      if (isNewConversation) {
        const { resolveConversation: resolveConv, lockKey: lockKeyFromCtx } = pendingCtx;
        if (resolveConv && lockKeyFromCtx) {
          logger.info(
            `[ChatService] Resolving pending conversation for ${lockKeyFromCtx} → ${sessionId}`,
          );
          resolveConv(sessionId);
          pendingCtx.resolveConversation = null;
          pendingCtx.lockKey = null;
          setTimeout(() => pendingConversations.delete(lockKeyFromCtx), 100);
        }
      }

      if (oldId && oldId !== sessionId) {
        migrateConversationId(oldId, sessionId);
      }

      if (onSessionCreated) onSessionCreated(sessionId);
    },
    onDone: () => {
      // Clean up stale pending conversation entry if onSessionCreated was never called
      if (isNewConversation) {
        const lockKeyFromCtx = pendingCtx.lockKey;
        if (lockKeyFromCtx && pendingConversations.has(lockKeyFromCtx)) {
          logger.warn(
            `[ChatService] Cleaning up stale pending conversation for ${lockKeyFromCtx}`,
          );
          pendingConversations.delete(lockKeyFromCtx);
        }
        pendingCtx.resolveConversation = null;
        pendingCtx.lockKey = null;
      }

      if (activeConversationId && accumulatedAssistantContent) {
        saveMessage(
          activeConversationId,
          provider_id,
          accountId || 'anonymous',
          messages,
          'assistant',
          accumulatedAssistantContent,
        );
      }

      if (!accumulatedAssistantContent) {
        logger.warn(
          `[sendMessage] Provider ${provider_id} completed with empty content (session: ${activeConversationId})`,
        );
      }

      recordChatMetrics(
        accountId,
        provider_id,
        options.model || 'unknown',
        messages,
        accumulatedAssistantContent,
        activeConversationId,
      );

      if (onDone) onDone();
    },
  };

  return await provider.handleMessage(wrappedOptions);
};
