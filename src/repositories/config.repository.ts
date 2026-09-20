/**
 * ------------------------------------------------------------------
 * Config Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng `config` (single-row, id = 1). Lưu
 * đường dẫn hệ thống tới thư mục chứa profile Chromium.
 *
 * ĐÃ MIGRATE sang Kysely (async) — chạy được trên cả SQLite lẫn
 * Postgres thông qua `getDataStore()`. Mọi hàm trả Promise, caller
 * phải `await`.
 *
 * Main functions:
 * - getConfig()    : Lấy row config hiện tại (id = 1)
 * - updateConfig() : Cập nhật (partial) các field trong row config
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDataStore } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ConfigRow {
  id: number;
  chromium_profile_dir: string | null;
}

// ─── Queries ────────────────────────────────────────────────────────────

/**
 * Lấy row config hiện tại. Luôn trả về row (đã seed id=1 trong migration).
 */
export const getConfig = async (): Promise<ConfigRow> => {
  const db = getDataStore().kysely;
  const row = await db
    .selectFrom('config')
    .selectAll()
    .where('id', '=', 1)
    .executeTakeFirst();
  if (row) return row as ConfigRow;
  // Fallback phòng khi migration không kịp chạy (không nên xảy ra).
  await db
    .insertInto('config')
    .values({ id: 1 })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
  const created = await db
    .selectFrom('config')
    .selectAll()
    .where('id', '=', 1)
    .executeTakeFirst();
  return created as ConfigRow;
};

/**
 * Cập nhật (partial) các field của row config. Field nào undefined sẽ bị bỏ qua.
 * Truyền chuỗi rỗng '' để clear giá trị (lưu NULL).
 */
export const updateConfig = async (patch: {
  chromium_profile_dir?: string | null;
}): Promise<void> => {
  const db = getDataStore().kysely;

  const set: { chromium_profile_dir?: string | null } = {};
  if (patch.chromium_profile_dir !== undefined) {
    set.chromium_profile_dir =
      patch.chromium_profile_dir === '' ? null : patch.chromium_profile_dir;
  }

  if (Object.keys(set).length === 0) return;

  // Đảm bảo row id=1 tồn tại trước khi UPDATE.
  await db
    .insertInto('config')
    .values({ id: 1 })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db.updateTable('config').set(set).where('id', '=', 1).execute();
};