/**
 * ------------------------------------------------------------------
 * Database Integrity Check
 * ------------------------------------------------------------------
 * Chạy SAU khi cả initDatabase() và initManagersDatabase() hoàn thành.
 * Phát hiện và tự phục hồi các trạng thái bất nhất phổ biến:
 *
 * [C1] database-managers.sqlite bị xóa/mất
 *      → better-sqlite3 đã tự tạo lại file + schema khi init.
 *        Ở đây: đảm bảo seed record __aiweb2api_default__ tồn tại
 *        và file_path khớp với aiweb2api.sqlite thực tế.
 *
 * [C2] aiweb2api.sqlite bị xóa nhưng record vẫn còn trong managers
 *      → initDatabase() đã tạo lại file + schema tự động (better-sqlite3).
 *        Ở đây: cập nhật last_test_status của record thành 'recovered'
 *        để UI biết file vừa được tạo lại.
 *
 * [C3] Cả hai file đều bị xóa
 *      → Cả hai init đã tạo lại. Ở đây: re-seed record mặc định.
 *
 * [C4] Record __aiweb2api_default__ bị user xóa thủ công
 *      → Re-seed nếu aiweb2api.sqlite tồn tại.
 *
 * [C5] file_path trong record __aiweb2api_default__ không khớp path thực
 *      (user đổi HOME, di chuyển folder, v.v.)
 *      → Cập nhật file_path về path chuẩn.
 *
 * [C6] database-managers.sqlite bị corrupt (không phải SQLite hợp lệ)
 *      → Backup file corrupt, tạo lại từ đầu + re-seed.
 *
 * [C7] Các record local-file trỏ tới file không tồn tại (ngoài aiweb2api)
 *      → Đánh dấu last_test_status = 'file_missing', KHÔNG xóa record
 *        (user có thể muốn restore file đó).
 *
 * [C8] Không có quyền đọc/ghi file
 *      → Log warning rõ ràng, không crash app.
 *
 * ------------------------------------------------------------------
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createLogger } from '../utils/logger';
import {
  getManagersDb,
  initManagersDatabase,
  resetManagersDb,
} from './managers';

const logger = createLogger('DBIntegrity');

// Path cố định của hai file chính
const BASE_DIR = path.join(os.homedir(), '.aiweb2api');
const AIWEB2API_DB_PATH = path.join(BASE_DIR, 'aiweb2api.sqlite');
const MANAGERS_DB_PATH = path.join(BASE_DIR, 'database-managers.sqlite');
const DEFAULT_RECORD_ID = '__aiweb2api_default__';

// ─── Helpers ────────────────────────────────────────────────────────────

/** Kiểm tra file tồn tại và có quyền đọc. */
function fileAccessible(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** Kiểm tra file có phải SQLite hợp lệ không (magic bytes). */
function isSqliteFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    // SQLite magic header: "SQLite format 3\000"
    return buf.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch {
    return false;
  }
}

/** Backup file bị corrupt với timestamp suffix. */
function backupCorrupt(filePath: string): void {
  try {
    const backupPath = `${filePath}.corrupt_${Date.now()}`;
    fs.renameSync(filePath, backupPath);
    logger.warn(`[C6] Backed up corrupt file: ${filePath} → ${backupPath}`);
  } catch (e) {
    logger.warn(`[C6] Could not backup corrupt file ${filePath}`, e);
  }
}

/** Upsert seed record mặc định vào managers db. */
function upsertDefaultRecord(db: Database.Database, now: number): void {
  db.prepare(
    `
    INSERT INTO database_managers
      (id, name, type, db_type, file_path, last_test_status, last_test_at, created_at, updated_at)
    VALUES
      (?, 'AIWeb2API', 'local-file', 'sqlite', ?, 'success', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      file_path        = excluded.file_path,
      last_test_status = excluded.last_test_status,
      last_test_at     = excluded.last_test_at,
      updated_at       = excluded.updated_at
  `,
  ).run(DEFAULT_RECORD_ID, AIWEB2API_DB_PATH, now, now, now);
}

// ─── Main Check ─────────────────────────────────────────────────────────

