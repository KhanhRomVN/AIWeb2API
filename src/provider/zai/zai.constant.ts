/**
 * ------------------------------------------------------------------
 * Z.AI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Z.AI provider.
 *
 * Main exports:
 * - PROVIDER_ID         : ID định danh provider
 * - PROVIDER_NAME       : Tên hiển thị
 * - IS_ENABLED          : Bật/tắt provider
 * - WEBSITE_URL         : URL website
 * - AUTH_METHOD         : Phương thức xác thực
 * - CONNECTION_TYPE     : Loại kết nối (https/browser)
 * - IS_PAUSABLE         : Hỗ trợ tạm dừng session
 * - IS_MEMORY           : Hỗ trợ bộ nhớ dài hạn
 * - BASE_URL            : Base URL của Z.AI chat
 * - ZAI_EVENTS          : Các event name dùng trong proxy handler
 * - DEFAULT_USER_AGENT  : User-Agent mặc định
 * - SALT                : Salt cho signature generation
 * - FE_VERSION          : Frontend version header
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'z';
export const PROVIDER_NAME = 'Z';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://chat.z.ai/';
export const AUTH_METHOD = ['google', 'basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://chat.z.ai';

export const ZAI_EVENTS = {
  TOKEN: 'zai-token',
  LOGIN_EMAIL: 'zai-login-email',
} as const;

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const SALT = 'key-@@@@)))()((9))-xxxx&&&%%%%%';

export const FE_VERSION = 'prod-fe-1.1.35';
