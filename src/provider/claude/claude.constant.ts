/**
 * ------------------------------------------------------------------
 * Claude Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Claude provider.
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
 * - BASE_URL            : Base URL của Claude AI
 * - CLAUDE_EVENTS       : Các event name dùng trong proxy handler
 * - USER_AGENT          : User-Agent string dùng chung
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'claude';
export const PROVIDER_NAME = 'Claude';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://claude.ai/';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    description:
      "Anthropic's Claude Sonnet 4.5 - Balanced performance for everyday tasks with strong reasoning and image understanding",
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    description:
      "Anthropic's Claude Haiku 4.5 - Fast, compact model optimized for low-latency responses and efficient processing",
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    description:
      "Anthropic's Claude Sonnet 4.6 - Enhanced version with improved accuracy and broader knowledge base",
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://claude.ai';

export const CLAUDE_EVENTS = {
  AUTH_HEADER: 'claude-auth-header',
  LOGIN_EMAIL: 'claude-login-email',
  LOGIN_TOKEN: 'claude-login-token',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

export const GOOGLE_OAUTH_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://claude.ai/login';

export const API_PATHS = {
  PROFILE: '/api/auth/me',
  CHAT: '/api/chat',
} as const;