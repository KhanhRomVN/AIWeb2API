/**
 * ------------------------------------------------------------------
 * Mistral Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Mistral provider.
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
 * - BASE_URL       : Base URL của Mistral console
 * - CHAT_BASE_URL  : Base URL của Mistral chat
 * - AUTH_LOGIN_URL : URL login
 * - MISTRAL_EVENTS : Các event name dùng trong proxy handler
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'mistral';
export const PROVIDER_NAME = 'Mistral';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://mistral.ai/';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://console.mistral.ai';
export const CHAT_BASE_URL = 'https://chat.mistral.ai';
export const AUTH_LOGIN_URL = 'https://auth.mistral.ai/ui/login';

export const MISTRAL_EVENTS = {
  COOKIES: 'mistral-cookies',
} as const;
