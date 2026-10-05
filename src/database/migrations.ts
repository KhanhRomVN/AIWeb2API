/**
 * ------------------------------------------------------------------
 * Database Migrations (accounts DB)
 * ------------------------------------------------------------------
 * Quản lý schema và migrations cho `aiweb2api-accounts.sqlite`.
 * Chỉ chứa bảng `accounts` — metrics đã chuyển sang `metrics.sqlite`.
 *
 * Main functions:
 * - runMigrations() : Chạy toàn bộ migrations theo thứ tự
 *
 * Migration functions:
 * - migrateAccounts()        : Tạo/migrate bảng accounts
 * - migrateBrowserSessions() : Tích hợp browser sessions vào accounts
 * - dropUnusedTables()       : Xóa các bảng không còn sử dụng
 *
 * NOTE: Bảng `providers` và `models` đã bị loại bỏ — xem data-storage.md
 * NOTE: Bảng `model_stats` và `metrics` đã chuyển sang metrics.sqlite
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');

export const runMigrations = (db: Database.Database): void => {
  migrateAccounts(db);
  migrateBrowserSessions(db);
  dropUnusedTables(db);
};
// ─── Accounts Table ──────────────────────────────────────────────────

function migrateAccounts(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        email TEXT NOT NULL,
        credential TEXT NOT NULL,
        usage REAL, 
        reset_usage_at TEXT
      )
    `);

    const accountInfo = db.pragma('table_info(accounts)') as any[];
    const cols = accountInfo.map((c) => c.name);

    // Migration: Remove year_tokens / total_requests columns
    if (cols.includes('year_tokens') || cols.includes('total_requests')) {
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS accounts_new (
            id TEXT PRIMARY KEY,
            provider_id TEXT NOT NULL,
            email TEXT NOT NULL,
            credential TEXT NOT NULL
          )
        `);
        db.exec(`
          INSERT INTO accounts_new (id, provider_id, email, credential)
          SELECT id, provider_id, email, credential FROM accounts
        `);
        db.exec('DROP TABLE accounts');
        db.exec('ALTER TABLE accounts_new RENAME TO accounts');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        logger.error('Failed to migrate accounts table', e);
        throw e;
      }
    }

    // Re-read columns after potential migration
    const finalCols = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );

    // Migration: drop last_refreshed_at column if it still exists in older DBs
    if (finalCols.includes('last_refreshed_at')) {
      try {
        db.exec('ALTER TABLE accounts DROP COLUMN last_refreshed_at');
      } catch (e) {
        logger.warn('Failed to drop last_refreshed_at from accounts', e);
      }
    }
    if (!finalCols.includes('usage')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN usage REAL');
      } catch (e) {
        logger.warn('Failed to add usage to accounts', e);
      }
    }
    if (!finalCols.includes('reset_usage_at')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN reset_usage_at TEXT');
      } catch (e) {
        logger.warn('Failed to add reset_usage_at to accounts', e);
      }
    }
    // Migration: add last_used_at (ms timestamp of last send)
    const colsAfterResetUsage = (
      db.pragma('table_info(accounts)') as any[]
    ).map((c) => c.name);
    if (!colsAfterResetUsage.includes('last_used_at')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN last_used_at INTEGER');
      } catch (e) {
        logger.warn('Failed to add last_used_at to accounts', e);
      }
    }

    // Migration: add auth_method (e.g. 'google', 'github', 'apple')
    const colsAfterLastUsed = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );
    if (!colsAfterLastUsed.includes('auth_method')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN auth_method TEXT');
      } catch (e) {
        logger.warn('Failed to add auth_method to accounts', e);
      }
    }

    // Migration: Rename provider → provider_id
    const updatedCols = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );
    if (
      updatedCols.includes('provider') &&
      !updatedCols.includes('provider_id')
    ) {
      try {
        db.exec('ALTER TABLE accounts RENAME COLUMN provider to provider_id');
      } catch (e) {
        logger.warn('Failed to rename provider to provider_id');
      }
    }
  } catch (err) {
    logger.error('Error initializing accounts table', err);
    throw err;
  }
}

// ─── Model Stats Table ────────────────────────────────────────────────
// (Đã chuyển sang metrics.sqlite — xem src/database/metrics-db.ts)

// ─── Metrics Table ────────────────────────────────────────────────────
// (Đã chuyển sang metrics.sqlite — xem src/database/metrics-db.ts)

// ─── Browser Sessions Migration ─────────────────────────────────────

function migrateBrowserSessions(db: Database.Database): void {
  try {
    // First, add user_data_dir column to accounts table if not exists
    const accountCols = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );
    if (!accountCols.includes('user_data_dir')) {
      db.exec('ALTER TABLE accounts ADD COLUMN user_data_dir TEXT');
    }

    const hasCredentialNotNull = (
      db.pragma('table_info(accounts)') as any[]
    ).find((c) => c.name === 'credential' && c.notnull === 1);

    if (hasCredentialNotNull) {
      // Backup existing data
      interface AccountRow {
        id: string;
        provider_id: string;
        email: string;
        credential: string | null;
        usage: number | null;
        reset_usage_at: string | null;
        user_data_dir: string | null;
        last_used_at: number | null;
      }
      const accountsData = db
        .prepare('SELECT * FROM accounts')
        .all() as AccountRow[];

      // Drop old table
      db.exec('DROP TABLE accounts');

      // Recreate with nullable credential
      db.exec(`
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL,
          email TEXT NOT NULL,
          credential TEXT,
          usage REAL,
          reset_usage_at TEXT,
          user_data_dir TEXT,
          last_used_at INTEGER
        )`);
      // Restore data
      const insertStmt = db.prepare(`
        INSERT INTO accounts (id, provider_id, email, credential, usage, reset_usage_at, user_data_dir, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of accountsData) {
        insertStmt.run(
          row.id,
          row.provider_id,
          row.email,
          row.credential,
          row.usage,
          row.reset_usage_at,
          row.user_data_dir,
          row.last_used_at ?? null,
        );
      }
    }

    // Drop old browser_sessions table
    db.exec('DROP TABLE IF EXISTS browser_sessions');
  } catch (err) {
    logger.error('Error migrating browser sessions into accounts', err);
  }
}

// ─── Drop Unused Tables ─────────────────────────────────────────────

function dropUnusedTables(db: Database.Database): void {
  try {
    db.exec('DROP TABLE IF EXISTS models_performance');
    db.exec('DROP TABLE IF EXISTS conversation_stats');
    db.exec('DROP TABLE IF EXISTS extended_tools');
    db.exec('DROP TABLE IF EXISTS accounts_stats');
    db.exec('DROP TABLE IF EXISTS providers_stats');
    db.exec('DROP TABLE IF EXISTS commands');
    db.exec('DROP TABLE IF EXISTS local_conversations');
    db.exec('DROP TABLE IF EXISTS local_messages');
    db.exec('DROP TABLE IF EXISTS provider_models');
    db.exec('DROP TABLE IF EXISTS provider_models_sync');
    // Migration: models table replaced by model_stats
    db.exec('DROP TABLE IF EXISTS models');
    // Migration: providers table không còn cần thiết — metadata lấy từ registry
    db.exec('DROP TABLE IF EXISTS providers');
    // Migration: model_stats và metrics đã chuyển sang metrics.sqlite
    db.exec('DROP TABLE IF EXISTS model_stats');
    db.exec('DROP INDEX IF EXISTS idx_metrics_timestamp');
    db.exec('DROP INDEX IF EXISTS idx_metrics_account_time');
    db.exec('DROP INDEX IF EXISTS idx_metrics_provider_model_time');
    db.exec('DROP INDEX IF EXISTS idx_metrics_status');
    db.exec('DROP TABLE IF EXISTS metrics');
    // Remove conversation_id column from metrics if exists (legacy — table đã drop ở trên)
  } catch (e) {
    logger.warn('Failed to drop unused tables or migrate columns', e);
  }
}
