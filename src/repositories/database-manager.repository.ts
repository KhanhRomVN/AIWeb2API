/**
 * ------------------------------------------------------------------
 * Database Manager Repository
 * ------------------------------------------------------------------
 * Repository cho bảng `database_managers` (file database-managers.sqlite riêng).
 *
 * Main functions:
 * - listManagers()   : Lấy toàn bộ manager
 * - getManagerById() : Lấy 1 manager theo id
 * - createManager()  : Tạo manager mới
 * - updateManager()  : Cập nhật (partial) manager
 * - deleteManager()  : Xóa manager
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getManagersDb } from '../database/managers';

// ── Adapter types ──
import type { DbType } from '../database/adapters';

// ─── Types ──────────────────────────────────────────────────────────────

export type DatabaseManagerType = 'local-file' | 'connection';
export type { DbType };

export interface DatabaseManagerRow {
  id: string;
  name: string;
  type: DatabaseManagerType;
  db_type: DbType;
  icon: string | null;
  color: string | null;
  file_path: string | null;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  password: string | null;
  ssl_mode: string | null;
  channel_binding: string | null;
  extra_json: string | null;
  last_test_status: string | null;
  last_test_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface DatabaseManagerInput {
  name: string;
  type: DatabaseManagerType;
  db_type: DbType;
  icon?: string | null;
  color?: string | null;
  file_path?: string | null;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  password?: string | null;
  ssl_mode?: string | null;
  channel_binding?: string | null;
  extra_json?: string | null;
}

// ─── Queries ────────────────────────────────────────────────────────────

/** Lấy toàn bộ manager, sắp xếp theo thời điểm tạo. */
export const listManagers = (): DatabaseManagerRow[] => {
  const db = getManagersDb();
  return db
    .prepare('SELECT * FROM database_managers ORDER BY created_at ASC')
    .all() as DatabaseManagerRow[];
};

/** Lấy 1 manager theo id, undefined nếu không tồn tại. */
export const getManagerById = (
  id: string,
): DatabaseManagerRow | undefined => {
  const db = getManagersDb();
  return db
    .prepare('SELECT * FROM database_managers WHERE id = ?')
    .get(id) as DatabaseManagerRow | undefined;
};

/** Tạo manager mới. Trả về row vừa tạo. */
export const createManager = (
  row: DatabaseManagerRow,
): DatabaseManagerRow => {
  const db = getManagersDb();
  db.prepare(
    `INSERT INTO database_managers (
      id, name, type, db_type, icon, color, file_path,
      host, port, database_name, username, password,
      ssl_mode, channel_binding, extra_json,
      last_test_status, last_test_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.name,
    row.type,
    row.db_type,
    row.icon,
    row.color,
    row.file_path,
    row.host,
    row.port,
    row.database_name,
    row.username,
    row.password,
    row.ssl_mode,
    row.channel_binding,
    row.extra_json,
    row.last_test_status,
    row.last_test_at,
    row.created_at,
    row.updated_at,
  );
  return row;
};

/** Cập nhật (partial) manager — field nào undefined sẽ bỏ qua. */
export const updateManager = (
  id: string,
  patch: Partial<DatabaseManagerInput> & {
    last_test_status?: string | null;
    last_test_at?: number | null;
  },
): DatabaseManagerRow | undefined => {
  const db = getManagersDb();
  const fields: string[] = [];
  const values: any[] = [];

  const setField = (col: string, value: any) => {
    fields.push(`${col} = ?`);
    values.push(value);
  };

  if (patch.name !== undefined) setField('name', patch.name);
  if (patch.type !== undefined) setField('type', patch.type);
  if (patch.db_type !== undefined) setField('db_type', patch.db_type);
  if (patch.icon !== undefined) setField('icon', patch.icon);
  if (patch.color !== undefined) setField('color', patch.color);
  if (patch.file_path !== undefined) setField('file_path', patch.file_path);
  if (patch.host !== undefined) setField('host', patch.host);
  if (patch.port !== undefined) setField('port', patch.port);
  if (patch.database_name !== undefined)
    setField('database_name', patch.database_name);
  if (patch.username !== undefined) setField('username', patch.username);
  if (patch.password !== undefined) setField('password', patch.password);
  if (patch.ssl_mode !== undefined) setField('ssl_mode', patch.ssl_mode);
  if (patch.channel_binding !== undefined)
    setField('channel_binding', patch.channel_binding);
  if (patch.extra_json !== undefined) setField('extra_json', patch.extra_json);
  if (patch.last_test_status !== undefined)
    setField('last_test_status', patch.last_test_status);
  if (patch.last_test_at !== undefined)
    setField('last_test_at', patch.last_test_at);

  if (fields.length === 0) return getManagerById(id);

  setField('updated_at', Date.now());

  db.prepare(
    `UPDATE database_managers SET ${fields.join(', ')} WHERE id = ?`,
  ).run(...values, id);

  return getManagerById(id);
};

/** Xóa manager. Trả về true nếu có row bị xóa. */
export const deleteManager = (id: string): boolean => {
  const db = getManagersDb();
  const result = db
    .prepare('DELETE FROM database_managers WHERE id = ?')
    .run(id);
  return result.changes > 0;
};