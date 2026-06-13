/**
 * Stats Service
 *
 * Thin wrapper around metrics.service that exposes stats-oriented functions
 * for the stats controller. `conversation_id` is accepted for API compatibility
 * but is not stored (the column was dropped from the metrics table).
 */
export {
  getUsageHistory,
  getAccountStatsByPeriod,
  getModelStatsByPeriod,
} from './metrics.service';

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
