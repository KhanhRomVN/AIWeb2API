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
export const PROVIDER_DESCRIPTION =
  'Alibaba AI with extended thinking and multimodal capabilities';
export const PROVIDER_COLOR = '#5B21B6';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://modelscope.cn/';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = true;

// Note: Models are fetched dynamically from API /api/v2/models/
// No hardcoded models - all model info comes from the API response

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
  FILE_GET_STS_TOKEN: '/api/v2/files/getstsToken',
  FILE_PARSE_STATUS: '/api/v2/files/parse/status',
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
  VALUE: '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
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
  THINKING_FORMAT: 'thinking_format',
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
  RESPONSE_INDEX: 'response_index',
  CHOICES: 'choices',
  DELTA: 'delta',
  PHASE: 'phase',
  STATUS: 'status',
  REASONING_CONTENT: 'reasoning_content',
  CONTENT: 'content',
  EXTRA: 'extra',
  SUMMARY_TITLE: 'summary_title',
  SUMMARY_THOUGHT: 'summary_thought',
  FUNCTION_CALL: 'function_call',
  FUNCTION_ID: 'function_id',
  DISPLAY_POSITION: 'display_position',
  TOOL_RESULT: 'tool_result',
  USAGE: 'usage',
  INPUT_TOKENS: 'input_tokens',
  OUTPUT_TOKENS: 'output_tokens',
  TOTAL_TOKENS: 'total_tokens',
  REASONING_TOKENS: 'reasoning_tokens',
  TEXT_TOKENS: 'text_tokens',
  CACHED_TOKENS: 'cached_tokens',
} as const;

// ─── SSE Phase Types ─────────────────────────────────────────────────

export const SSE_PHASE_TYPES = {
  THINKING_SUMMARY: 'thinking_summary',
  ANSWER: 'answer',
  WEB_SEARCH: 'web_search',
} as const;

export const SSE_STATUS_TYPES = {
  TYPING: 'typing',
  FINISHED: 'finished',
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
  IS_VISITOR_ACTIVE: 'is_visitor_active',
  META: 'meta',
  CAPABILITIES: 'capabilities',
  ABILITIES: 'abilities',
  THINKING: 'thinking',
  MAX_CONTEXT_LENGTH: 'max_context_length',
  MAX_SUMMARY_GENERATION_LENGTH: 'max_summary_generation_length',
  MAX_THINKING_GENERATION_LENGTH: 'max_thinking_generation_length',
  MAX_GENERATION_LENGTH: 'max_generation_length',
  SEARCH: 'search',
  VISION: 'vision',
  DOCUMENT: 'document',
  VIDEO: 'video',
  AUDIO: 'audio',
  CITATIONS: 'citations',
  MCP: 'mcp',
  PARSE_URL: 'parse_url',
  SHORT_DESCRIPTION: 'short_description',
  DESCRIPTION: 'description',
  AUTO_THINKING: 'auto_thinking',
  AUTO_SEARCH: 'auto_search',
  THINKING_FORMAT: 'thinking_format',
  CHAT_TYPE: 'chat_type',
  MODALITY: 'modality',
  THINK_SKIP: 'think_skip',
  ENABLE: 'enable',
  ID: 'id',
  NAME: 'name',
  OBJECT: 'object',
  OWNED_BY: 'owned_by',
  PRESET: 'preset',
  ACTION_IDS: 'action_ids',
  // Generator capabilities
  IS_IMAGE_GENERATOR: 'is_image_generator',
  IS_VIDEO_GENERATOR: 'is_video_generator',
  IS_DEEP_RESEARCH: 'is_deep_research',
} as const;

// ─── Constants ───────────────────────────────────────────────────────

export const CHAT_PAYLOAD_CONSTANTS = {
  STREAM_VERSION: '2.1',
  CHAT_MODE_NORMAL: 'normal',
  CHAT_TYPE_T2T: 't2t',
  CHAT_TYPE_T2I: 't2i',
  CHAT_TYPE_T2V: 't2v',
  CHAT_TYPE_SEARCH: 'search',
  CHAT_TYPE_DEEP_RESEARCH: 'deep_research',
  OUTPUT_SCHEMA_PHASE: 'phase',
  RESEARCH_MODE_NORMAL: 'normal',
  THINKING_MODE_FAST: 'Fast',
  THINKING_MODE_THINKING: 'Thinking',
  USER_ACTION_CHAT: 'chat',
  USER_ACTION_EDIT: 'edit',
  SUB_CHAT_TYPE: 't2t',
  SUB_CHAT_TYPE_SEARCH: 'search',
  ROLE_ASSISTANT: 'assistant',
  THINKING_FORMAT_SUMMARY: 'summary',
} as const;

// ─── MCP Tools ───────────────────────────────────────────────────────
// TODO: Implement MCP (Model Context Protocol) tools support
// Qwen models support MCP tools that can be invoked during conversations.
// These tools are listed in model.info.meta.mcp array from /api/v2/models/
//
// Core MCP Tools (from API):
// - "image-generation": Generate images based on text descriptions
// - "code-interpreter": Execute and interpret code snippets
// - "amap": Access map and location services (Amap/高德地图)
// - "fire-crawl": Web crawling and content extraction
//
// Extended MCP Tools (for future implementation):
// - "deep-research": Deep research mode for comprehensive analysis
// - "create-video": Generate/create video content
// - "create-image": Alternative image creation tool
export const MCP_TOOLS = {
  IMAGE_GENERATION: 'image-generation',
  CODE_INTERPRETER: 'code-interpreter',
  AMAP: 'amap',
  FIRE_CRAWL: 'fire-crawl',
  // TODO: Future MCP tools (not yet in API response)
  DEEP_RESEARCH: 'deep-research',
  CREATE_VIDEO: 'create-video',
  CREATE_IMAGE: 'create-image',
} as const;

export const DEFAULT_MAX_CONTEXT_LENGTH = 1000000;
export const DEFAULT_TIMEOUT_MS = 10000;
export const TIMEZONE_OFFSET = 'GMT+0700';
export const DB_PROVIDER_ID = 'qwen';
export const MODEL_PREFIX_QWEN_DASH = 'qwen-';
export const MODEL_PREFIX_QWEN_3 = 'qwen-3.';

// ─── Upload Configuration ────────────────────────────────────────────

export const UPLOAD_CONFIG = {
  FORM_BOUNDARY_PREFIX: '----WebKitFormBoundary',
  BOUNDARY_RANDOM_BYTES: 16,
  FORM_FIELD_NAME: 'file',
  CRLF: '\r\n',
  POLLING_INTERVAL_MS: 1000,
  POLLING_MAX_ATTEMPTS: 30,
} as const;

// ─── File Status ─────────────────────────────────────────────────────

export const FILE_STATUS = {
  SUCCESS: 'success',
  READY: 'ready',
  FAIL: 'fail',
  ERROR: 'error',
  PROCESSING: 'processing',
} as const;

// ─── API Fields ──────────────────────────────────────────────────────

export const API_FIELDS = {
  FILE_IDS: 'file_ids',
  FILE_ID: 'file_id',
  STATUS: 'status',
  TOKEN_USAGE: 'token_usage',
  SUCCESS: 'success',
  DATA: 'data',
  MESSAGE: 'message',
  CODE: 'code',
} as const;
