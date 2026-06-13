import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';
import { seedDatabase } from './seed';

const logger = createLogger('Database');

export const runMigrations = (db: Database.Database): void => {
  migrateAccounts(db);
  migrateProviders(db);
  migrateCommands(db);
  migrateConfig(db);
  migrateConversations(db);
  migrateProviderModels(db);
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
        name TEXT NOT NULL,
        total_accounts INTEGER DEFAULT 0
      )
    `);

    const cols = (db.pragma('table_info(providers)') as any[]).map(
      (c) => c.name,
    );
    if (!cols.includes('total_accounts')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN total_accounts INTEGER DEFAULT 0',
        );
      } catch (e) {
        logger.warn('Failed to add total_accounts to providers');
      }
    }
  } catch (err) {
    logger.error('Error initializing providers table', err);
  }
}

// =============================================================================
// COMMANDS
// =============================================================================

function migrateCommands(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id TEXT PRIMARY KEY,
        trigger TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  } catch (err) {
    logger.error('Error initializing commands table', err);
  }
}

// =============================================================================
// CONFIG
// =============================================================================

function migrateConfig(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

// =============================================================================
// CONVERSATIONS & MESSAGES
// =============================================================================

function migrateConversations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_conversations (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS local_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES local_conversations(id) ON DELETE CASCADE
    )
  `);

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_local_messages_conv_id ON local_messages(conversation_id)',
  );
}

// =============================================================================
// PROVIDER MODELS
// =============================================================================

function migrateProviderModels(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS provider_models (
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

    const cols = (db.pragma('table_info(provider_models)') as any[]).map(
      (c) => c.name,
    );

    // Migration: Remove year_tokens / max_req_conversation columns
    if (
      cols.includes('year_tokens') ||
      cols.includes('max_req_conversation')
    ) {
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
          CREATE TABLE provider_models_new (
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
        db.exec(`
          INSERT INTO provider_models_new (
            provider_id, model_id, model_name, is_thinking, context_length, updated_at
          )
          SELECT
            provider_id, model_id, model_name, is_thinking, context_length, updated_at
          FROM provider_models
        `);
        db.exec('DROP TABLE provider_models');
        db.exec('ALTER TABLE provider_models_new RENAME TO provider_models');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        logger.error('Failed to migrate provider_models', e);
        throw e;
      }
    }
  } catch (err) {
    logger.error('Error initializing provider_models', err);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_models_sync (
      provider_id TEXT PRIMARY KEY,
      last_sync_at INTEGER NOT NULL,
      is_dynamic INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_sequences (
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(provider_id, model_id)
    )
  `);
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
        conversation_id TEXT,
        total_tokens INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      )
    `);

    const cols = (db.pragma('table_info(metrics)') as any[]).map((c) => c.name);
    if (!cols.includes('conversation_id')) {
      try {
        db.exec('ALTER TABLE metrics ADD COLUMN conversation_id TEXT');
      } catch (e) {
        logger.warn('Failed to add conversation_id to metrics', e);
      }
    }

    // Optimization indexes
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_conversation_id ON metrics(conversation_id)',
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
  } catch (e) {
    logger.warn('Failed to drop unused tables', e);
  }
}
