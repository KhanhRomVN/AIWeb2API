import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';
import { seedDatabase } from './seed';

const logger = createLogger('Database');

export const runMigrations = (db: Database.Database): void => {
  migrateAccounts(db);
  migrateProviders(db);
  migrateModels(db);
  migrateMetrics(db);
  dropUnusedTables(db);
  seedDatabase(db);
};

// =============================================================================
// ACCOUNTS
// =============================================================================

function migrateAccounts(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        email TEXT NOT NULL,
        credential TEXT NOT NULL,
        last_refreshed_at INTEGER,
        usage TEXT,
        reset_period TEXT
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

    if (!finalCols.includes('last_refreshed_at')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN last_refreshed_at INTEGER');
      } catch (e) {
        logger.warn('Failed to add last_refreshed_at to accounts', e);
      }
    }
    if (!finalCols.includes('usage')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN usage TEXT');
      } catch (e) {
        logger.warn('Failed to add usage to accounts', e);
      }
    }
    if (!finalCols.includes('reset_period')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN reset_period TEXT');
      } catch (e) {
        logger.warn('Failed to add reset_period to accounts', e);
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

// =============================================================================
// PROVIDERS
// =============================================================================

function migrateProviders(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        platform TEXT DEFAULT 'web'
      )
    `);

    // Migration for existing databases: add platform column if missing
    const providerCols = (db.pragma('table_info(providers)') as any[]).map((c) => c.name);
    if (!providerCols.includes('platform')) {
      try {
        db.exec("ALTER TABLE providers ADD COLUMN platform TEXT DEFAULT 'web'");
        logger.info('Added platform column to providers table');
      } catch (e) {
        logger.warn('Failed to add platform column to providers', e);
      }
    }
  } catch (err) {
    logger.error('Error initializing providers table', err);
  }
}

// =============================================================================
// MODELS
// =============================================================================

function migrateModels(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        is_thinking INTEGER DEFAULT 0,
        context_length INTEGER,
        updated_at INTEGER NOT NULL,
        UNIQUE(provider_id, model_id)
      )
    `);
  } catch (err) {
    logger.error('Error initializing models table', err);
  }
}

// =============================================================================
// METRICS
// =============================================================================

function migrateMetrics(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        total_tokens INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      )
    `);

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
  } catch (err) {
    logger.error('Error initializing metrics table', err);
  }
}

// =============================================================================
// CLEANUP
// =============================================================================

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
    // Migration: remove old columns if exist
    const providerCols = (db.pragma('table_info(providers)') as any[]).map((c) => c.name);
    if (providerCols.includes('name')) {
      db.exec('ALTER TABLE providers RENAME COLUMN name TO title');
    }
    // Keep platform column - do not drop
    if (providerCols.includes('description')) {
      db.exec('ALTER TABLE providers DROP COLUMN description');
    }
    // Remove conversation_id column from metrics if exists
    const metricsCols = (db.pragma('table_info(metrics)') as any[]).map((c) => c.name);
    if (metricsCols.includes('conversation_id')) {
      // Drop the index first (SQLite requires this before dropping a column with an index)
      try { db.exec('DROP INDEX IF EXISTS idx_metrics_conversation_id'); } catch (_) {}
      db.exec('ALTER TABLE metrics DROP COLUMN conversation_id');
    }
  } catch (e) {
    logger.warn('Failed to drop unused tables or migrate columns', e);
  }
}