/**
 * ------------------------------------------------------------------
 * Database Schemas (Kysely)
 * ------------------------------------------------------------------
 * Định nghĩa type cho các bảng trong 2 databases:
 *
 * AccountsDatabase  → aiweb2api-accounts.sqlite  (chỉ bảng `accounts`)
 * MetricsDatabase   → metrics.sqlite             (model_stats + metrics)
 *
 * Lưu ý: SQLite lưu boolean dưới dạng INTEGER 0/1, nên các cột boolean
 * được khai báo là `number | null` để khớp cả 2 engine.
 * ------------------------------------------------------------------
 */

import type { Generated } from 'kysely';

// ─── accounts ───────────────────────────────────────────────────────────
export interface AccountsTable {
  id: string;
  provider_id: string;
  email: string;
  credential: string | null;
  usage: number | null;
  reset_usage_at: string | null;
  user_data_dir: string | null;
  last_used_at: number | null;
  auth_method: string | null;
}

// ─── model_stats ────────────────────────────────────────────────────────
export interface ModelStatsTable {
  provider_id: string;
  model_id: string;
  success_rate: number | null;
  updated_at: number;
}

// ─── metrics ────────────────────────────────────────────────────────────
export interface MetricsTable {
  id: Generated<number>;
  provider_id: string;
  model_id: string;
  account_id: string;
  status: string | null;
  total_tokens: number | null;
  timestamp: number;
}

// ─── Database roots ─────────────────────────────────────────────────────

/** Schema cho aiweb2api-accounts.sqlite */
export interface AccountsDatabase {
  accounts: AccountsTable;
}

/** Schema cho metrics.sqlite */
export interface MetricsDatabase {
  model_stats: ModelStatsTable;
  metrics: MetricsTable;
}

/**
 * Legacy union schema — giữ để tránh breaking change trong các file chưa migrate.
 * @deprecated Dùng AccountsDatabase hoặc MetricsDatabase riêng lẻ.
 */
export interface Database {
  accounts: AccountsTable;
  model_stats: ModelStatsTable;
  metrics: MetricsTable;
}
