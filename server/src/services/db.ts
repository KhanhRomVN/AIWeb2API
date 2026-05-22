import Database from 'better-sqlite3';
import path from 'path';
import { createLogger } from '../utils/logger';
import os from 'os';
import fs from 'fs';
import { envInfo } from '../utils/env-info';

const logger = createLogger('Database');
let db: Database.Database | null = null;

export const initDatabase = (customPath?: string): void => {
  const isCjsBundle =
    envInfo.isBinary || envInfo.isNpmPackage || __filename.endsWith('start.js');
  const basePath = path.join(os.homedir(), '.elara');

  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const dbPath = customPath || path.join(basePath, 'database.sqlite');

  try {
    if (isCjsBundle) {
      logger.info(
        `Detected CJS Bundle environment. BaseDir: ${envInfo.baseDir}`,
      );

      // 1. Try local build path (e.g. for pkg binary where we bundle it)
      const distBindingPath = path.join(
        __dirname,
        'build',
        'Release',
        'better_sqlite3.node',
      );

      // 2. Try standard node_modules path (relative to baseDir for npm package)
      const npmBindingPath = path.join(
        envInfo.baseDir,
        'node_modules',
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node',
      );

      // 3. Try fallback path (as seen in some global installs)
      const globalBindingPath = path.join(
        path.dirname(envInfo.baseDir),
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node',
      );

      let nativeBinding: string | undefined = undefined;

      if (fs.existsSync(distBindingPath)) {
        nativeBinding = distBindingPath;
        logger.info(
          `Loading SQLite native binding from dist path: ${distBindingPath}`,
        );
      } else if (fs.existsSync(npmBindingPath)) {
        nativeBinding = npmBindingPath;
        logger.info(
          `Loading SQLite native binding from npm path: ${npmBindingPath}`,
        );
      } else if (fs.existsSync(globalBindingPath)) {
        nativeBinding = globalBindingPath;
        logger.info(
          `Loading SQLite native binding from global path: ${globalBindingPath}`,
        );
      } else {
        logger.warn(
          'Could not find better-sqlite3 native binding in known locations. Falling back to default search.',
        );
      }

      db = new Database(dbPath, {
        timeout: 10000,
        nativeBinding,
      });
    } else {
      db = new Database(dbPath, { timeout: 10000 });
    }
    db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
    createTables();
  } catch (err) {
    logger.error('Could not connect to database', err);
    throw err;
  }
};

