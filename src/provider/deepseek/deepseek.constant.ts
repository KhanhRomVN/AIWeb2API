/**
 * ------------------------------------------------------------------
 * DeepSeek Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho DeepSeek provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD         : Danh sách auth method (legacy export)
 * - DEEPSEEK_AUTH_METHODS : Basic / Google auth literals
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URL            : Base URL của DeepSeek API
 * - API_PATHS           : Tất cả API endpoint paths
 * - USER_AGENTS         : User-Agent strings cho từng platform
 * - HTTP_HEADERS        : Header values dùng chung (X-Client-*)
 * - COOKIE_CONFIG       : Cookie name và Bearer prefix
 * - MODEL_TYPES         : Model type literals cho payload
 * - DEEPSEEK_EVENTS     : Event names dùng trong proxy handler
 * - MAX_CONTINUATIONS   : Số lần auto-continue tối đa
 * - SSE_PROTOCOL / SSE_EVENT_TYPES / SSE_FRAGMENT_TYPES / SSE_FIELDS
 * - FILE_STATUS / UPLOAD_CONFIG
 * - WASM_FILENAME / LOGIN_PARTITION_PREFIX
 * - HISTORY_MESSAGES_COUNT
 * - DEEPSEEK_HOST / GOOGLE_ACCOUNTS_HOST / GOOGLE_OAUTH_ID_PATH / GOOGLE_OAUTH_EMAIL_REGEX
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'deepseek';
export const PROVIDER_NAME = 'DeepSeek';
export const PROVIDER_DESCRIPTION = 'AI assistant with deep reasoning capabilities and web search';
export const PROVIDER_COLOR = '#1E90FF';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://deepseek.com';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = true;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'default',
    name: 'DeepSeek Default',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: true,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'DeepSeek Default - Fast responses with web search capability and image understanding, supports thinking mode',
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

// ─── Auth Methods ────────────────────────────────────────────────────

export const DEEPSEEK_AUTH_METHODS = {
  BASIC: 'basic',
  GOOGLE: 'google',
} as const;

// ─── API Paths ───────────────────────────────────────────────────────

export const API_PATHS = {
  USERS_CURRENT: '/api/v0/users/current',
  USERS_LOGIN: '/api/v0/users/login',
  USERS_AUTH_TOKEN_CHECK_DEVICE: '/api/v0/users/auth_token/check_device',
  CHAT_CONTINUE: '/api/v0/chat/continue',
  CHAT_SESSION_CREATE: '/api/v0/chat_session/create',
  CHAT_CREATE_POW_CHALLENGE: '/api/v0/chat/create_pow_challenge',
  CHAT_COMPLETION: '/api/v0/chat/completion',
  CHAT_STOP_GENERATION: '/api/v0/chat/stop_generation',
  CHAT_HISTORY_MESSAGES: '/api/v0/chat/history_messages',
  FILE_UPLOAD: '/api/v0/file/upload_file',
  FILE_FETCH_FILES: '/api/v0/file/fetch_files',
} as const;

// ─── HTTP Headers / User Agents ──────────────────────────────────────

export const USER_AGENTS = {
  MACOS_SAFARI:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  LINUX_CHROME:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
} as const;

export const HTTP_HEADERS = {
  X_APP_VERSION: '2.0.0',
  X_CLIENT_VERSION: '2.0.0',
  X_CLIENT_VERSION_UPLOAD: '2.4.0',
  X_CLIENT_PLATFORM: 'web',
  X_CLIENT_LOCALE: 'en_US',
  X_CLIENT_BUNDLE_ID: 'com.deepseek.chat',
  X_CLIENT_TIMEZONE_OFFSET: '25200',
  X_MODEL_TYPE_DEFAULT: 'default',
  X_THINKING_ENABLED_OFF: '0',
} as const;

export const COOKIE_CONFIG = {
  AUTH_TOKEN_NAME: 'DS-AUTH-TOKEN',
  BEARER_PREFIX: 'Bearer ',
} as const;

export const MODEL_TYPES = {
  DEFAULT: 'default',
  EXPERT: 'expert',
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  EVENT_PREFIX: 'event: ',
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

export const SSE_EVENT_TYPES = {
  READY: 'ready',
  CLOSE: 'close',
  HINT: 'hint',
  HINT_ERROR: 'error',
} as const;

export const SSE_FRAGMENT_TYPES = {
  THINK: 'THINK',
  RESPONSE: 'RESPONSE',
} as const;

export const SSE_FIELDS = {
  RESPONSE_STATUS: 'response/status',
  RESPONSE: 'response',
  BATCH: 'BATCH',
  QUASI_STATUS: 'quasi_status',
  INCOMPLETE: 'INCOMPLETE',
  ACCUMULATED_TOKEN_USAGE: 'accumulated_token_usage',
  RESPONSE_CONTENT: 'response/content',
  THINKING_CONTENT: 'thinking_content',
  THINKING_ELAPSED_SECS: 'thinking_elapsed_secs',
  ELAPSED_SECS: 'elapsed_secs',
  CONTENT_SUFFIX: '/content',
} as const;

// ─── Upload ──────────────────────────────────────────────────────────

export const FILE_STATUS = {
  SUCCESS: 'SUCCESS',
  READY: 'READY',
  FAIL: 'FAIL',
  ERROR: 'ERROR',
} as const;

export const UPLOAD_CONFIG = {
  POLLING_MAX_ATTEMPTS: 30,
  POLLING_INTERVAL_MS: 1000,
  FORM_BOUNDARY_PREFIX: '----WebKitFormBoundary',
  BOUNDARY_RANDOM_BYTES: 16,
  CRLF: '\r\n',
  FORM_FIELD_NAME: 'file',
  FORM_FIELD_FILENAME: 'filename',
} as const;

// ─── Misc ────────────────────────────────────────────────────────────

export const WASM_FILENAME = 'sha3_wasm_bg.7b9ca65ddd.wasm';
export const LOGIN_PARTITION_PREFIX = 'deepseek-';

// ─── Auth Renew (check_device) ───────────────────────────���────────────

/**
 * Cấu hình cho cơ chế auto-renew token DeepSeek.
 * Token DeepSeek là opaque, không có expires_in → phải chủ động kiểm tra
 * qua endpoint `auth_token/check_device` để nhận token mới khi server rotate.
 */
