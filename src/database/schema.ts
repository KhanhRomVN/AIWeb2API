/**
 * ------------------------------------------------------------------
 * Database Schema (Kysely)
 * ------------------------------------------------------------------
 * Định nghĩa type cho tất cả bảng trong database chính dưới dạng
 * interface mà Kysely dùng để type-check query. Phản ánh schema do
 * `migrations.ts` tạo ra (SQLite) — khi chạy trên Postgres, schema
 * tương đương được tạo bởi `migrations-postgres.ts`.
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
  is_memory_enabled: number | null;
  user_data_dir: string | null;
  last_used_at: number | null;
}

// ─── providers ──────────────────────────────────────────────────────────
export interface ProvidersTable {
  id: string;
  title: string;
  platform: string | null;
  connection_type: string | null;
  is_enabled: number | null;
  website_url: string | null;
  auth_method: string | null;
  is_pausable: number | null;
  is_memory: number | null;
  browser_extension_folder: string | null;
  description: string | null;
  color: string | null;
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

// ─── config ─────────────────────────────────────────────────────────────
export interface ConfigTable {
  id: number;
  chromium_profile_dir: string | null;
}

// ─── Database (root) ────────────────────────────────────────────────────
/** Interface root mà Kysely generic nhận — map tên bảng → type của nó. */
export interface Database {
  accounts: AccountsTable;
  providers: ProvidersTable;
  model_stats: ModelStatsTable;
  metrics: MetricsTable;
  config: ConfigTable;
}