const createTables = (): void => {
  if (!db) throw new Error('Database not initialized');

  const accountsQuery = `
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      email TEXT NOT NULL,
      credential TEXT NOT NULL,
      last_refreshed_at INTEGER,
      usage TEXT,
      reset_period TEXT
    )
  `;

  try {
    db.exec(accountsQuery);

    // Migration: Refactor Accounts Schema (Remove accumulated tokens/requests)
    const accountInfo = db.pragma('table_info(accounts)') as any[];
    const accountColumns = accountInfo.map((c) => c.name);
    if (accountColumns.includes('year_tokens')) {
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
        // Preserve credentials
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
    } else if (accountColumns.includes('total_requests')) {
      // Migration: Remove stats columns
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
          CREATE TABLE accounts_new (
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
        logger.error('Failed to remove stats columns from accounts', e);
      }
    }

    // Migration: Add last_refreshed_at column if it doesn't exist
    const finalAccountInfo = db.pragma('table_info(accounts)') as any[];
    const finalAccountColumns = finalAccountInfo.map((c) => c.name);
    if (!finalAccountColumns.includes('last_refreshed_at')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN last_refreshed_at INTEGER');
        logger.info('Migrated accounts table: added last_refreshed_at column');
      } catch (e) {
        logger.warn('Failed to add last_refreshed_at to accounts', e);
      }
    }

    if (!finalAccountColumns.includes('usage')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN usage TEXT');
        logger.info('Migrated accounts table: added usage column');
      } catch (e) {
        logger.warn('Failed to add usage to accounts', e);
      }
    }

    if (!finalAccountColumns.includes('reset_period')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN reset_period TEXT');
        logger.info('Migrated accounts table: added reset_period column');
      } catch (e) {
        logger.warn('Failed to add reset_period to accounts', e);
      }
    }

    // Migration: Ensure column name is provider_id
    // Re-check columns after potential migration
    const updatedAccountInfo = db.pragma('table_info(accounts)') as any[];
    const updatedAccountColumns = updatedAccountInfo.map((c) => c.name);

    if (
      updatedAccountColumns.includes('provider') &&
      !updatedAccountColumns.includes('provider_id')
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

  const providersQuery = `
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_accounts INTEGER DEFAULT 0
    )
  `;

  try {
    db.exec(providersQuery);

    // Migration: Add total_accounts column if it doesn't exist
    const providersInfo = db.pragma('table_info(providers)') as any[];
    const providersColumns = providersInfo.map((c) => c.name);
    if (!providersColumns.includes('total_accounts')) {
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

  // Drop old unused tables
  try {
    db.exec('DROP TABLE IF EXISTS models_performance');
    db.exec('DROP TABLE IF EXISTS conversation_stats');
    db.exec('DROP TABLE IF EXISTS extended_tools');
    db.exec('DROP TABLE IF EXISTS accounts_stats');
    db.exec('DROP TABLE IF EXISTS providers_stats');
  } catch (e) {
    logger.warn('Failed to drop unused tables', e);
  }

  const commandsQuery = `
    CREATE TABLE IF NOT EXISTS commands (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;
  try {
    db.exec(commandsQuery);
  } catch (err) {
    logger.error('Error initializing commands table', err);
  }

  const configQuery = `
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;
  db.exec(configQuery);
  db.prepare(
    "INSERT OR IGNORE INTO config (key, value) VALUES ('enable_stats_collection', 'true')",
  ).run();

  // --- NEW: Conversation & Message Persistence ---
  const localConversationsQuery = `
    CREATE TABLE IF NOT EXISTS local_conversations (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;
  db.exec(localConversationsQuery);

  const localMessagesQuery = `
    CREATE TABLE IF NOT EXISTS local_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES local_conversations(id) ON DELETE CASCADE
    )
  `;
  db.exec(localMessagesQuery);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_local_messages_conv_id ON local_messages(conversation_id)',
  );

  // Table to cache provider models
  const providerModelsQuery = `
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
  `;

  try {
    db.exec(providerModelsQuery);

    // Migration: Refactor Provider Models Schema
    const pmInfo = db.pragma('table_info(provider_models)') as any[];
    const pmColumns = pmInfo.map((c) => c.name);

    if (pmColumns.includes('year_tokens')) {
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
                CREATE TABLE IF NOT EXISTS provider_models_new (
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
        // Preserve model info and max stats
        db.exec(`
                INSERT INTO provider_models_new (
                    provider_id, model_id, model_name, is_thinking, context_length, updated_at,
                    max_req_conversation, max_token_conversation
                )
                SELECT
                    provider_id, model_id, model_name, is_thinking, context_length, updated_at,
                    max_req_conversation, max_token_conversation
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
    } else if (pmColumns.includes('max_req_conversation')) {
      // Migration: Remove max stats columns from provider_models
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
        logger.error('Failed to remove stats columns from provider_models', e);
      }
    }
  } catch (err) {
    logger.error('Error initializing provider_models', err);
  }

  // Table to track last sync time for dynamic providers
  const providerModelsSyncQuery = `
    CREATE TABLE IF NOT EXISTS provider_models_sync (
      provider_id TEXT PRIMARY KEY,
      last_sync_at INTEGER NOT NULL,
      is_dynamic INTEGER DEFAULT 0
    )
  `;
  db.exec(providerModelsSyncQuery);

  // Table to track model sequences (user defined ordering)
  const modelSequencesQuery = `
    CREATE TABLE IF NOT EXISTS model_sequences (
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(provider_id, model_id)
    )
  `;
  db.exec(modelSequencesQuery);

  // Table to track active conversation stats: removed (conversation_stats)

  // Table to store detailed usage metrics
  const metricsQuery = `
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      conversation_id TEXT,
      total_tokens INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL
    )
  `;
  try {
    db.exec(metricsQuery);
    // Migration: Add conversation_id to metrics if missing
    const metricsInfo = db.pragma('table_info(metrics)') as any[];
    if (!metricsInfo.map((c) => c.name).includes('conversation_id')) {
      try {
        db.exec('ALTER TABLE metrics ADD COLUMN conversation_id TEXT');
      } catch (e) {
        logger.warn('Failed to add conversation_id to metrics', e);
      }
    }

    // Optimization Indexes for fast metrics querying (< 1s)
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
};

export const getDb = (): Database.Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const closeDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};
