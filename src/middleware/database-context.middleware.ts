/**
 * ------------------------------------------------------------------
 * Database Context Middleware
 * ------------------------------------------------------------------
 * Đọc header `x-database-manager-id` từ request và gắn DB connection
 * tương ứng vào `res.locals.db` + AsyncLocalStorage `dbContext`.
 *
 * Toàn bộ downstream (controller → service → repository) gọi `getDb()`
 * (sync SQLite) hoặc `getDataStore()` (async Kysely) sẽ tự động nhận
 * đúng DB của request nhờ ALS — không cần truyền `res` xuống từng hàm.
 *
 * Hỗ trợ routing:
 * - `local-file` + sqlite   → mở file SQLite riêng (sync + async).
 * - `connection` + postgres → Kysely + pg Pool (chỉ async qua getDataStore()).
 * - Các engine khác          → fallback DB chính + log WARN 1 lần/manager.
 *
 * Main functions:
 * - databaseContextMiddleware() : Gắn DB + DataStore vào res.locals + ALS
 * - getRequestDb()              : Lấy DB sync từ res.locals (fallback)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';

// ── Database ──
import {
  dbContext,
  getDb,
  getDataStore,
  resolveNativeBinding,
} from '../database/connection';
import { runMigrations } from '../database/migrations';
import { getManagersDb } from '../database/managers';
import {
  createSqliteDataStore,
  createPostgresDataStore,
  type DataStore,
} from '../database/datastore';
import { runPostgresMigrations } from '../database/migrations-postgres';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DatabaseContextMiddleware');

/** Header name Zen gửi lên để chỉ định database manager ID. */
export const DB_MANAGER_HEADER = 'x-database-manager-id';

/**
 * Cache per-process cho các DB connection SQLite đã mở theo file_path.
 * Key = file_path tuyệt đối, Value = Database instance.
 * Dùng để tránh mở lại kết nối mỗi request.
 */
const connectionCache = new Map<string, Database.Database>();

/**
 * Cache DataStore theo managerId — tránh tạo lại Kysely/pg Pool mỗi request.
 * Với SQLite, DataStore bọc connection đã cache; với Postgres, giữ pool sống.
 */
const dataStoreCache = new Map<string, DataStore>();

/**
 * Cache promise migration Postgres theo managerId — đảm bảo schema chỉ
 * được tạo 1 lần, các request song song cùng await chung 1 promise.
 */
const migrationPromises = new Map<string, Promise<void>>();

/**
 * Tập managerId đã cảnh báo "không routable" — tránh spam log WARN
 * mỗi request khi user vẫn đang active một manager không hỗ trợ.
 */
const warnedNonRoutableIds = new Set<string>();

// ─── Functions ──────────────────────────────────────────────────────────

/**
 * Lấy hoặc tạo SQLite connection cho file_path chỉ định.
 * - Reuse native binding resolution từ `database/connection.ts` để chạy
 *   đúng trong môi trường pkg/npm binary.
 * - Chạy migrations sau khi mở để đảm bảo schema đầy đủ (DB local-file
 *   do user tạo có thể là file rỗng).
 * - Cache theo file_path để gọi nhiều lần trả về cùng instance.
 */
const getOrCreateSqliteConnection = (filePath: string): Database.Database => {
  const cached = connectionCache.get(filePath);
  if (cached) return cached;

  try {
    const nativeBinding = resolveNativeBinding();
    const opts: Database.Options = { timeout: 10000 };
    if (nativeBinding) opts.nativeBinding = nativeBinding;

    const conn = new Database(filePath, opts);
    conn.pragma('journal_mode = WAL');
    runMigrations(conn);

    connectionCache.set(filePath, conn);
    return conn;
  } catch (err) {
    logger.error(`Failed to open SQLite database at ${filePath}`, err);
    throw err;
  }
};

/**
 * Lấy DataStore đã cache cho managerId, hoặc tạo mới bằng factory rồi cache.
 * Đảm bảo mỗi manager chỉ tạo 1 Kysely/pg Pool dù nhận nhiều request.
 */
const getOrCreateDataStore = (
  managerId: string,
  factory: () => DataStore,
): DataStore => {
  const cached = dataStoreCache.get(managerId);
  if (cached) return cached;
  const ds = factory();
  dataStoreCache.set(managerId, ds);
  return ds;
};

/** Shape của row trong bảng `database_managers`. */
interface ManagerRow {
  id: string;
  type: string;
  file_path: string | null;
  db_type: string;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  password: string | null;
  ssl_mode: string | null;
}

/** Kết quả resolve — gồm DB sync (SQLite) và DataStore async (Kysely). */
interface ResolvedContext {
  db: Database.Database;
  dataStore: DataStore;
  managerId: string | null;
}

/**
 * Fallback context khi không có manager hoặc manager không hỗ trợ routing.
 * `db` và `dataStore` đều trỏ về DB chính.
 */
