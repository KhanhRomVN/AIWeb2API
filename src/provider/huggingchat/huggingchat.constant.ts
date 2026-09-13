/**
 * ------------------------------------------------------------------
 * HuggingChat Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho HuggingChat provider.
 *
 * Main exports:
 * - PROVIDER_ID        : ID định danh provider
 * - PROVIDER_NAME      : Tên hiển thị
 * - IS_ENABLED         : Bật/tắt provider
 * - WEBSITE_URL        : URL website
 * - AUTH_METHOD        : Phương thức xác thực
 * - CONNECTION_TYPE    : Loại kết nối (https/browser)
 * - IS_PAUSABLE        : Hỗ trợ tạm dừng session
 * - IS_MEMORY          : Hỗ trợ bộ nhớ dài hạn
 * - BASE_URL           : Base URL của Hugging Face
 * - HUGGINGCHAT_EVENTS : Các event name dùng trong proxy handler
 * - USER_AGENT         : User-Agent string dùng chung
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'huggingchat';
export const PROVIDER_NAME = 'HuggingChat';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://huggingface.co/';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://huggingface.co';

export const HUGGINGCHAT_EVENTS = {
  COOKIES: 'hugging-chat-cookies',
  LOGIN_DATA: 'hugging-chat-login-data',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
