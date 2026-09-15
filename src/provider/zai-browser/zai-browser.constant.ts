/**
 * ------------------------------------------------------------------
 * Z.AI Browser Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Z.AI Browser provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD              : Danh sách auth method
 * - ZAI_BROWSER_AUTH_METHODS : Google / Basic auth literals
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - PLATFORM                 : Platform type (web)
 * - BROWSER_EXTENSION_FOLDER : Folder chứa browser extension
 * - MODELS                   : Danh sách models hỗ trợ
 * - BASE_URL                 : Base URL của Z.AI chat
 * - ZAI_BROWSER_EVENTS       : Event names dùng trong proxy handler
 * - MAX_CONTINUATIONS        : Số lần auto-continue tối đa
 * - HISTORY_MESSAGES_COUNT   : Số lượng message history
 * - SUCCESS_CODE             : Success code cho API response
 * - HOSTS                    : Host names
 * - REFERER_PATHS            : Referer path patterns
 * - REGEX_PATTERNS           : Regex patterns cho parsing
 * - WEBSOCKET_CONFIG         : WebSocket connection config
 * - CONTENT_TAG_PATTERN      : Pattern cho zen-user-content tag
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'zai-browser';
export const PROVIDER_NAME = 'ZAI-Browser';
export const PROVIDER_DESCRIPTION = 'GLM models via browser automation with thinking mode';
export const PROVIDER_COLOR = '#7C3AED';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://chat.z.ai/';
export const AUTH_METHOD = ['google', 'basic'] as const;
export const CONNECTION_TYPE = 'browser';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;
export const PLATFORM = 'web';
export const BROWSER_EXTENSION_FOLDER = 'zai-bridge';

export const MODELS = [
  {
    id: 'GLM-5.1',
    name: 'GLM-5.1',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'Z.AI GLM-5.1 - Advanced language model with thinking mode and web search (browser-based)',
  },
  {
    id: 'GLM-5',
    name: 'GLM-5',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'Z.AI GLM-5 - Fast and efficient model with thinking capabilities (browser-based)',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://chat.z.ai';

export const ZAI_BROWSER_EVENTS = {
  TOKEN: 'zai-browser-token',
  LOGIN_EMAIL: 'zai-browser-login-email',
} as const;

export const MAX_CONTINUATIONS = 10;
export const HISTORY_MESSAGES_COUNT = 20;
export const SUCCESS_CODE = 0;

// ─── Auth Methods ────────────────────────────────────────────────────

export const ZAI_BROWSER_AUTH_METHODS = {
  GOOGLE: 'google',
  BASIC: 'basic',
} as const;

// ─── Hosts ───────────────────────────────────────────────────────────

export const HOSTS = {
  CHAT_Z: 'chat.z.ai',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  EMAIL_IN_COOKIES: /email=([^;]+)/,
  USER_CONTENT_TAG: /<zen-user-content>([\s\S]*?)<\/zen-user-content>/,
  EMAIL_IN_BODY: /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
} as const;

// ─── Content Tags ────────────────────────────────────────────────────

export const CONTENT_TAGS = {
  USER_CONTENT_OPEN: '<zen-user-content>',
  USER_CONTENT_CLOSE: '</zen-user-content>',
} as const;

// ─── WebSocket Config ────────────────────────────────────────────────

export const WEBSOCKET_CONFIG = {
  CONNECTION_TIMEOUT_MS: 30000,
  SESSION_SWITCH_DELAY_MS: 500,
  ACCOUNT_SET_DELAY_MS: 1000,
  PAGE_RESET_DELAY_MS: 1500,
} as const;

// ─── Cookie Keys ─────────────────────────────────────────────────────

export const COOKIE_KEYS = {
  EMAIL: 'email',
} as const;
