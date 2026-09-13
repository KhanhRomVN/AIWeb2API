/**
 * ------------------------------------------------------------------
 * DeepSeek Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho DeepSeek provider.
 *
 * Main exports:
 * - PROVIDER_ID         : ID định danh provider
 * - PROVIDER_NAME       : Tên hiển thị
 * - IS_ENABLED          : Bật/tắt provider
 * - WEBSITE_URL         : URL website
 * - AUTH_METHOD         : Phương thức xác thực
 * - CONNECTION_TYPE     : Loại kết nối (https/browser)
 * - MODELS              : Danh sách models hỗ trợ
 * - IS_PAUSABLE         : Hỗ trợ tạm dừng session
 * - IS_MEMORY           : Hỗ trợ bộ nhớ dài hạn
 * - BASE_URL            : Base URL của DeepSeek API
 * - DEEPSEEK_EVENTS     : Các event name dùng trong proxy handler
 * - MAX_CONTINUATIONS   : Số lần auto-continue tối đa
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'deepseek';
export const PROVIDER_NAME = 'DeepSeek';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://deepseek.com';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = true;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'deepseek-instant',
    name: 'DeepSeek Instant',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_larger_content_paste_upload: true,
    description:
      'DeepSeek Instant - Fast responses with web search capability and image understanding, supports thinking mode',
  },
  {
    id: 'deepseek-vision',
    name: 'DeepSeek Vision',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_larger_content_paste_upload: true,
    description:
      'DeepSeek Vision - Specialized vision model for image understanding and multimodal tasks',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://chat.deepseek.com';

export const DEEPSEEK_EVENTS = {
  AUTH_HEADER: 'deepseek-auth-header',
  LOGIN_EMAIL: 'deepseek-login-email',
  LOGIN_TOKEN: 'deepseek-login-token',
  GOOGLE_EMAIL: 'deepseek-google-email',
  USER_INFO: 'deepseek-user-info',
} as const;

export const MAX_CONTINUATIONS = 10;

export const GOOGLE_OAUTH_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://chat.deepseek.com/login';
