/**
 * ------------------------------------------------------------------
 * Config Database
 * ------------------------------------------------------------------
 * File SQLite riêng (`~/.aiweb2api/aiweb2api-config.sqlite`) chỉ chứa
 * bảng `config` (single-row). Tách khỏi aiweb2api-accounts.sqlite chính để
 * cấu hình toàn cục không bị ảnh hưởng bởi migration của DB chính.
 *
 * Main functions:
 * - initConfigDatabase() : Khởi tạo kết nối + chạy schema
 * - getConfigDb()        : Lấy instance đã khởi tạo
 * - resetConfigDb()      : Reset singleton (dùng khi reinitialize)
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

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ConfigDatabase');

let configDb: Database.Database | null = null;

// ─── Functions ──────────────────────────────────────────────────────────

/**
 * Khởi tạo kết nối tới `~/.aiweb2api/aiweb2api-config.sqlite` và chạy schema.
 * Idempotent — gọi nhiều lần cũng chỉ mở 1 kết nối.
 */
export const initConfigDatabase = (customPath?: string): void => {
  if (configDb) return;

  const basePath = path.join(os.homedir(), '.aiweb2api');
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const dbPath = customPath || path.join(basePath, 'aiweb2api-config.sqlite');

  try {
    configDb = new Database(dbPath, { timeout: 10000 });
    configDb.pragma('journal_mode = WAL');
    runConfigMigrations(configDb);
  } catch (err) {
    logger.error('Could not connect to config database', err);
    configDb = null;
    throw err;
  }
};

/**
 * Lấy instance config database. Throw nếu chưa khởi tạo.
 */
export const getConfigDb = (): Database.Database => {
  if (!configDb) {
    throw new Error('Config database not initialized');
  }
  return configDb;
};

/**
 * Reset singleton — dùng khi cần reinitialize sau khi phát hiện file corrupt.
 * @internal
 */
export const resetConfigDb = (): void => {
  try {
    configDb?.close();
  } catch (_) {}
  configDb = null;
};

/**
 * Schema cho bảng `config` (single-row, id luôn = 1).
 * - chromium_profile_dir     : system path tới thư mục chứa các profile Chromium.
 * - chromium_profile_subpath : relative path từ [profile_email]/ tới folder chứa Default/.
 *                              Rỗng/NULL = cấu trúc mặc định ([profile_email]/Default/).
 *                              Ví dụ: "chrome" hoặc "chromium".
 */
function runConfigMigrations(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        chromium_profile_dir TEXT
      )
    `);
    // Seed row id=1 nếu chưa có để GET luôn có dữ liệu trả về.
    db.prepare('INSERT OR IGNORE INTO config (id) VALUES (1)').run();

    // Migration: thêm cột chromium_profile_subpath nếu chưa có
    const cols = db.pragma('table_info(config)') as { name: string }[];
    const hasSubpath = cols.some((c) => c.name === 'chromium_profile_subpath');
    if (!hasSubpath) {
      db.exec('ALTER TABLE config ADD COLUMN chromium_profile_subpath TEXT');
    }
  } catch (err) {
    logger.error('Error initializing config table', err);
  }
}