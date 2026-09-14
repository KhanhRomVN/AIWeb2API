/**
 * ------------------------------------------------------------------
 * Qwen Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Qwen provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD         : Danh sách auth method (legacy export)
 * - QWEN_AUTH_METHODS   : Basic / Google auth literals
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URL            : Base URL của Qwen API
 * - API_PATHS           : Tất cả API endpoint paths
 * - USER_AGENTS         : User-Agent strings cho từng platform
 * - HTTP_HEADERS        : Header values dùng chung (API version, BX version)
 * - COOKIE_CONFIG       : Cookie name và Bearer prefix
 * - QWEN_EVENTS         : Event names dùng trong proxy handler
 * - MAX_CONTINUATIONS   : Số lần auto-continue tối đa
 * - SSE_PROTOCOL / SSE_EVENT_TYPES / SSE_FIELDS
 * - MODEL_TYPES         : Model type literals cho payload
 * - HISTORY_MESSAGES_COUNT
 * - SUCCESS_CODE
 * - HOSTS / REFERER_PATHS
 * - REGEX_PATTERNS
 * - CONTENT_TYPES / ACCEPT_VALUES
 * - AUTH_FIELDS / CREATE_CHAT_FIELDS / CHAT_PAYLOAD_FIELDS
 * - SSE_EVENT_FIELDS / RESPONSE_FIELDS / MODEL_FIELDS
 * - CHAT_PAYLOAD_CONSTANTS
 * - TIMEZONE_OFFSET / DB_PROVIDER_ID
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

export const MODELS = [
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: false,
    is_video_upload: false,
    is_larger_content_paste_upload: false,
    description:
      'Qwen Max - Most capable model for complex tasks with thinking mode and web search',
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    is_thinking: false,
    max_context_length: null,
    is_search: true,
    is_image_upload: false,
    is_video_upload: false,
    is_larger_content_paste_upload: false,
    description:
      'Qwen Plus - Balanced model for general purpose tasks with web search capability',
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_larger_content_paste_upload: false,
    description:
      'Qwen Turbo - Fast and cost-effective model for simple tasks',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://chat.qwen.ai';

export const QWEN_EVENTS = {
  COOKIES: 'qwen-cookies',
  HEADERS: 'qwen-headers',
  LOGIN_TOKEN: 'qwen-login-token',
  LOGIN_EMAIL: 'qwen-login-email',
} as const;

export const MAX_CONTINUATIONS = 10;
export const HISTORY_MESSAGES_COUNT = 20;
export const SUCCESS_CODE = 0;

export const API_VERSION = '0.2.91';
export const BX_VERSION = '2.5.37';

// ─── Auth Methods ────────────────────────────────────────────────────

export const QWEN_AUTH_METHODS = {
  BASIC: 'basic',
  GOOGLE: 'google',
} as const;

// ─── API Paths ───────────────────────────────────────────────────────

export const API_PATHS = {
  AUTH_SESSION: '/api/v1/auths/',
  CHATS: '/api/v2/chats/',
  CHATS_NEW: '/api/v2/chats/new',
  CHAT_COMPLETIONS: '/api/v2/chat/completions',
  MODELS: '/api/v2/models/',
  AUTH_SIGNIN: '/api/v2/auths/signin',
  AUTH_LOGIN: '/auth',
} as const;

export const CHATS_LIST_QUERY = '?page=1&exclude_project=true';

// ─── HTTP Headers / User Agents ──────────────────────────────────────

export const USER_AGENTS = {
  MACOS_SAFARI:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  LINUX_CHROME:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
} as const;

/** @deprecated Use USER_AGENTS.LINUX_CHROME instead */
export const USER_AGENT = USER_AGENTS.LINUX_CHROME;

export const HTTP_HEADERS = {
  API_VERSION: '0.2.91',
  BX_VERSION: '2.5.37',
} as const;

export const COOKIE_CONFIG = {
  TOKEN_NAME: 'token',
  CSRF_TOKEN_NAME: 'csrfToken',
  BEARER_PREFIX: 'Bearer ',
} as const;

