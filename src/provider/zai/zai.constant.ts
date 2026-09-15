/**
 * ------------------------------------------------------------------
 * Z.AI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Z.AI provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD         : Danh sách auth method (legacy export)
 * - ZAI_AUTH_METHODS    : Google / Basic auth literals
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URL            : Base URL của Z.AI API
 * - API_PATHS           : Tất cả API endpoint paths
 * - USER_AGENTS         : User-Agent strings cho từng platform
 * - ZAI_EVENTS          : Event names dùng trong proxy handler
 * - MAX_CONTINUATIONS   : Số lần auto-continue tối đa
 * - SSE_PROTOCOL        : SSE protocol constants
 * - SALT / FE_VERSION   : Signature và version config
 * - HISTORY_MESSAGES_COUNT / SUCCESS_CODE
 * - HOSTS / REFERER_PATHS
 * - REGEX_PATTERNS
 * - CONTENT_TYPES / ACCEPT_VALUES
 * - HTTP_HEADER_NAMES
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'zai';
export const PROVIDER_NAME = 'ZAI';
export const PROVIDER_DESCRIPTION = 'GLM series models with enhanced coding and reasoning';
export const PROVIDER_COLOR = '#7C3AED';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://chat.z.ai/';
export const AUTH_METHOD = ['google', 'basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'GLM-5.1',
    name: 'GLM-5.1',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'GLM-5.1 - Latest model with enhanced reasoning and coding capabilities',
  },
  {
    id: 'GLM-5',
    name: 'GLM-5',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'GLM-5 - Fast and efficient model for general purpose tasks',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://chat.z.ai';

export const ZAI_EVENTS = {
  TOKEN: 'zai-token',
  LOGIN_EMAIL: 'zai-login-email',
} as const;

export const MAX_CONTINUATIONS = 10;
export const HISTORY_MESSAGES_COUNT = 20;
export const SUCCESS_CODE = 0;

export const SALT = 'key-@@@@)))()((9))-xxxx&&&%%%%%';
export const FE_VERSION = 'prod-fe-1.1.35';

// ─── Auth Methods ────────────────────────────────────────────────────

export const ZAI_AUTH_METHODS = {
  GOOGLE: 'google',
  BASIC: 'basic',
} as const;

// ─── API Paths ───────────────────────────────────────────────────────

export const API_PATHS = {
  CHATS_NEW: '/api/v1/chats/new',
  CHAT_COMPLETIONS: '/api/v2/chat/completions',
} as const;

// ─── HTTP Headers / User Agents ──────────────────────────────────────

export const USER_AGENTS = {
  WINDOWS_CHROME_124:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  WINDOWS_CHROME_125:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  WINDOWS_CHROME_126:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  MACOS_CHROME_124:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  LINUX_CHROME_124:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const;

/** @deprecated Use USER_AGENTS.WINDOWS_CHROME_124 instead */
export const DEFAULT_USER_AGENT = USER_AGENTS.WINDOWS_CHROME_124;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  COOKIE: 'Cookie',
  SEC_CH_UA: 'sec-ch-ua',
  SEC_CH_UA_MOBILE: 'sec-ch-ua-mobile',
  SEC_CH_UA_PLATFORM: 'sec-ch-ua-platform',
  SEC_FETCH_DEST: 'sec-fetch-dest',
  SEC_FETCH_MODE: 'sec-fetch-mode',
  SEC_FETCH_SITE: 'sec-fetch-site',
  ACCEPT_LANGUAGE: 'accept-language',
} as const;

export const COOKIE_CONFIG = {
  BEARER_PREFIX: 'Bearer ',
} as const;

// ─── Hosts ───────────────────────────────────────────────────────────

export const HOSTS = {
  CHAT_Z: 'chat.z.ai',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
} as const;

// ─── Content Types / Accept Values ───────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

export const ACCEPT_VALUES = {
  JSON: 'application/json',
} as const;

export const ACCEPT_LANGUAGES = {
  VI_EN_US: 'vi,en-US,en',
} as const;

// ─── Sec-CH-UA Values ────────────────────────────────────────────────

export const SEC_CH_UA = {
  MOBILE: '?0',
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  EMAIL_IN_BODY: /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DATA_PREFIX_LENGTH: 6,
  DONE: '[DONE]',
} as const;

// ─── Rate Limiting ───────────────────────────────────────────────────

export const RATE_LIMIT = {
  MAX_REQUESTS_PER_WINDOW: 8,
  WINDOW_MS: 60000,
  MIN_DELAY_BETWEEN_REQUESTS_MS: 500,
  RANDOM_DELAY_MIN_MS: 500,
  RANDOM_DELAY_MAX_MS: 2000,
} as const;

// ─── Chat Payload Constants ──────────────────────────────────────────

export const CHAT_PAYLOAD_CONSTANTS = {
  ROLE_USER: 'user',
  ROLE_ASSISTANT: 'assistant',
  PHASE_THINKING: 'thinking',
  FEATURE_TOOL_SELECTOR: 'tool_selector',
  FEATURE_STATUS_HIDDEN: 'hidden',
  MESSAGE_VERSION: 1,
  CHAT_TYPE_DEFAULT: 'default',
} as const;

// ─── Variables Template ──────────────────────────────────────────────

export const VARIABLES_TEMPLATE = {
  USER_NAME: '{{USER_NAME}}',
  USER_LOCATION: '{{USER_LOCATION}}',
  CURRENT_DATETIME: '{{CURRENT_DATETIME}}',
  CURRENT_DATE: '{{CURRENT_DATE}}',
  CURRENT_TIME: '{{CURRENT_TIME}}',
  CURRENT_WEEKDAY: '{{CURRENT_WEEKDAY}}',
  CURRENT_TIMEZONE: '{{CURRENT_TIMEZONE}}',
  USER_LANGUAGE: '{{USER_LANGUAGE}}',
} as const;

export const TIMEZONE = 'Asia/Saigon';
