/**
 * ------------------------------------------------------------------
 * HuggingChat Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho HuggingChat provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / CONNECTION_TYPE / IS_PAUSABLE
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URL / HOSTS / API_PATHS
 * - COOKIE_NAMES / LOGIN_CONFIG
 * - HUGGINGCHAT_EVENTS
 * - USER_AGENT / HTTP_HEADERS / HTTP_HEADER_NAMES / CONTENT_TYPES
 * - FORM_CONFIG / API_FIELDS / PAYLOAD_DEFAULTS
 * - STREAM_TYPES / THINK_TAGS / ESCAPE_SEQUENCES
 * - REGEX_PATTERNS
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'huggingchat';
export const PROVIDER_NAME = 'HuggingChat';
export const PROVIDER_DESCRIPTION =
  'Open-source AI models from Hugging Face community';
export const PROVIDER_COLOR = '#FFD21E';
export const IS_ENABLED = false;
export const TOKEN_COUNT_MODE: 'incremental' | 'cumulative' = 'incremental';
export const WEBSITE_URL = 'https://huggingface.co/';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const CAN_REGENERATE = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://huggingface.co';

export const HOSTS = {
  HUGGINGFACE: 'huggingface.co',
} as const;

export const API_PATHS = {
  CHAT_LOGIN: '/chat/login',
  CHAT_USER: '/chat/api/v2/user',
  CHAT_MODELS: '/chat/api/v2/models',
  CHAT_CONVERSATIONS: '/chat/api/v2/conversations',
  CHAT_CONVERSATION: '/chat/conversation',
} as const;

// ─── Auth / Cookies ──────────────────────────────────────────────────

export const COOKIE_NAMES = {
  TOKEN: 'token',
} as const;

export const LOGIN_CONFIG = {
  PARTITION_PREFIX: 'huggingchat-',
  EMAIL_SUFFIX: '@hf.co',
} as const;

// ─── Proxy Events ────────────────────────────────────────────────────

export const HUGGINGCHAT_EVENTS = {
  COOKIES: 'hugging-chat-cookies',
  LOGIN_DATA: 'hugging-chat-login-data',
} as const;

// ─── HTTP Headers ────────────────────────────────────────────────────

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

/**
 * JA3 fingerprint khớp với Chrome 142.
 */
export const CHROME_JA3 =
  '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0';

/**
 * HTTP/2 fingerprint khớp với Chrome.
 */
export const CHROME_HTTP2_FINGERPRINT =
  '1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p';

/**
 * Profile giả lập Chrome dùng cho mọi request tới huggingface.co/chat.
 */
export const HUGGINGCHAT_IMPERSONATE_PROFILE = {
  ja3: CHROME_JA3,
  http2Fingerprint: CHROME_HTTP2_FINGERPRINT,
  userAgent: USER_AGENT,
} as const;

export const HTTP_HEADERS = {
  ACCEPT_JSON: 'application/json',
  USER_AGENT_SHORT: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
} as const;

export const HTTP_HEADER_NAMES = {
  COOKIE: 'Cookie',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ACCEPT: 'Accept',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  MULTIPART_PREFIX: 'multipart/form-data; boundary=',
} as const;

// ─── Multipart Form ──────────────────────────────────────────────────

export const FORM_CONFIG = {
  BOUNDARY_PREFIX: '----WebKitFormBoundary',
  BOUNDARY_RANDOM_BYTES: 16,
  CRLF: '\r\n',
  FIELD_NAME: 'data',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  EMAIL: 'email',
  USERNAME: 'username',
  CONVERSATION_ID: 'conversationId',
  JSON: 'json',
  MODELS: 'models',
  MESSAGES: 'messages',
  ROOT_MESSAGE_ID: 'rootMessageId',
  ID: 'id',
  TYPE: 'type',
  TOKEN: 'token',
  DISPLAY_NAME: 'displayName',
  NAME: 'name',
  PROVIDERS: 'providers',
  CONTEXT_LENGTH: 'context_length',
} as const;

// ─── Stream / SSE ────────────────────────────────────────────────────

export const STREAM_TYPES = {
  STREAM: 'stream',
} as const;

export const THINK_TAGS = {
  OPEN: '<think>',
  CLOSE: '</think>',
} as const;

export const ESCAPE_SEQUENCES = {
  NUL: '\\u0000',
} as const;

// ─── Payload Defaults ────────────────────────────────────────────────

export const PAYLOAD_DEFAULTS = {
  PREPROMPT: '',
  IS_RETRY: false,
  IS_CONTINUE: false,
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  EMAIL_IN_BODY: /"email":"([^"]+)"/,
} as const;
