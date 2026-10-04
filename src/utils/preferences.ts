/**
 * ------------------------------------------------------------------
 * Preferences
 * ------------------------------------------------------------------
 * Lưu và đọc các tuỳ chọn người dùng (port đã chọn lần trước, v.v.)
 * vào `~/.aiweb2api/preferences.json`.
 * Sử dụng JSON đơn giản thay vì SQLite để available trước khi DB init.
 *
 * Main functions:
 * - loadPreferences()  : Đọc file, trả về object (hoặc {} nếu chưa có)
 * - savePreferences()  : Ghi toàn bộ object xuống file
 * - getLastPort()      : Lấy port đã lưu (trả về undefined nếu chưa có)
 * - saveLastPort()     : Lưu port vừa chọn
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Paths ──────────────────────────────────────────────────────────────

const PREFS_DIR  = path.join(os.homedir(), '.aiweb2api');
const PREFS_FILE = path.join(PREFS_DIR, 'preferences.json');

// ─── Types ──────────────────────────────────────────────────────────────

export interface Preferences {
  /** Port được chọn lần cuối qua Welcome UI. */
  lastPort?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function loadPreferences(): Preferences {
  try {
    if (!fs.existsSync(PREFS_FILE)) return {};
    const raw = fs.readFileSync(PREFS_FILE, 'utf8');
    return JSON.parse(raw) as Preferences;
  } catch {
    return {};
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    if (!fs.existsSync(PREFS_DIR)) {
      fs.mkdirSync(PREFS_DIR, { recursive: true });
    }
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), 'utf8');
  } catch {
    // Lỗi ghi file không được crash app
  }
}

export function getLastPort(): number | undefined {
  return loadPreferences().lastPort;
}

/**
 * Lưu port chỉ khi người dùng đã nhập tường minh (khác với default).
 * @param port Port người dùng chọn
 * @param defaultPort Port mặc định ban đầu
 */
export function saveLastPort(port: number, defaultPort: number): void {
  const prefs = loadPreferences();
  if (port !== defaultPort || prefs.lastPort !== undefined) {
    prefs.lastPort = port;
    savePreferences(prefs);
  }
}
