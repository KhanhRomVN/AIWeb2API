/**
 * ------------------------------------------------------------------
 * Managers Database
 * ------------------------------------------------------------------
 * File SQLite riêng (`~/.aiweb2api/database-managers.sqlite`) lưu cấu hình các
 * database manager do user tạo trong Settings > General. Tách khỏi
 * database.sqlite chính để tránh migration phá vỡ dữ liệu quản lý.
 *
 * Main functions:
 * - initManagersDatabase()  : Khởi t��o kết nối + chạy schema
 * - getManagersDb()         : Lấy instance đã khởi tạo
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ── Utils ──
import { createLogger } from '../utils/logger';

const logger = createLogger('ManagersDatabase');

let managersDb: Database.Database | null = null;

/**
 * Khởi tạo kết nối tới `~/.aiweb2api/managers.sqlite` và chạy schema.
 * Idempotent — gọi nhiều lần cũng chỉ mở 1 kết nối.
 */
export const initManagersDatabase = (customPath?: string): void => {
  if (managersDb) return;

  const basePath = path.join(os.homedir(), '.aiweb2api');
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const dbPath = customPath || path.join(basePath, 'database-managers.sqlite');

  try {
    managersDb = new Database(dbPath, { timeout: 10000 });
    managersDb.pragma('journal_mode = WAL');
    runManagersMigrations(managersDb);
  } catch (err) {
    logger.error('Could not connect to managers database', err);
    managersDb = null;
    throw err;
  }
};

/**
 * Lấy instance managers database. Throw nếu chưa khởi tạo.
 */
export const getManagersDb = (): Database.Database => {
  if (!managersDb) {
    throw new Error('Managers database not initialized');
  }
  return managersDb;
};

/**
 * Reset singleton — dùng bởi integrity check khi cần reinitialize
 * sau khi phát hiện file corrupt.
 * @internal
 */
export const resetManagersDb = (): void => {
  try { managersDb?.close(); } catch (_) {}
  managersDb = null;
};

/**
 * Schema cho bảng `database_managers`.
 *
 * `type` quyết định bộ field có nghĩa:
 * - `local-file` : dùng `file_path`, các field connection = NULL
 * - `connection` : dùng host/port/database_name/username/password/...
 *
 * Field lạ (nếu provider bổ sung) đẩy vào `extra_json` dạng JSON string.
 */
function runManagersMigrations(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS database_managers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('local-file', 'connection')),
        db_type TEXT NOT NULL DEFAULT 'sqlite',
        icon TEXT,
        color TEXT,
        file_path TEXT,
        host TEXT,
        port INTEGER,
        database_name TEXT,
        username TEXT,
        password TEXT,
        ssl_mode TEXT,
        channel_binding TEXT,
        extra_json TEXT,
        last_test_status TEXT,
        last_test_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Migration: thêm db_type nếu bảng đã tồn tại từ phiên bản cũ
    const cols = (db.pragma('table_info(database_managers)') as any[]).map(
      (c) => c.name,
    );
    if (!cols.includes('db_type')) {
      db.exec(
        "ALTER TABLE database_managers ADD COLUMN db_type TEXT NOT NULL DEFAULT 'sqlite'",
      );
      // Retroactively: manager nào có file_path → sqlite, còn lại → postgres
      db.exec(`
        UPDATE database_managers
        SET db_type = CASE
          WHEN type = 'local-file' THEN 'sqlite'
          ELSE 'postgres'
        END
        WHERE db_type = 'sqlite' AND type = 'connection'
      `);
    }

    // Seed record mặc định cho aiweb2api.sqlite.
    // Dùng id cố định để INSERT OR IGNORE không tạo duplicate khi restart.
    const now = Date.now();
    const aiweb2apiDbPath = require('path').join(
      require('os').homedir(),
      '.aiweb2api',
      'aiweb2api.sqlite',
    );
    db.prepare(`
      INSERT OR IGNORE INTO database_managers
        (id, name, type, db_type, file_path, created_at, updated_at)
      VALUES
        ('__aiweb2api_default__', 'AIWeb2API', 'local-file', 'sqlite', ?, ?, ?)
    `).run(aiweb2apiDbPath, now, now);
  } catch (err) {
    logger.error('Error initializing database_managers table', err);
  }
}