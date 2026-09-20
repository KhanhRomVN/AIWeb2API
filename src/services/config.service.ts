/**
 * ------------------------------------------------------------------
 * Config Service
 * ------------------------------------------------------------------
 * Business logic cho bảng cấu hình toàn cục. Hiện chỉ wrap repository
 * và validate nhẹ input từ controller.
 *
 * Main functions:
 * - getAppConfig()    : Lấy config hiện tại
 * - setAppConfig()    : Cập nhật config (partial)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Repositories ──
import {
  getConfig,
  updateConfig,
  type ConfigRow,
} from '../repositories/config.repository';

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Lấy config hiện tại từ DB.
 */
export async function getAppConfig(): Promise<ConfigRow> {
  return getConfig();
}

/**
 * Cập nhật (partial) config. Chỉ nhận `chromium_profile_dir`; các field khác bị bỏ qua.
 * Trả về config sau khi cập nhật.
 */
export async function setAppConfig(patch: {
  chromium_profile_dir?: string | null;
}): Promise<ConfigRow> {
  await updateConfig({
    chromium_profile_dir: patch.chromium_profile_dir,
  });
  return getConfig();
}
