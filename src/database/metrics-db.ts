/**
 * ------------------------------------------------------------------
 * Metrics Database
 * ------------------------------------------------------------------
 * File SQLite riêng (`~/.aiweb2api/metrics.sqlite`) chứa các bảng
 * thống kê: `model_stats` và `metrics`. Tách khỏi accounts DB để
 * dữ liệu thống kê không ảnh hưởng tới migration của accounts.
 *
 * Main functions:
 * - initMetricsDatabase()  : Khởi tạo kết nối + chạy schema
 * - getMetricsDb()         : Lấy instance đã khởi tạo
 * - getMetricsDataStore()  : Lấy DataStore (Kysely) cho metrics DB
 * - resetMetricsDb()       : Reset singleton (dùng khi reinitialize)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createLogger } from '../utils/logger';
import { createSqliteDataStore, type DataStore } from './datastore';
import { resolveNativeBinding } from './connection';
import { envInfo } from '../utils/env-info';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('MetricsDatabase');

let metricsDb: Database.Database | null = null;
let metricsDataStore: DataStore | null = null;

// ─── Functions ──────────────────────────────────────────────────────────

/**
 * Khởi tạo kết nối tới `~/.aiweb2api/metrics.sqlite` và chạy schema.
 * Idempotent — gọi nhiều lần cũng chỉ mở 1 kết nối.
 */
export const initMetricsDatabase = (customPath?: string): void => {
  if (metricsDb) return;

  const basePath = path.join(os.homedir(), '.aiweb2api');
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const dbPath = customPath || path.join(basePath, 'metrics.sqlite');
  const isCjsBundle =
    envInfo.isBinary || envInfo.isNpmPackage || __filename.endsWith('start.js');

  try {
    if (isCjsBundle) {
      const nativeBinding = resolveNativeBinding();
      const opts: Database.Options = { timeout: 10000 };
      if (nativeBinding) opts.nativeBinding = nativeBinding;
      metricsDb = new Database(dbPath, opts);
    } else {
      metricsDb = new Database(dbPath, { timeout: 10000 });
    }

    metricsDb.pragma('journal_mode = WAL');
    runMetricsMigrations(metricsDb);
    metricsDataStore = createSqliteDataStore(metricsDb);
  } catch (err) {
    logger.error('Could not connect to metrics database', err);
    metricsDb = null;
    metricsDataStore = null;
    throw err;
  }
};

/**
 * Lấy instance metrics database. Throw nếu chưa khởi tạo.
 */
export const getMetricsDb = (): Database.Database => {
  if (!metricsDb) {
    throw new Error('Metrics database not initialized');
  }
  return metricsDb;
};

/**
 * Lấy DataStore (Kysely) cho metrics database.
 */
export const getMetricsDataStore = (): DataStore => {
  if (!metricsDataStore) {
    throw new Error('Metrics database not initialized');
  }
  return metricsDataStore;
};

/**
 * Reset singleton — dùng khi cần reinitialize.
 * @internal
 */
export const resetMetricsDb = (): void => {
  try { metricsDb?.close(); } catch (_) {}
  metricsDb = null;
  metricsDataStore = null;
};

// ─── Migrations ──────────────────────────────────────────────────────────

function runMetricsMigrations(db: Database.Database): void {
  migrateModelStats(db);
  migrateMetrics(db);
}

function migrateModelStats(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_stats (
        provider_id TEXT NOT NULL,
        model_id    TEXT NOT NULL,
        success_rate REAL DEFAULT NULL,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (provider_id, model_id)
      )
    `);
  } catch (err) {
    logger.error('Error initializing model_stats table', err);
  }
}

function migrateMetrics(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        model_id    TEXT NOT NULL,
        account_id  TEXT NOT NULL,
        status      TEXT DEFAULT 'success',
        total_tokens INTEGER DEFAULT 0,
        timestamp   INTEGER NOT NULL
      )
    `);

    const cols = (db.pragma('table_info(metrics)') as any[]).map((c) => c.name);
    if (!cols.includes('status')) {
      db.exec("ALTER TABLE metrics ADD COLUMN status TEXT DEFAULT 'success'");
    }

    db.exec('CREATE INDEX IF NOT EXISTS idx_metrics_timestamp          ON metrics(timestamp)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_metrics_account_time       ON metrics(account_id, timestamp)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_metrics_provider_model_time ON metrics(provider_id, model_id, timestamp)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_metrics_status             ON metrics(status)');
  } catch (err) {
    logger.error('Error initializing metrics table', err);
  }
}
