/**
 * ------------------------------------------------------------------
 * Database Migrations
 * ------------------------------------------------------------------
 * Quản lý schema và migrations cho database SQLite. Tự động tạo bảng,
 * thêm/sửa column, và thực hiện các migration khi cần.
 *
 * Main functions:
 * - runMigrations() : Chạy toàn bộ migrations theo thứ tự
 *
 * Migration functions:
 * - migrateAccounts()          : Tạo/migrate bảng accounts
 * - migrateProviders()         : Tạo/migrate bảng providers
 * - migrateModels()            : Tạo/migrate bảng models
 * - migrateMetrics()           : Tạo/migrate bảng metrics
 * - migrateBrowserSessions()   : Tích hợp browser sessions vào accounts
 * - dropUnusedTables()         : Xóa các bảng không còn sử dụng
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');

export const runMigrations = (db: Database.Database): void => {
  migrateAccounts(db);
  migrateProviders(db);
  migrateModelStats(db);
  migrateMetrics(db);
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
        reset_usage_at TEXT,
        is_memory_enabled INTEGER DEFAULT 0
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
    // Migration: rename reset_period → reset_usage_at (drop old column via table rebuild not needed,
    // SQLite doesn't support DROP COLUMN easily — just leave reset_period as dead column if exists)
    if (!finalCols.includes('is_memory_enabled')) {
      try {
        db.exec(
          'ALTER TABLE accounts ADD COLUMN is_memory_enabled INTEGER DEFAULT 0',
        );
      } catch (e) {
        logger.warn('Failed to add is_memory_enabled to accounts', e);
      }
    }

    // Migration: add last_used_at (ms timestamp of last send)
    const colsAfterMemory = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );
    if (!colsAfterMemory.includes('last_used_at')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN last_used_at INTEGER');
      } catch (e) {
        logger.warn('Failed to add last_used_at to accounts', e);
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

// ─── Providers Table ──────────────────────────────────────────────────

function migrateProviders(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        platform TEXT DEFAULT 'web',
        connection_type TEXT DEFAULT 'https',
        is_enabled INTEGER DEFAULT 1,
        website_url TEXT,
        auth_method TEXT,
        is_pausable INTEGER DEFAULT 0,
        is_memory INTEGER DEFAULT 0
      )
    `);

    const providerCols = (db.pragma('table_info(providers)') as any[]).map(
      (c) => c.name,
    );

    // Migration for existing databases: add platform column if missing
    if (!providerCols.includes('platform')) {
      try {
        db.exec("ALTER TABLE providers ADD COLUMN platform TEXT DEFAULT 'web'");
      } catch (e) {
        logger.warn('Failed to add platform column to providers', e);
      }
    }
    if (!providerCols.includes('connection_type')) {
      try {
        db.exec(
          "ALTER TABLE providers ADD COLUMN connection_type TEXT DEFAULT 'https'",
        );
      } catch (e) {
        logger.warn('Failed to add connection_type to providers', e);
      }
    }
    if (!providerCols.includes('is_enabled')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN is_enabled INTEGER DEFAULT 1',
        );
      } catch (e) {
        logger.warn('Failed to add is_enabled to providers', e);
      }
    }
    // Rename website → website_url
    if (
      providerCols.includes('website') &&
      !providerCols.includes('website_url')
    ) {
      try {
        db.exec('ALTER TABLE providers RENAME COLUMN website TO website_url');
      } catch (e) {
        logger.warn('Failed to rename website to website_url in providers', e);
      }
    }
    if (
      !providerCols.includes('website_url') &&
      !providerCols.includes('website')
    ) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN website_url TEXT');
      } catch (e) {
        logger.warn('Failed to add website_url to providers', e);
      }
    }
    if (!providerCols.includes('auth_method')) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN auth_method TEXT');
      } catch (e) {
        logger.warn('Failed to add auth_method to providers', e);
      }
    }
    if (!providerCols.includes('is_pausable')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN is_pausable INTEGER DEFAULT 0',
        );
      } catch (e) {
        logger.warn('Failed to add is_pausable to providers', e);
      }
    }
    if (!providerCols.includes('is_memory')) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN is_memory INTEGER DEFAULT 0');
      } catch (e) {
        logger.warn('Failed to add is_memory to providers', e);
      }
    }

    if (!providerCols.includes('browser_extension_folder')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN browser_extension_folder TEXT',
        );
      } catch (e) {
        logger.warn('Failed to add browser_extension_folder to providers', e);
      }
    }

    // Add description column
    if (!providerCols.includes('description')) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN description TEXT');
      } catch (e) {
        logger.warn('Failed to add description to providers', e);
      }
    }

    // Add color column
    if (!providerCols.includes('color')) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN color TEXT');
      } catch (e) {
        logger.warn('Failed to add color to providers', e);
      }
    }
  } catch (err) {
    logger.error('Error initializing providers table', err);
  }
}

// ─── Model Stats Table ────────────────────────────────────────────────

function migrateModelStats(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_stats (
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        success_rate REAL DEFAULT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (provider_id, model_id)
      )
    `);
  } catch (err) {
    logger.error('Error initializing model_stats table', err);
  }
}

// ─── Metrics Table ────────────────────────────────────────────────────

function migrateMetrics(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        status TEXT DEFAULT 'success',
        total_tokens INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      )
    `);

    // Migration for existing databases: add status column if missing
    const metricsCols = (db.pragma('table_info(metrics)') as any[]).map(
      (c) => c.name,
    );
    if (!metricsCols.includes('status')) {
      try {
        db.exec("ALTER TABLE metrics ADD COLUMN status TEXT DEFAULT 'success'");
      } catch (e) {
        logger.warn('Failed to add status column to metrics', e);
      }
    }

    // Optimization indexes
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_account_time ON metrics(account_id, timestamp)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_provider_model_time ON metrics(provider_id, model_id, timestamp)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status)');
  } catch (err) {
    logger.error('Error initializing metrics table', err);
  }
}

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
        is_memory_enabled: number | null;
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
          is_memory_enabled INTEGER DEFAULT 0,
          user_data_dir TEXT,
          last_used_at INTEGER
        )
      `);

      // Restore data
      const insertStmt = db.prepare(`
        INSERT INTO accounts (id, provider_id, email, credential, usage, reset_usage_at, is_memory_enabled, user_data_dir, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of accountsData) {
        insertStmt.run(
          row.id,
          row.provider_id,
          row.email,
          row.credential,
          row.usage,
          row.reset_usage_at,
          row.is_memory_enabled || 0,
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
    db.exec('DROP TABLE IF EXISTS config');
    // Migration: models table replaced by model_stats
    db.exec('DROP TABLE IF EXISTS models');
    // Migration: remove old columns if exist
    const providerCols = (db.pragma('table_info(providers)') as any[]).map(
      (c) => c.name,
    );
    if (providerCols.includes('name')) {
      db.exec('ALTER TABLE providers RENAME COLUMN name TO title');
    }
    // Keep platform column - do not drop
    // Remove conversation_id column from metrics if exists
    const metricsCols = (db.pragma('table_info(metrics)') as any[]).map(
      (c) => c.name,
    );
    if (metricsCols.includes('conversation_id')) {
      // Drop the index first (SQLite requires this before dropping a column with an index)
      try {
        db.exec('DROP INDEX IF EXISTS idx_metrics_conversation_id');
      } catch (_) {}
      db.exec('ALTER TABLE metrics DROP COLUMN conversation_id');
    }
  } catch (e) {
    logger.warn('Failed to drop unused tables or migrate columns', e);
  }
}
