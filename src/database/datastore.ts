/**
 * ------------------------------------------------------------------
 * DataStore Abstraction
 * ------------------------------------------------------------------
 * Bọc Kysely instance + metadata về dialect, để repository có thể
 * truy vấn mà không cần biết đang chạy trên SQLite hay Postgres.
 *
 * DataStore là async-first (Kysely API trả Promise), nên các repository
 * đã migrate sẽ `await`; repository chưa migrate vẫn dùng `getDb()`
 * (sync, chỉ hỗ trợ SQLite) như trước.
 *
 * Main functions:
 * - createSqliteDataStore()   : DataStore từ better-sqlite3 connection
 * - createPostgresDataStore() : DataStore từ Postgres config (pg Pool)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────���───────────────────────────────────────────────────
// ── External ──
import type { Kysely } from 'kysely';
import type Database from 'better-sqlite3';

// ── Database ──
import {
  createSqliteKysely,
  createPostgresKysely,
  type PostgresConfig,
} from './kysely';

// ── Schema ──
import type { Database as DbSchema } from './schema';

// ─── Types ──────────────────────────────────────────────────────────────

/** Engine đang chạy — dùng để repository xử lý khác biệt nhỏ (nếu có). */
export type Dialect = 'sqlite' | 'postgres';

/**
 * Đối tượng truy vấn DB thống nhất. Repository gọi `getDataStore().kysely`
 * để build query. `destroy()` giải phóng tài nguyên (Postgres pool).
 */
export interface DataStore {
  /** Kysely instance — API async thống nhất cho cả 2 engine. */
  readonly kysely: Kysely<DbSchema>;
  /** Engine đang dùng. */
  readonly dialect: Dialect;
  /** Giải phóng tài nguyên (đóng pool). No-op với SQLite dùng chung. */
  destroy(): Promise<void>;
}

// ─── Factories ──────────────────────────────────────────────────────────

/**
 * Tạo DataStore bọc quanh một better-sqlite3 connection có sẵn.
 * Không đóng connection khi destroy vì connection được quản lý tập trung
 * (global hoặc cache trong middleware).
 */
export const createSqliteDataStore = (
  conn: Database.Database,
): DataStore => ({
  kysely: createSqliteKysely(conn),
  dialect: 'sqlite',
  destroy: async () => {
    /* SQLite connection do caller quản lý — không đóng ở đây. */
  },
});

/**
 * Tạo DataStore kết nối tới Postgres. `destroy()` sẽ đóng pool —
 * middleware cache DataStore nên chỉ gọi destroy khi thực sự cần giải phóng.
 */
export const createPostgresDataStore = (
  config: PostgresConfig,
): DataStore => {
  const kysely = createPostgresKysely(config);
  return {
    kysely,
    dialect: 'postgres',
    destroy: async () => {
      await kysely.destroy();
    },
  };
};