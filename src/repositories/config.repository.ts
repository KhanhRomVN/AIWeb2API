/**
 * ------------------------------------------------------------------
 * Config Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng `config` (single-row, id = 1). Lưu
 * đường dẫn hệ thống tới thư mục chứa profile Chromium.
 *
 * Bảng `config` nằm trong file SQLite riêng (aiweb2api-config.sqlite),
 * truy cập trực tiếp qua better-sqlite3 (không đi qua Kysely/DataStore).
 * Các hàm vẫn trả Promise để giữ nguyên chữ ký cho caller.
 *
 * Main functions:
 * - getConfig()    : Lấy row config hiện tại (id = 1)
 * - updateConfig() : Cập nhật (partial) các field trong row config
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getConfigDb } from '../database/config-db';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ConfigRow {
  id: number;
  chromium_profile_dir: string | null;
  /** Relative path từ [profile_email]/ tới folder chứa Default/. NULL/rỗng = mặc định. */
  chromium_profile_subpath: string | null;
}

// ─── Queries ────────────────────────────────────────────────────────────

/**
 * Lấy row config hiện tại. Luôn trả về row (đã seed id=1 khi init).
 */
export const getConfig = async (): Promise<ConfigRow> => {
  const db = getConfigDb();
  const row = db
    .prepare('SELECT id, chromium_profile_dir, chromium_profile_subpath FROM config WHERE id = 1')
    .get() as ConfigRow | undefined;
  if (row) return row;
  // Fallback phòng khi seed không kịp chạy (không nên xảy ra).
  db.prepare('INSERT OR IGNORE INTO config (id) VALUES (1)').run();
  return db
    .prepare('SELECT id, chromium_profile_dir, chromium_profile_subpath FROM config WHERE id = 1')
    .get() as ConfigRow;
};

/**
 * Cập nhật (partial) các field của row config. Field nào undefined sẽ bị bỏ qua.
 * Truyền chuỗi rỗng '' để clear giá trị (lưu NULL).
 */
export const updateConfig = async (patch: {
  chromium_profile_dir?: string | null;
  chromium_profile_subpath?: string | null;
}): Promise<void> => {
  const db = getConfigDb();

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (patch.chromium_profile_dir !== undefined) {
    updates.push('chromium_profile_dir = ?');
    values.push(patch.chromium_profile_dir === '' ? null : patch.chromium_profile_dir);
  }

  if (patch.chromium_profile_subpath !== undefined) {
    updates.push('chromium_profile_subpath = ?');
    values.push(patch.chromium_profile_subpath === '' ? null : patch.chromium_profile_subpath);
  }

  if (updates.length === 0) return;

  // Đảm bảo row id=1 tồn tại trước khi UPDATE.
  db.prepare('INSERT OR IGNORE INTO config (id) VALUES (1)').run();
  db.prepare(`UPDATE config SET ${updates.join(', ')} WHERE id = 1`).run(...values);
};