/**
 * ------------------------------------------------------------------
 * Qwen Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Qwen provider.
 *
 * Main exports:
 * - PROVIDER_ID    : ID định danh provider
 * - PROVIDER_NAME  : Tên hiển thị
 * - IS_ENABLED     : Bật/tắt provider
 * - WEBSITE_URL    : URL website
 * - AUTH_METHOD    : Phương thức xác thực
 * - CONNECTION_TYPE: Loại kết nối (https/browser)
 * - IS_PAUSABLE    : Hỗ trợ tạm dừng session
 * - IS_MEMORY      : Hỗ trợ bộ nhớ dài hạn
 * - BASE_URL       : Base URL của Qwen chat
 * - QWEN_EVENTS    : Các event name dùng trong proxy handler
 * - USER_AGENT     : User-Agent string dùng chung
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'qwen';
export const PROVIDER_NAME = 'Qwen';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://modelscope.cn/';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = true;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://chat.qwen.ai';

export const QWEN_EVENTS = {
  COOKIES: 'qwen-cookies',
  HEADERS: 'qwen-headers',
  LOGIN_TOKEN: 'qwen-login-token',
  LOGIN_EMAIL: 'qwen-login-email',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

export const API_VERSION = '0.2.91';
export const BX_VERSION = '2.5.37';