export const AUTH_RENEW_CONFIG = {
  /** Gọi check_device proactive mỗi N ms (mặc định 6 giờ) */
  PROACTIVE_INTERVAL_MS: 6 * 60 * 60 * 1000,
  /** Timeout cho 1 lần check_device (ms) */
  REQUEST_TIMEOUT_MS: 15_000,
  /** Số lần retry tối đa khi gặp lỗi mạng (không tính 40003) */
  MAX_NETWORK_RETRIES: 2,
} as const;

export const DEEPSEEK_ERROR_CODES = {
  AUTHORIZATION_FAILED: 40003,
} as const;
export const HISTORY_MESSAGES_COUNT = 20;
export const SUCCESS_CODE = 0;
export const MASKED_EMAIL_INDICATOR = '***';
export const MASKED_EMAIL_CHAR = '*';

export const CONTENT_DISPOSITION = {
  FORM_DATA: 'Content-Disposition: form-data;',
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  REFERER: 'Referer',
  ORIGIN: 'Origin',
  COOKIE: 'Cookie',
  X_APP_VERSION: 'X-App-Version',
  X_CLIENT_VERSION: 'x-client-version',
  X_CLIENT_PLATFORM: 'x-client-platform',
  X_CLIENT_LOCALE: 'x-client-locale',
  X_CLIENT_BUNDLE_ID: 'x-client-bundle-id',
  X_CLIENT_TIMEZONE_OFFSET: 'x-client-timezone-offset',
  X_MODEL_TYPE: 'x-model-type',
  X_THINKING_ENABLED: 'x-thinking-enabled',
  X_FILE_SIZE: 'x-file-size',
  X_DS_POW_RESPONSE: 'X-Ds-Pow-Response',
  X_DEVICE_ID: 'x-device-id',
  X_DEVICE_MODEL: 'x-device-model',
} as const;

export const HTTP_HEADER_NAMES_LOWERCASE = {
  AUTHORIZATION: 'authorization',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
  MULTIPART_PREFIX: 'multipart/form-data; boundary=',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
  CHAT_SESSION_PREFIX: '/a/chat/s/',
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  EMAIL_IN_BODY: /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  // Request body
  CHARACTER_ID: 'character_id',
  // Response envelope
  CODE: 'code',
  DATA: 'data',
  BIZ_DATA: 'biz_data',
  MSG: 'msg',
  REQUEST: 'request',
  RESPONSE: 'response',
  // User / session
  USER: 'user',
  CHAT_SESSION: 'chat_session',
  ID: 'id',
  TOKEN: 'token',
  EMAIL: 'email',
  COOKIES: 'cookies',
  // File upload
  FILES: 'files',
  FILE_IDS: 'file_ids',
  FILE: 'file',
  FILENAME: 'filename',
  STATUS: 'status',
  TOKEN_USAGE: 'token_usage',
  NAME: 'name',
  CHALLENGE: 'challenge',
  CHAT_MESSAGES: 'chat_messages',
  ROLE: 'role',
  MESSAGE_ID: 'message_id',
} as const;

export const ROLE_VALUES = {
  ASSISTANT: 'ASSISTANT',
} as const;

// ─── WASM ABI ────────────────────────────────────────────────────────

export const WASM_ABI = {
  STACK_PTR_SIZE: 16,
  MALLOC_ALIGN: 1,
  RETPTR_VALUE_OFFSET: 8,
  STATUS_NULL: 0,
  IMPORT_MODULE: 'wasi_snapshot_preview1',
  IMPORT_ENV: 'env',
  EXPORT_MALLOC: '__wbindgen_export_0',
  EXPORT_STACK_PTR: '__wbindgen_add_to_stack_pointer',
  EXPORT_SOLVE: 'wasm_solve',
} as const;

// ─── Hosts ───────────────────────────────────────────────────────────

export const DEEPSEEK_HOST = 'chat.deepseek.com';
export const GOOGLE_ACCOUNTS_HOST = 'accounts.google.com';
export const GOOGLE_OAUTH_ID_PATH = 'signin/oauth/id';
export const GOOGLE_OAUTH_EMAIL_REGEX = /"oPEP7c":"([^"]+)"/;
