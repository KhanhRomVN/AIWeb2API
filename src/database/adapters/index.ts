/**
 * ------------------------------------------------------------------
 * Database Adapter Factory
 * ------------------------------------------------------------------
 * Factory tạo adapter phù hợp với từng loại database dựa vào `db_type`.
 * Mỗi adapter implement interface `DatabaseAdapter` chung.
 *
 * Supported db_type:
 *   sqlite     → better-sqlite3 (local-file)
 *   postgres   → pg
 *   mysql      → mysql2
 *   mariadb    → mysql2 (tương thích)
 *   mssql      → mssql
 *   mongodb    → mongoose (đã có trong deps)
 * ------------------------------------------------------------------
 */

import { SqliteAdapter } from './sqlite.adapter';
import { PostgresAdapter } from './postgres.adapter';
import { MySQLAdapter } from './mysql.adapter';
import { MSSQLAdapter } from './mssql.adapter';
import { MongoAdapter } from './mongo.adapter';

export interface TestResult {
  success: boolean;
  message: string;
}

/**
 * Interface chung mà mọi adapter phải implement.
 */
export interface DatabaseAdapter {
  /** Test kết nối — không throw, luôn trả về TestResult. */
  testConnection(): Promise<TestResult>;
}

export type DbType =
  | 'sqlite'
  | 'postgres'
  | 'mysql'
  | 'mariadb'
  | 'mssql'
  | 'mongodb';

export interface AdapterConfig {
  db_type: DbType;
  // local-file
  file_path?: string | null;
  // connection-based
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  password?: string | null;
  ssl_mode?: string | null;
  // mongodb extra
  extra_json?: string | null;
}

/**
 * Trích xuất message từ error object — xử lý cả trường hợp `message` rỗng
 * (AggregateError khi mọi bản ghi IPv4/IPv6 đều fail kết nối) và ưu tiên
 * code/name để message không bao giờ rỗng.
 *
 * Dùng chung cho mọi adapter để tránh bug "message rỗng" lặp lại.
 */
export function formatAdapterError(err: any): string {
  if (!err) return 'Connection failed';

  // AggregateError: Node gộp nhiều lỗi (thường IPv4 + IPv6 fail cùng lúc)
  if (err.name === 'AggregateError' || Array.isArray(err.errors)) {
    const inner = Array.isArray(err.errors)
      ? err.errors
          .map((e: any) => e?.message || e?.code || e?.name)
          .filter(Boolean)
          .join('; ')
      : '';
    return (
      inner || err.code || 'AggregateError (all connection attempts failed)'
    );
  }

  return (
    err.message ||
    (err.code
      ? `${err.code}${err.address ? ` @ ${err.address}:${err.port ?? ''}` : ''}`
      : '') ||
    err.name ||
    String(err)
  );
}

/**
 * Tạo adapter phù hợp với db_type.
 */
export function createAdapter(config: AdapterConfig): DatabaseAdapter {
  switch (config.db_type) {
    case 'sqlite':   return new SqliteAdapter(config);
    case 'postgres': return new PostgresAdapter(config);
    case 'mysql':
    case 'mariadb':  return new MySQLAdapter(config);
    case 'mssql':    return new MSSQLAdapter(config);
    case 'mongodb':  return new MongoAdapter(config);
    default:
      throw new Error(`Unsupported db_type: ${(config as any).db_type}`);
  }
}