export function runIntegrityCheck(): void {
  if (fs.existsSync(MANAGERS_DB_PATH) && !isSqliteFile(MANAGERS_DB_PATH)) {
    logger.error('[C6] database-managers.sqlite is corrupt. Recreating...');
    backupCorrupt(MANAGERS_DB_PATH);

    // Reinitialize managers database từ đầu
    resetManagersDb();
    initManagersDatabase();
  }

  // Từ đây getManagersDb() luôn hợp lệ
  let db: Database.Database;
  try {
    db = getManagersDb();
  } catch (e) {
    logger.error('Cannot get managers db for integrity check', e);
    return;
  }

  const now = Date.now();

  // ── [C1][C3][C4] Kiểm tra và khôi phục seed record mặc định ────────────
  const defaultRecord = db
    .prepare('SELECT * FROM database_managers WHERE id = ?')
    .get(DEFAULT_RECORD_ID) as any | undefined;

  if (!defaultRecord) {
    // [C1] managers.sqlite vừa được tạo lại (mất toàn bộ data)
    // [C3] Cả hai file bị xóa
    // [C4] User xóa record này thủ công
    logger.warn(`[C1/C3/C4] Default record missing. Re-seeding...`);
    upsertDefaultRecord(db, now);
  } else {
    // ── [C5] file_path trong record không khớp path chuẩn ─────────────────
    if (defaultRecord.file_path !== AIWEB2API_DB_PATH) {
      logger.warn(
        `[C5] Default record file_path mismatch. Expected: ${AIWEB2API_DB_PATH}, Got: ${defaultRecord.file_path}. Correcting...`,
      );
      db.prepare(
        'UPDATE database_managers SET file_path = ?, updated_at = ? WHERE id = ?',
      ).run(AIWEB2API_DB_PATH, now, DEFAULT_RECORD_ID);
    }

    // ── [C2] aiweb2api.sqlite bị xóa rồi được tạo lại bởi initDatabase() ─
    // better-sqlite3 tạo file mới → file tồn tại nhưng last_test_status
    // có thể là cũ. Đánh dấu 'recovered' để UI biết.
    if (
      defaultRecord.last_test_status !== 'success' &&
      fs.existsSync(AIWEB2API_DB_PATH)
    ) {
      db.prepare(
        `UPDATE database_managers
         SET last_test_status = 'success', last_test_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(now, now, DEFAULT_RECORD_ID);
    }
  }

  // ── [C2] Trường hợp aiweb2api.sqlite không tồn tại dù record có ─────────
  // Điều này không nên xảy ra vì initDatabase() luôn tạo file.
  // Nhưng nếu initDatabase() chưa chạy (customPath scenario), handle ở đây.
  if (!fs.existsSync(AIWEB2API_DB_PATH)) {
    logger.warn(
      '[C2] aiweb2api.sqlite does not exist. Marking record as file_missing.',
    );
    db.prepare(
      `UPDATE database_managers
       SET last_test_status = 'file_missing', last_test_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(now, now, DEFAULT_RECORD_ID);
  }

  // ── [C7] Các record local-file khác trỏ tới file không tồn tại ──────────
  type ManagerRow = {
    id: string;
    name: string;
    file_path: string | null;
    last_test_status: string | null;
  };
  const localFileRecords = db
    .prepare(
      `SELECT id, name, file_path, last_test_status
       FROM database_managers
       WHERE type = 'local-file' AND id != ?`,
    )
    .all(DEFAULT_RECORD_ID) as ManagerRow[];

  const updateStatus = db.prepare(
    `UPDATE database_managers
     SET last_test_status = ?, last_test_at = ?, updated_at = ?
     WHERE id = ?`,
  );

  for (const record of localFileRecords) {
    if (!record.file_path) continue;

    const exists = fs.existsSync(record.file_path);
    const wasOk =
      record.last_test_status === 'success' || record.last_test_status === null;

    if (!exists && wasOk) {
      logger.warn(
        `[C7] local-file record "${record.name}" (${record.id}): file missing at ${record.file_path}. Marking as file_missing.`,
      );
      updateStatus.run('file_missing', now, now, record.id);
    } else if (exists && record.last_test_status === 'file_missing') {
      updateStatus.run('success', now, now, record.id);
    }
  }

  // ── [C8] Permission check cho BASE_DIR ────────────────────────────────
  try {
    fs.accessSync(BASE_DIR, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    logger.warn(
      `[C8] No read/write permission on ${BASE_DIR}. Some features may not work correctly.`,
    );
  }
}
