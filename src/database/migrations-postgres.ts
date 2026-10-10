/**
 * ------------------------------------------------------------------
 * Postgres Migrations
 * ------------------------------------------------------------------
 * Tạo/cập nhật schema cho database Postgres do user cấu hình qua
 * Database Manager (type = 'connection', db_type = 'postgres').
 *
 * Chiến lược: ADDITIVE ONLY.
 * - `CREATE TABLE IF NOT EXISTS` cho từng bảng.
 * - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` cho từng cột (phòng
 *   bảng cũ thiếu cột).
 * - KHÔNG drop/alter kiểu cột → tránh mất dữ liệu trên DB remote.
 * - Sau khi chạy, verify lại danh sách cột; nếu thiếu cột nào so với
 *   schema mong đợi thì log WARN (user cần xử lý thủ công).
 *
 * Đối chiếu với `schema.ts` (Kysely) và `migrations.ts` (SQLite).
 *
 * Main functions:
 * - runPostgresMigrations() : Chạy toàn bộ migration Postgres (idempotent)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { sql, type Kysely } from 'kysely';

// ── Database ──
import type { Database as DbSchema } from './schema';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('PostgresMigrations');

/**
 * Danh sách cột mong đợi cho từng bảng — dùng cho bước verify sau
 * khi chạy migration. Nếu cột nào không tồn tại sau khi ADD COLUMN
 * (VD: bị đổi tên kiểu khác), ta log WARN để user biết.
 */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  accounts: [
    'id',
    'provider_id',
    'email',
    'credential',
    'usage',
    'reset_usage_at',
    'user_data_dir',
    'last_used_at',
    'auth_method',
  ],
  model_stats: ['provider_id', 'model_id', 'success_rate', 'updated_at'],
  metrics: [
    'id',
    'provider_id',
    'model_id',
    'account_id',
    'status',
    'total_tokens',
    'timestamp',
  ],
};

/**
 * Các câu lệnh migration, chạy tuần tự. Mỗi phần tử là 1 statement
 * độc lập (pg prepared statement không hỗ trợ multi-statement).
 */
const MIGRATION_STATEMENTS: string[] = [
  // ── accounts ──
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    email TEXT NOT NULL,
    credential TEXT,
    usage DOUBLE PRECISION,
    reset_usage_at TEXT,
    user_data_dir TEXT,
    last_used_at BIGINT,
    auth_method TEXT
  )`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provider_id TEXT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email TEXT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credential TEXT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS usage DOUBLE PRECISION`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reset_usage_at TEXT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_data_dir TEXT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_used_at BIGINT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auth_method TEXT`,

  // NOTE: bảng providers đã bị loại bỏ — metadata lấy từ provider registry.
  // Nếu bảng đã tồn tại trong DB cũ, để nguyên (không drop để tránh mất data lịch sử).

  // ── model_stats ──
  `CREATE TABLE IF NOT EXISTS model_stats (
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    success_rate DOUBLE PRECISION DEFAULT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (provider_id, model_id)
  )`,
  `ALTER TABLE model_stats ADD COLUMN IF NOT EXISTS success_rate DOUBLE PRECISION DEFAULT NULL`,
  `ALTER TABLE model_stats ADD COLUMN IF NOT EXISTS updated_at BIGINT`,

  // ── metrics ──
  `CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    status TEXT DEFAULT 'success',
    total_tokens INTEGER DEFAULT 0,
    timestamp BIGINT NOT NULL
  )`,
  `ALTER TABLE metrics ADD COLUMN IF NOT EXISTS provider_id TEXT`,
  `ALTER TABLE metrics ADD COLUMN IF NOT EXISTS model_id TEXT`,
  `ALTER TABLE metrics ADD COLUMN IF NOT EXISTS account_id TEXT`,
  `ALTER TABLE metrics ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success'`,
  `ALTER TABLE metrics ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0`,
  `ALTER TABLE metrics ADD COLUMN IF NOT EXISTS timestamp BIGINT`,
  // Migrate existing INTEGER columns to BIGINT (idempotent — no-op if already BIGINT)
  `DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='metrics' AND column_name='timestamp' AND table_schema=current_schema()) = 'integer' THEN ALTER TABLE metrics ALTER COLUMN timestamp TYPE BIGINT; END IF; END $$`,
  `CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_metrics_account_time ON metrics(account_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_metrics_provider_model_time ON metrics(provider_id, model_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status)`,
];

// ─── Functions ──────────────────────────────────────────────────────────

/**
 * Kiểm tra các cột mong đợi có tồn tại trong DB hay không; log WARN
 * cho những cột bị thiếu (mismatch nghiêm trọng cần user xử lý tay).
 */
const verifyColumns = async (db: Kysely<DbSchema>): Promise<void> => {
  const result = await sql<{ table_name: string; column_name: string }>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('accounts','providers','model_stats','metrics')
  `.execute(db);

  const actual = new Map<string, Set<string>>();
  for (const row of result.rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
    actual.get(row.table_name)!.add(row.column_name);
  }

  for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
    const cols = actual.get(table);
    if (!cols) {
      logger.warn(`Table "${table}" is missing after migration.`);
      continue;
    }
    const missing = expected.filter((c) => !cols.has(c));
    if (missing.length > 0) {
      logger.warn(
        `Table "${table}" is missing expected column(s): ${missing.join(', ')}. ` +
          `Schema mismatch — please inspect manually.`,
      );
    }
  }
};

/**
 * Chạy toàn bộ migration Postgres theo chiến lược additive-only.
 * Idempotent — gọi nhiều lần không gây lỗi và không mất dữ liệu.
 */
export const runPostgresMigrations = async (
  db: Kysely<DbSchema>,
): Promise<void> => {
  for (const stmt of MIGRATION_STATEMENTS) {
    await sql.raw(stmt).execute(db);
  }
  await verifyColumns(db);
};