// ─── Hosts ───────────────────────────────────────────────────────────

export const HOSTS = {
  CHAT_QWEN: 'chat.qwen.ai',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
  NEW_CHAT: '/c/new-chat',
  CHAT_PREFIX: '/c/',
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  ACCEPT_LANGUAGE: 'Accept-Language',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  COOKIE: 'Cookie',
  SOURCE: 'source',
  VERSION: 'version',
  BX_V: 'bx-v',
  BX_UA: 'bx-ua',
  BX_UMIDTOKEN: 'bx-umidtoken',
  X_CSRF_TOKEN: 'x-csrf-token',
  X_REQUEST_ID: 'X-Request-Id',
  SEC_CH_UA: 'sec-ch-ua',
  SEC_CH_UA_MOBILE: 'sec-ch-ua-mobile',
  SEC_CH_UA_PLATFORM: 'sec-ch-ua-platform',
  X_ACCEL_BUFFERING: 'X-Accel-Buffering',
  X_ACTUAL_STATUS_CODE: 'x-actual-status-code',
  TIMEZONE: 'Timezone',
} as const;

export const HTTP_HEADER_NAMES_LOWERCASE = {
  ACCEPT: 'accept',
  ACCEPT_LANGUAGE: 'accept-language',
  USER_AGENT: 'user-agent',
  SOURCE: 'source',
  VERSION: 'version',
  BX_V: 'bx-v',
  BX_UA: 'bx-ua',
  BX_UMIDTOKEN: 'bx-umidtoken',
  X_REQUEST_ID: 'x-request-id',
  AUTHORIZATION: 'authorization',
  CONTENT_TYPE: 'content-type',
  COOKIE: 'cookie',
  ORIGIN: 'origin',
  REFERER: 'referer',
  TIMEZONE: 'timezone',
} as const;

// ─── Content Types / Accept Values ───────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

export const ACCEPT_VALUES = {
  JSON: 'application/json',
  JSON_TEXT_PLAIN_ANY: 'application/json, text/plain, */*',
} as const;

export const ACCEPT_LANGUAGES = {
  EN_US_Q09: 'en-US,en;q=0.9',
  EN_US: 'en-US',
} as const;

// ─── Sec-CH-UA Values ────────────────────────────────────────────────

export const SEC_CH_UA = {
  VALUE:
    '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  PLATFORM: '"Linux"',
  MOBILE: '?0',
} as const;

// ─── Auth Prefixes ───────────────────────────────────────────────────

export const AUTH_PREFIXES = {
  BEARER: 'Bearer ',
  JWT: 'eyJ',
} as const;

// ─── Cookie / Token Keys ─────────────────────────────────────────────

/** @deprecated Use COOKIE_CONFIG.TOKEN_NAME instead */
export const TOKEN_COOKIE_KEY = COOKIE_CONFIG.TOKEN_NAME;
/** @deprecated Use COOKIE_CONFIG.CSRF_TOKEN_NAME instead */
export const CSRF_TOKEN_COOKIE_KEY = COOKIE_CONFIG.CSRF_TOKEN_NAME;
export const MASKED_EMAIL_INDICATOR = '***';
export const MASKED_EMAIL_CHAR = '*';

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  COOKIE_TOKEN: /(?:^|;\s*)token=(eyJ[^;]+)/,
  RAW_TOKEN: /token=(eyJ[^;]+)/,
  EMAIL_IN_BODY: /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DATA_PREFIX_SHORT: 'data:',
  DATA_PREFIX_LENGTH: 6,
  DATA_PREFIX_SHORT_LENGTH: 5,
  DONE: '[DONE]',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const AUTH_FIELDS = {
  ACCESS_TOKEN: 'accessToken',
  ACCESS_TOKEN_SNAKE: 'access_token',
  TOKEN: 'token',
  DATA: 'data',
  EMAIL: 'email',
  NAME: 'name',
  ID: 'id',
  BX_UA: 'bxUa',
  BX_UMIDTOKEN: 'bxUmidToken',
  USER_AGENT: 'userAgent',
} as const;

