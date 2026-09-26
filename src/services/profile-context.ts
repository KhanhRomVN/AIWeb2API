/**
 * ------------------------------------------------------------------
 * Profile Context
 * ------------------------------------------------------------------
 * Mang thư mục profile Chromium (userDataDir) từ login controller xuống
 * CDPService.launchBrowser() mà không cần sửa signature của từng provider.
 *
 * Main functions:
 * - loginContext                : AsyncLocalStorage giữ userDataDir cho 1 lần login
 * - resolveProfileUserDataDir() : Ghép chromium_profile_dir + tên folder, chặn path traversal
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { AsyncLocalStorage } from 'async_hooks';
import * as fs from 'fs';
import * as path from 'path';

// ── Services ──
import { getAppConfig } from './config.service';

// ─── Constants ──────────────────────────────────────────────────────────

/** Context của 1 lần login; `userDataDir` undefined = dùng profile tạm mới. */
export const loginContext = new AsyncLocalStorage<{ userDataDir?: string }>();

// ─── Types ──────────────────────────────────────────────────────────────

export interface ResolvedProfile {
  /** Đường dẫn tuyệt đối tới folder profile. Undefined nếu không chọn profile. */
  dir?: string;
  /** Thông báo lỗi nếu profile_folder không hợp lệ. */
  error?: string;
}

// ─── Functions ──────────────────────────────────────────────────────────

/**
 * Ghép `chromium_profile_dir` (từ config) với tên folder do client gửi.
 * Chỉ nhận tên folder cấp 1: từ chối `/`, `\`, `..`, ký tự null, và
 * đường dẫn sau khi resolve phải nằm trực tiếp dưới `chromium_profile_dir`.
 * Không truyền profile_folder → trả `{}` (hành vi login mặc định).
 */
export async function resolveProfileUserDataDir(
  profileFolder: unknown,
): Promise<ResolvedProfile> {
  if (profileFolder === undefined || profileFolder === null || profileFolder === '') {
    return {};
  }
  if (typeof profileFolder !== 'string') {
    return { error: 'profile_folder must be a string' };
  }

  const name = profileFolder.trim();
  if (!name || name === '.' || name.includes('..') || /[\\/\0]/.test(name)) {
    return { error: 'Invalid profile_folder' };
  }

  const { chromium_profile_dir } = await getAppConfig();
  if (!chromium_profile_dir) {
    return { error: 'chromium_profile_dir is not configured' };
  }

  const base = path.resolve(chromium_profile_dir);
  const target = path.resolve(base, name);
  if (path.dirname(target) !== base) {
    return { error: 'Invalid profile_folder' };
  }

  try {
    if (!fs.statSync(target).isDirectory()) {
      return { error: 'Profile folder does not exist' };
    }
  } catch {
    return { error: 'Profile folder does not exist' };
  }

  return { dir: target };
}