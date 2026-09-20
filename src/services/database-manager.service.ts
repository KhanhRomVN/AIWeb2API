/**
 * ------------------------------------------------------------------
 * Database Manager Service
 * ------------------------------------------------------------------
 * Business logic cho database manager: CRUD + test connection.
 * Test connection chạy ở backend vì webview bị sandbox, không mở
 * được file/socket trực tiếp.
 *
 * Main functions:
 * - listDatabaseManagers()   : Lấy danh sách
 * - createDatabaseManager()  : Tạo mới (validate + test trước khi lưu)
 * - updateDatabaseManager()  : Sửa (validate + test trước khi lưu)
 * - deleteDatabaseManager()  : Xóa
 * - testDatabaseManager()    : Test connection / kiểm tra file path
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import crypto from 'crypto';

// ── Adapters ──
import { createAdapter } from '../database/adapters';
import type { DbType } from '../database/adapters';

// ── Repositories ──
import {
  listManagers,
  getManagerById,
  createManager,
  updateManager,
  deleteManager,
  type DatabaseManagerRow,
  type DatabaseManagerInput,
  type DatabaseManagerType,
} from '../repositories/database-manager.repository';

// ─── Types ──────────────────────────────────────────────────────────────

export interface TestResult {
  success: boolean;
  message: string;
}

// ─── Validation ─────────────────────────────────────────────────────────

const VALID_DB_TYPES: DbType[] = [
  'sqlite', 'postgres', 'mysql', 'mariadb', 'mssql', 'mongodb',
];

const validateInput = (input: Partial<DatabaseManagerInput>): string | null => {
  if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
    return 'name is required';
  }
  if (input.type !== 'local-file' && input.type !== 'connection') {
    return "type must be 'local-file' or 'connection'";
  }
  if (!input.db_type || !VALID_DB_TYPES.includes(input.db_type)) {
    return `db_type must be one of: ${VALID_DB_TYPES.join(', ')}`;
  }
  if (input.type === 'local-file') {
    if (!input.file_path || typeof input.file_path !== 'string') {
      return 'file_path is required for local-file type';
    }
  } else if (input.type === 'connection') {
    if (!input.host || typeof input.host !== 'string') {
      return 'host is required for connection type';
    }
    if (input.db_type !== 'mongodb' && (!input.database_name || typeof input.database_name !== 'string')) {
      return 'database_name is required for connection type';
    }
  }
  return null;
};

// ─── Test Connection ────────────────────────────────────────────────────

/**
 * Test kết nối thực sự thông qua adapter tương ứng với db_type.
 */
export const testConnection = async (
  input: Partial<DatabaseManagerInput>,
): Promise<TestResult> => {
  if (!input.db_type || !VALID_DB_TYPES.includes(input.db_type as DbType)) {
    return { success: false, message: `Invalid db_type: ${input.db_type}` };
  }

  try {
    const adapter = createAdapter({
      db_type: input.db_type as DbType,
      file_path: input.file_path,
      host: input.host,
      port: input.port,
      database_name: input.database_name,
      username: input.username,
      password: input.password,
      ssl_mode: input.ssl_mode,
      extra_json: input.extra_json,
    });
    return await adapter.testConnection();
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'Adapter init failed' };
  }
};

// ─── CRUD ───────────────────────────────────────────────────────────────

/** Trả về toàn bộ manager. */
export const listDatabaseManagers = (): DatabaseManagerRow[] => {
  return listManagers();
};

/**
 * Tạo manager mới. Bắt buộc test thành công trước khi lưu (per requirement).
 */
export const createDatabaseManager = async (
  input: DatabaseManagerInput,
): Promise<{ row?: DatabaseManagerRow; error?: string; status: number }> => {
  const validationError = validateInput(input);
  if (validationError) return { error: validationError, status: 400 };

  const test = await testConnection(input);
  if (!test.success) {
    return { error: `Connection test failed: ${test.message}`, status: 422 };
  }

  const now = Date.now();
  const row: DatabaseManagerRow = {
    id: crypto.randomUUID(),
    name: input.name,
    type: input.type,
    db_type: input.db_type,
    icon: input.icon ?? null,
    color: input.color ?? null,
    file_path: input.file_path ?? null,
    host: input.host ?? null,
    port: input.port ?? null,
    database_name: input.database_name ?? null,
    username: input.username ?? null,
    password: input.password ?? null,
    ssl_mode: input.ssl_mode ?? null,
    channel_binding: input.channel_binding ?? null,
    extra_json: input.extra_json ?? null,
    last_test_status: 'success',
    last_test_at: now,
    created_at: now,
    updated_at: now,
  };
  createManager(row);
  return { row, status: 201 };
};

/**
 * Cập nhật manager. Nếu patch thay đổi field liên quan tới kết nối
 * (host/type/file_path/...), bắt buộc test lại phải thành công.
 */
export const updateDatabaseManager = async (
  id: string,
  patch: Partial<DatabaseManagerInput>,
): Promise<{ row?: DatabaseManagerRow; error?: string; status: number }> => {
  const existing = getManagerById(id);
  if (!existing) return { error: 'Not found', status: 404 };

  const merged: DatabaseManagerInput = {
    name: patch.name ?? existing.name,
    type: (patch.type ?? existing.type) as DatabaseManagerType,
    db_type: (patch.db_type ?? existing.db_type) as DbType,
    icon: patch.icon ?? existing.icon,
    color: patch.color ?? existing.color,
    file_path: patch.file_path ?? existing.file_path,
    host: patch.host ?? existing.host,
    port: patch.port ?? existing.port,
    database_name: patch.database_name ?? existing.database_name,
    username: patch.username ?? existing.username,
    password: patch.password ?? existing.password,
    ssl_mode: patch.ssl_mode ?? existing.ssl_mode,
    channel_binding: patch.channel_binding ?? existing.channel_binding,
    extra_json: patch.extra_json ?? existing.extra_json,
  };

  const validationError = validateInput(merged);
  if (validationError) return { error: validationError, status: 400 };

  const test = await testConnection(merged);
  if (!test.success) {
    return { error: `Connection test failed: ${test.message}`, status: 422 };
  }

  const row = updateManager(id, {
    ...patch,
    last_test_status: 'success',
    last_test_at: Date.now(),
  });
  return { row, status: 200 };
};

/** Xóa manager. */
export const deleteDatabaseManager = (
  id: string,
): { success: boolean; status: number } => {
  const existed = getManagerById(id);
  if (!existed) return { success: false, status: 404 };
  deleteManager(id);
  return { success: true, status: 200 };
};

/** Test connection không lưu — dùng cho nút "Test" trong form. */
export const testDatabaseManager = async (
  input: Partial<DatabaseManagerInput>,
): Promise<{ result: TestResult; status: number }> => {
  const result = await testConnection(input);
  return { result, status: result.success ? 200 : 422 };
};