export const CREATE_CHAT_FIELDS = {
  CHAT_ID: 'chatId',
  MODELS: 'models',
  PROJECT_ID: 'project_id',
  TIMESTAMP: 'timestamp',
  CHAT_TYPE: 'chat_type',
  CHAT_MODE: 'chat_mode',
  ID: 'id',
  SUCCESS: 'success',
  DATA: 'data',
  CODE: 'code',
  DETAILS: 'details',
} as const;

export const CHAT_PAYLOAD_FIELDS = {
  STREAM: 'stream',
  VERSION: 'version',
  INCREMENTAL_OUTPUT: 'incremental_output',
  CHAT_ID: 'chatId',
  CHAT_ID_SNAKE: 'chat_id',
  PARENT_ID: 'parentId',
  PARENT_ID_SNAKE: 'parent_id',
  CHAT_MODE: 'chat_mode',
  MODEL: 'model',
  MESSAGES: 'messages',
  ID: 'id',
  FID: 'fid',
  CHILDREN_IDS: 'childrenIds',
  ROLE: 'role',
  CONTENT: 'content',
  USER_ACTION: 'user_action',
  FILES: 'files',
  TIMESTAMP: 'timestamp',
  MODELS: 'models',
  CHAT_TYPE: 'chat_type',
  FEATURE_CONFIG: 'feature_config',
  THINKING_ENABLED: 'thinking_enabled',
  OUTPUT_SCHEMA: 'output_schema',
  RESEARCH_MODE: 'research_mode',
  AUTO_THINKING: 'auto_thinking',
  THINKING_MODE: 'thinking_mode',
  AUTO_SEARCH: 'auto_search',
  EXTRA: 'extra',
  META: 'meta',
  SUB_CHAT_TYPE: 'subChatType',
  SUB_CHAT_TYPE_SNAKE: 'sub_chat_type',
} as const;

export const SSE_EVENT_FIELDS = {
  RESPONSE_CREATED_KEY: 'response.created',
  RESPONSE: 'response',
  CREATED: 'created',
  CHAT_ID: 'chat_id',
  RESPONSE_ID: 'response_id',
  CHOICES: 'choices',
  DELTA: 'delta',
  REASONING_CONTENT: 'reasoning_content',
  CONTENT: 'content',
} as const;

export const RESPONSE_FIELDS = {
  MESSAGES: 'messages',
  DATA: 'data',
  MESSAGE: 'message',
  ERROR: 'error',
} as const;

export const MODEL_FIELDS = {
  INFO: 'info',
  IS_ACTIVE: 'is_active',
  META: 'meta',
  CAPABILITIES: 'capabilities',
  THINKING: 'thinking',
  MAX_CONTEXT_LENGTH: 'max_context_length',
  SEARCH: 'search',
  VISION: 'vision',
  SHORT_DESCRIPTION: 'short_description',
  DESCRIPTION: 'description',
  ID: 'id',
  NAME: 'name',
} as const;

// ─── Constants ───────────────────────────────────────────────────────

export const CHAT_PAYLOAD_CONSTANTS = {
  STREAM_VERSION: '2.1',
  CHAT_MODE_NORMAL: 'normal',
  CHAT_TYPE_T2T: 't2t',
  OUTPUT_SCHEMA_PHASE: 'phase',
  RESEARCH_MODE_NORMAL: 'normal',
  THINKING_MODE_FAST: 'Fast',
  USER_ACTION_CHAT: 'chat',
  SUB_CHAT_TYPE: 't2t',
  ROLE_ASSISTANT: 'assistant',
} as const;

export const DEFAULT_MAX_CONTEXT_LENGTH = 1000000;
export const DEFAULT_TIMEOUT_MS = 10000;
export const TIMEZONE_OFFSET = 'GMT+0700';
export const DB_PROVIDER_ID = 'qwen';
export const MODEL_PREFIX_QWEN_DASH = 'qwen-';
export const MODEL_PREFIX_QWEN_3 = 'qwen-3.';
