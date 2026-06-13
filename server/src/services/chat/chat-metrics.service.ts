/**
 * Chat Metrics Service
 * Handles token counting, stats recording, and account usage refresh
 * triggered at the end of each successful chat response.
 */
import { createLogger } from '../../utils/logger';
import { countMessagesTokens, countTokens } from '../../utils/tokenizer';
import { recordSuccess } from '../stats.service';

const logger = createLogger('ChatMetricsService');

/**
 * Records token usage and triggers an account usage refresh.
 */
export function recordChatMetrics(
  accountId: string | undefined,
  providerId: string,
  model: string,
  messages: any[],
  accumulatedAssistantContent: string,
  activeConversationId: string,
): void {
  const requestTokens = countMessagesTokens(messages);
  const responseTokens = countTokens(accumulatedAssistantContent);
  const totalTokens = requestTokens + responseTokens;

  recordSuccess(
    accountId || 'anonymous',
    providerId,
    model || 'unknown',
    totalTokens,
    activeConversationId,
  );

  if (accountId) {
    // Refresh account usage in background — non-blocking
    const { accountRefreshService } = require('../account-refresh.service');
    accountRefreshService.refreshUsage(accountId).catch((err: any) => {
      logger.warn(`Failed to refresh usage for account ${accountId}: ${err.message}`);
    });
  }
}
