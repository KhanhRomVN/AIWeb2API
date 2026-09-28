/**
 * ------------------------------------------------------------------
 * Database Connection
 * ------------------------------------------------------------------
 * Quản lý kết nối SQLite cho toàn bộ ứng dụng. Hỗ trợ tìm native binding
 * cho better-sqlite3 trong môi trường binary (pkg) và npm package.
 *
 * Ngoài global `db` (DB chính), module này còn cung cấp AsyncLocalStorage
 * `dbContext` để middleware gắn DB per-request (theo header
 * `x-database-manager-id`). Khi truy cập DB bên trong một request context,
 * `getDb()` sẽ trả về DB của context đó; ngoài context sẽ fallback về global.
 *
 * Main functions:
 * - initDatabase()          : Khởi tạo DB chính (`aiweb2api-accounts.sqlite`), chạy migrations
 * - getDb()                 : Lấy DB instance (ALS context > global)
 * - resolveNativeBinding()  : Tìm native binding cho better-sqlite3 (pkg/npm)
 *
 * Exported context:
 * - dbContext               : AsyncLocalStorage chứa DB per-request
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';

// ── Utils ──
import { createLogger } from '../utils/logger';
import { envInfo } from '../utils/env-info';

// ── Database ──
import { runMigrations } from './migrations';
import { createSqliteDataStore, type DataStore } from './datastore';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('Database');

// ─── Database Instance ────────────────────────────────────────────────
let db: Database.Database | null = null;
let dataStore: DataStore | null = null;

// ─── Request DB Context ───────────────────────────────────────────────

/** Shape của store lưu trong AsyncLocalStorage. */
export interface DbContext {
  db: Database.Database;
  /** DataStore tương ứng (Kysely) — repository async dùng cái này. */
  dataStore: DataStore;
}

/**
 * AsyncLocalStorage lưu DB instance theo từng request (hoặc background scope).
 * Middleware `databaseContextMiddleware` bọc `next()` trong `dbContext.run(...)`
 * để toàn bộ downstream (controller → service → repository) thấy đúng DB.
 */
export const dbContext = new AsyncLocalStorage<DbContext>();

// ─── Functions ──────────────────���───────────────────────────────────────

/**
 * Tìm đường dẫn native binding `better_sqlite3.node` cho môi trường
 * binary (pkg) hoặc npm global install. Trả về `undefined` nếu không tìm thấy
 * để better-sqlite3 tự dùng cơ chế search mặc định.
 */
export const resolveNativeBinding = (): string | undefined => {
  // 0. Alongside executable (useful for standalone binaries)
  const exeDirBindingPath = path.join(
    path.dirname(process.execPath),
    'better_sqlite3.node',
  );

  // 1. Local build path (e.g. for pkg binary where we bundle it)
  const distBindingPath = path.join(
    __dirname,
    'build',
    'Release',
    'better_sqlite3.node',
  );

  // 2. Standard node_modules path (relative to baseDir for npm package)
  const npmBindingPath = path.join(
    envInfo.baseDir,
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  );

  // 3. Fallback path (as seen in some global installs)
  const globalBindingPath = path.join(
    path.dirname(envInfo.baseDir),
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  );

  if (fs.existsSync(exeDirBindingPath)) return exeDirBindingPath;
  if (fs.existsSync(distBindingPath)) return distBindingPath;
  if (fs.existsSync(npmBindingPath)) return npmBindingPath;
  if (fs.existsSync(globalBindingPath)) return globalBindingPath;

  logger.warn(
    'Could not find better-sqlite3 native binding in known locations. Falling back to default search.',
  );
  return undefined;
};

export const initDatabase = (customPath?: string): void => {
  const isCjsBundle =
    envInfo.isBinary || envInfo.isNpmPackage || __filename.endsWith('start.js');
  const basePath = path.join(os.homedir(), '.aiweb2api');

  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const dbPath = customPath || path.join(basePath, 'aiweb2api-accounts.sqlite');

  try {
    if (isCjsBundle) {
      const nativeBinding = resolveNativeBinding();
      const opts: Database.Options = { timeout: 10000 };
      if (nativeBinding) opts.nativeBinding = nativeBinding;
      db = new Database(dbPath, opts);
    } else {
      db = new Database(dbPath, { timeout: 10000 });
    }

    db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
    runMigrations(db);
    dataStore = createSqliteDataStore(db);
  } catch (err) {
    logger.error('Could not connect to database', err);
    throw err;
  }
};

/**
 * Lấy DB instance đang hoạt động.
 * Ưu tiên DB trong AsyncLocalStorage (per-request) — fallback về global `db`.
 */
export const getDb = (): Database.Database => {
  const ctx = dbContext.getStore();
  if (ctx) return ctx.db;
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

/**
 * Lấy DataStore (Kysely) đang hoạt động — API async thống nhất cho
 * cả SQLite lẫn Postgres. Ưu tiên context per-request; fallback về
 * DataStore của DB chính.
 *
 * Dùng trong repository đã migrate sang async. Repository chưa migrate
 * vẫn dùng `getDb()` (sync).
 */
export const getDataStore = (): DataStore => {
  const ctx = dbContext.getStore();
  if (ctx) return ctx.dataStore;
  if (!dataStore) {
    throw new Error('Database not initialized');
  }
  return dataStore;
};