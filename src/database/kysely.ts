/**
 * ------------------------------------------------------------------
 * Kysely Factory
 * ------------------------------------------------------------------
 * Tạo Kysely instance cho từng engine:
 * - SQLite : bọc better-sqlite3 hiện có (SqliteDialect)
 * - Postgres: dùng pg Pool (PostgresDialect)
 *
 * Kysely cung cấp API async thống nhất cho cả 2 engine, cho phép
 * repository viết 1 lần chạy được trên nhiều dialect. Đây là nền tảng
 * cho việc route request sang database manager `connection` type.
 *
 * Main functions:
 * - createSqliteKysely()   : Kysely trên better-sqlite3 connection
 * - createPostgresKysely() : Kysely trên pg Pool
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Kysely, SqliteDialect, PostgresDialect } from 'kysely';
import type Database from 'better-sqlite3';
import { Pool } from 'pg';

// ── Schema ──
import type { Database as DbSchema } from './schema';

// ─── Types ──────────────────────────────────────────────────────────────

/** Thông tin kết nối Postgres — map từ database manager `connection` type. */
export interface PostgresConfig {
  host: string;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  password?: string | null;
  ssl_mode?: string | null;
}

// ─── Factories ──────────────────────────────────────────────────────────

/**
 * Tạo Kysely instance bọc quanh một better-sqlite3 connection có sẵn.
 * Kysely dùng chính connection này — không mở thêm file handle.
 */
export const createSqliteKysely = (
  db: Database.Database,
): Kysely<DbSchema> =>
  new Kysely<DbSchema>({
    dialect: new SqliteDialect({ database: db }),
  });

/**
 * Chuyển `ssl_mode` của app sang option `ssl` của pg.
 * Giữ nhất quán với logic trong `postgres.adapter.ts`.
 */
const resolvePgSsl = (
  sslMode: string | null | undefined,
): boolean | object | undefined => {
  switch (sslMode) {
    case 'disable':
      return false;
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-ca':
    case 'verify-full':
      return { rejectUnauthorized: true };
    default:
      return undefined; // pg tự quyết
  }
};

/**
 * Tạo Kysely instance kết nối tới Postgres qua pg Pool.
 * Caller chịu trách nhiệm gọi `.destroy()` khi không còn dùng
 * (giải phóng pool) — thường là không, vì connection được cache.
 */
export const createPostgresKysely = (
  config: PostgresConfig,
): Kysely<DbSchema> => {
  const pool = new Pool({
    host: config.host,
    port: config.port ?? 5432,
    database: config.database_name ?? undefined,
    user: config.username ?? undefined,
    password: config.password ?? undefined,
    ssl: resolvePgSsl(config.ssl_mode),
    connectionTimeoutMillis: 8000,
  });

  return new Kysely<DbSchema>({
    dialect: new PostgresDialect({ pool }),
  });
};