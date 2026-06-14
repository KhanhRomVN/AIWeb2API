/**
 * Stats Service
 *
 * Thin wrapper around metrics.service that exposes stats-oriented functions
 * for the stats controller. `conversation_id` is accepted for API compatibility
 * but is not stored (the column was dropped from the metrics table).
 */
export {
  getModelStatsByPeriod,
} from './metrics.service';

// Re-export with additional accountId parameter
import { getAccountStatsByPeriod as _getAccountStatsByPeriod, getUsageHistory as _getUsageHistory } from './metrics.service';
export const getAccountStatsByPeriod = (
  period: 'day' | 'week' | 'month' | 'year',
  offset: number,
  accountId?: string,
) => _getAccountStatsByPeriod(period, offset, accountId);

export const getUsageHistory = (
  period: 'day' | 'week' | 'month' | 'year',
  offset: number,
  accountId?: string,
) => _getUsageHistory(period, offset, accountId);

import { recordSuccess as _recordSuccess } from './metrics.service';

/**
 * Records a successful request with token usage.
 * The `conversation_id` parameter is accepted for compatibility but not persisted.
 */
export async function recordSuccess(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  _conversationId?: string,
): Promise<void> {
  await _recordSuccess(accountId, providerId, modelId, tokens);
}
