/**
 * ------------------------------------------------------------------
 * Groq Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Groq provider.
 *
 * Main exports:
 * - PROVIDER_ID               : ID định danh provider
 * - PROVIDER_NAME             : Tên hiển thị
 * - IS_ENABLED                : Bật/tắt provider
 * - WEBSITE_URL               : URL website
 * - AUTH_METHOD               : Phương thức xác thực
 * - CONNECTION_TYPE           : Loại kết nối (https/browser)
 * - IS_PAUSABLE               : Hỗ trợ tạm dừng session
 * - IS_MEMORY                 : Hỗ trợ bộ nhớ dài hạn
 * - BASE_URL                  : Base URL của Groq console
 * - API_BASE_URL              : Base URL của Groq API
 * - API_CHAT_COMPLETIONS_URL  : URL chat completion
 * - API_MODELS_URL            : URL lấy danh sách models
 * - SESSION_COOKIE_NAME       : Tên session cookie
 * - GROQ_EVENTS               : Các event name dùng trong proxy handler
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'groq';
export const PROVIDER_NAME = 'Groq';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://groq.com';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://console.groq.com';
export const API_BASE_URL = 'https://api.groq.com';

export const API_CHAT_COMPLETIONS_URL = `${API_BASE_URL}/openai/v1/chat/completions`;
export const API_MODELS_URL = `${API_BASE_URL}/internal/v1/models`;

export const SESSION_COOKIE_NAME = 'stytch_session_jwt';

export const GROQ_EVENTS = {
  COOKIES: 'groq-cookies',
} as const;