const defaultContext = (): ResolvedContext => ({
  db: getDb(),
  dataStore: getDataStore(),
  managerId: null,
});

/**
 * Đảm bảo schema Postgres đã được migrate cho manager chỉ định.
 * Idempotent nhờ cache promise — request song song dùng chung 1 lần chạy.
 */
const ensurePostgresMigrations = (
  managerId: string,
  dataStore: DataStore,
): Promise<void> => {
  const cached = migrationPromises.get(managerId);
  if (cached) return cached;
  const promise = runPostgresMigrations(dataStore.kysely).catch((err) => {
    // Xoá cache khi lỗi để request sau có thể thử lại.
    migrationPromises.delete(managerId);
    throw err;
  });
  migrationPromises.set(managerId, promise);
  return promise;
};

/**
 * Resolve DB + DataStore dựa trên header `x-database-manager-id`.
 * managerId = null nghĩa là dùng DB chính.
 */
const resolveRequestDb = async (
  managerId: string | undefined,
): Promise<ResolvedContext> => {
  if (!managerId) return defaultContext();

  try {
    const managersDb = getManagersDb();
    const manager = managersDb
      .prepare('SELECT * FROM database_managers WHERE id = ?')
      .get(managerId) as ManagerRow | undefined;

    if (!manager) {
      logger.warn(
        `Database manager not found: ${managerId} — falling back to default`,
      );
      return defaultContext();
    }

    // ── local-file (SQLite) ──
    if (manager.type === 'local-file' && manager.file_path) {
      if (manager.db_type === 'sqlite' || !manager.db_type) {
        try {
          const conn = getOrCreateSqliteConnection(manager.file_path);
          const ds = getOrCreateDataStore(managerId, () =>
            createSqliteDataStore(conn),
          );
          return { db: conn, dataStore: ds, managerId };
        } catch (err) {
          logger.error(
            `Could not open database file: ${manager.file_path}`,
            err,
          );
          return defaultContext();
        }
      }
      logger.warn(
        `Unsupported local-file db_type: ${manager.db_type} — falling back`,
      );
      return defaultContext();
    }

    // ── connection (Postgres) ──
    // Repository đã migrate dùng `getDataStore().kysely`; `getDb()` (sync SQLite)
    // vẫn fallback về DB chính cho code chưa migrate.
    if (manager.type === 'connection') {
      if (manager.db_type === 'postgres' && manager.host) {
        try {
          const ds = getOrCreateDataStore(managerId, () =>
            createPostgresDataStore({
              host: manager.host as string,
              port: manager.port,
              database_name: manager.database_name,
              username: manager.username,
              password: manager.password,
              ssl_mode: manager.ssl_mode,
            }),
          );
          // Đảm bảo schema đã tồn tại trước khi request đầu tiên query.
          await ensurePostgresMigrations(managerId, ds);
          return { db: getDb(), dataStore: ds, managerId };
        } catch (err) {
          logger.error(
            `Could not create Postgres DataStore for manager ${managerId}`,
            err,
          );
          return defaultContext();
        }
      }
      if (!warnedNonRoutableIds.has(managerId)) {
        warnedNonRoutableIds.add(managerId);
        logger.warn(
          `Database manager "${managerId}" has db_type="${manager.db_type}" — ` +
            `only "postgres" connection is routable currently. ` +
            `Falling back to the default database.`,
        );
      }
      return defaultContext();
    }

    return defaultContext();
  } catch (err) {
    logger.error('Error resolving database context', err);
    return defaultContext();
  }
};

/**
 * Express middleware — resolve DB/DataStore theo header rồi bọc `next()`
 * trong ALS context.
 *
 * Sau middleware này:
 * - `res.locals.db`          : DB instance sync (SQLite) đang dùng
 * - `res.locals.dbManagerId` : ID của manager (hoặc null = default)
 * - `dbContext`              : ALS store cho `getDb()` / `getDataStore()`
 */
export const databaseContextMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const managerId = req.headers[DB_MANAGER_HEADER] as string | undefined;
  const resolved = await resolveRequestDb(managerId);
  const { db, dataStore, managerId: resolvedId } = resolved;

  res.locals.db = db;
  res.locals.dbManagerId = resolvedId;

  // Chạy toàn bộ downstream (bao gồm next handler) trong ALS context
  // để mọi `getDb()` / `getDataStore()` gọi sau đây trả về đúng DB.
  dbContext.run({ db, dataStore }, next);
};

/**
 * Lấy Database instance (sync) từ res.locals (đã được set bởi middleware).
 * Fallback về `getDb()` nếu chưa qua middleware (an toàn).
 */
export const getRequestDb = (res: Response): Database.Database => {
  return (res.locals.db as Database.Database | undefined) ?? getDb();
};