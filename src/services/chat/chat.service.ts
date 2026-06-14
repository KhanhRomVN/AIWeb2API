/**
 * Chat Service (core)
 * Orchestrates sending a message through a provider,
 * recording metrics only (no persistence).
 */
import { isProviderEnabled } from '../provider.service';
import { createLogger } from '../../utils/logger';
import { providerRegistry } from '../../provider/registry';
import type { SendMessageOptions } from '../../types';
import { recordChatMetrics, recordError } from '../metrics.service';

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
    onContent,
    onDone,
    onSessionCreated,
    accountId,
  } = options;

  if (!(await isProviderEnabled(provider_id))) {
    const error = new Error(`Provider ${provider_id} is disabled`);
    // Record error metric before throwing
    recordError(accountId, provider_id, options.model || 'unknown', error.message);
    throw error;
  }

  const provider = providerRegistry.getProvider(provider_id);
  if (!provider) {
    const error = new Error(`Provider ${provider_id} not supported for sending messages`);
    recordError(accountId, provider_id, options.model || 'unknown', error.message);
    throw error;
  }

  let accumulatedAssistantContent = '';

  logger.info(`sendMessage — provider: ${provider_id}`);

  const wrappedOptions: SendMessageOptions = {
    ...options,
    onContent: (content: string) => {
      accumulatedAssistantContent += content;
      if (onContent) onContent(content);
    },
    onSessionCreated: (sessionId: string) => {
      if (onSessionCreated) onSessionCreated(sessionId);
    },
    onDone: () => {
      if (!accumulatedAssistantContent) {
        logger.warn(
          `[sendMessage] Provider ${provider_id} completed with empty content`,
        );
      }

      recordChatMetrics(
        accountId,
        provider_id,
        options.model || 'unknown',
        messages,
        accumulatedAssistantContent,
      );

      if (onDone) onDone();
    },
  };

  try {
    return await provider.handleMessage(wrappedOptions);
  } catch (error) {
    // Record error metric for any unhandled errors from provider
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordError(accountId, provider_id, options.model || 'unknown', errorMessage);
    throw error;
  }
};
