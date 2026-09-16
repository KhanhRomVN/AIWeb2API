/**
 * ------------------------------------------------------------------
 * Kimi Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Kimi provider.
 *
 * Main exports:
 * - PROVIDER_ID            : ID định danh provider
 * - PROVIDER_NAME          : Tên hiển thị
 * - IS_ENABLED             : Bật/tắt provider
 * - WEBSITE_URL            : URL website
 * - AUTH_METHOD            : Phương thức xác thực
 * - CONNECTION_TYPE        : Loại kết nối (https/browser)
 * - MODELS                 : Empty array (models fetched from API at runtime)
 * - IS_PAUSABLE            : Hỗ trợ tạm dừng session
 * - IS_MEMORY              : Hỗ trợ bộ nhớ dài hạn
 * - KIMI_BASE_URL          : Base URL của Kimi AI
 * - KIMI_MODELS            : Model constants
 * - KIMI_EVENTS            : Các event name dùng trong proxy handler
 * - USER_AGENT             : User-Agent string dùng chung
 * - MSH_HEADERS            : Các header MSH dùng chung
 * - AUTH_REFRESH_URL       : URL refresh token
 * - CHAT_URL               : URL chat completion
 * - GET_USER_URL           : URL lấy thông tin user
 * - LIST_THIRD_ACCOUNTS_URL: URL lấy third-party accounts
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'kimi';
export const PROVIDER_NAME = 'Kimi';
export const PROVIDER_DESCRIPTION = 'Long-context AI with 260K context window and multi-agent capabilities';
export const PROVIDER_COLOR = '#3B82F6';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://www.kimi.ai/';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const KIMI_AUTH_METHODS = {
  BASIC: 'basic',
  GOOGLE: 'google',
} as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const KIMI_BASE_URL = 'https://www.kimi.ai';

export const KIMI_MODELS = {
  K3: 'k3-agent',
  K3_SWARM: 'k3-agent-swarm',
  K28_PREVIEW: 'k28-agent-preview',
  INSTANT: 'k2d6-chat',
  KIMI_LATEST: 'k3-agent',
} as const;

export const KIMI_EVENTS = {
  HEADERS: 'kimi-headers',
  LOGIN_TOKEN: 'kimi-login-token',
  LOGIN_EMAIL: 'kimi-login-email',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const MSH_HEADERS = {
  'x-msh-platform': 'web',
  'x-msh-version': '2.2.0',
  'x-language': 'en-US',
} as const;

export const AUTH_REFRESH_URL =
  'https://auth.kimi.ai/api/account.gateway.v1.AuthService/RefreshToken';
export const CHAT_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`;
export const GET_USER_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.UserService/GetCurrentUser`;
export const LIST_THIRD_ACCOUNTS_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.SecurityService/ListThirdAccounts`;
export const GET_AVAILABLE_MODELS_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.config.v1.ConfigService/GetAvailableModels`;
export const GET_SUBSCRIPTION_STATS_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats`;
export const FILE_UPLOAD_URL = `${KIMI_BASE_URL}/apiv2-files/file/upload`;
export const GET_FILE_PARSE_PROGRESS_URL = `${KIMI_BASE_URL}/apiv2-files/kimi.gateway.file.v1.FileService/GetFileParseProgress`;

// ─── Hosts ───────────────────────────────────────────────────────────

export const HOSTS = {
  KIMI_AI: 'kimi.ai',
  KIMI_COM: 'kimi.com',
  MOONSHOT_CN: 'moonshot.cn',
  AUTH_KIMI: 'auth.kimi.ai',
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  COOKIE: 'Cookie',
  X_MSH_DEVICE_ID: 'x-msh-device-id',
  X_MSH_SESSION_ID: 'x-msh-session-id',
  X_TRAFFIC_ID: 'x-traffic-id',
  CONNECT_PROTOCOL_VERSION: 'connect-protocol-version',
  R_TIMEZONE: 'r-timezone',
} as const;

export const HTTP_HEADER_NAMES_LOWERCASE = {
  AUTHORIZATION: 'authorization',
  COOKIE: 'cookie',
  USER_AGENT: 'user-agent',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
  CONNECT_JSON: 'application/connect+json',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
} as const;

// ─── Auth Prefixes ───────────────────────────────────────────────────

export const AUTH_PREFIXES = {
  BEARER: 'Bearer ',
  JWT: 'eyJ',
} as const;

// ─── Credential / Cookie Keys ────────────────────────────────────────

export const CREDENTIAL_KEYS = {
  KIMI_AUTH: 'kimi-auth',
  KIMI_REFRESH: 'kimi-refresh',
  REFRESH_TOKEN: 'refresh_token',
  ACCESS_TOKEN: 'access_token',
  TOKEN: 'token',
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  KIMI_AUTH: /kimi-auth=([^;]+)/,
  KIMI_REFRESH: /kimi-refresh=([^;]+)/,
  REFRESH_TOKEN: /refresh_token=([^;]+)/,
  ACCESS_TOKEN: /access_token=([^;]+)/,
  TOKEN: /token=([^;]+)/,
  ID_TOKEN: /id_token=([^&#]+)/,
  ID_TOKEN_NO_HASH: /id_token=([^&]+)/,
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const AUTH_FIELDS = {
  ACCESS_TOKEN: 'accessToken',
  ACCESS_TOKEN_SNAKE: 'access_token',
  REFRESH_TOKEN: 'refreshToken',
  REFRESH_TOKEN_SNAKE: 'refresh_token',
  TOKEN: 'token',
  DATA: 'data',
  USER: 'user',
  EMAIL: 'email',
  NAME: 'name',
  NICKNAME: 'nickname',
  ID: 'id',
  THIRD_PARTY: 'thirdParty',
} as const;

export const JWT_PAYLOAD_FIELDS = {
  EMAIL: 'email',
  NAME: 'name',
  NICKNAME: 'nickname',
  SUB: 'sub',
  ABSTRACT_USER_ID: 'abstract_user_id',
  ID: 'id',
} as const;

export const CHAT_REQUEST_FIELDS = {
  SCENARIO: 'scenario',
  OPTIONS: 'options',
  MESSAGE: 'message',
  ROLE: 'role',
  BLOCKS: 'blocks',
  TEXT: 'text',
  FILE: 'file',
  CONTENT: 'content',
  THINKING: 'thinking',
  ENABLE_PLUGIN: 'enable_plugin',
  REASONING_EFFORT: 'reasoning_effort',
  MODEL: 'model',
  TOOLS: 'tools',
  TYPE: 'type',
  SEARCH: 'search',
  CHAT_ID: 'chat_id',
  KIMIPLUS_ID: 'kimiplus_id',
} as const;

export const SSE_EVENT_FIELDS = {
  DONE: 'done',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
  DETAILS: 'details',
  DEBUG: 'debug',
  LOCALIZED_MESSAGE: 'localizedMessage',
  MESSAGE: 'message',
  CODE: 'code',
  CHAT: 'chat',
  LAST_REQUEST: 'lastRequest',
  ID: 'id',
  BLOCK: 'block',
  TEXT: 'text',
  THINK: 'think',
  CONTENT: 'content',
  MASK: 'mask',
  MULTI_STAGE: 'multiStage',
  STAGE: 'stage',
  STATUS: 'status',
} as const;

// ─── Scenario / Model / Reasoning Values ─────────────────────────────

export const SCENARIOS = {
  CHAT: 'SCENARIO_CHAT',
  OK_COMPUTER: 'SCENARIO_OK_COMPUTER',
  OK_COMPUTER_SWARM: 'SCENARIO_OK_COMPUTER_SWARM',
} as const;

export const KIMI_CHAT_MODELS = {
  K2D6_CHAT: 'k2d6-chat',
} as const;

export const REASONING_EFFORTS = {
  NONE: 'REASONING_EFFORT_NONE',
  LOW: 'REASONING_EFFORT_LOW',
  HIGH: 'REASONING_EFFORT_HIGH',
  MAX: 'REASONING_EFFORT_MAX',
} as const;

export const TOOL_TYPES = {
  SEARCH: 'TOOL_TYPE_SEARCH',
  CRON_JOB: 'TOOL_TYPE_CRON_JOB',
} as const;

// ─── SSE Frame Protocol ──────────────────────────────────────────────

export const FRAME_PROTOCOL = {
  HEADER_SIZE: 5,
  FLAG_BYTE_OFFSET: 0,
  FLAG_BYTE_VALUE: 0,
  LENGTH_OFFSET: 1,
  ENCODING: 'utf8',
} as const;

export const SSE_STAGES = {
  NAME_THINKING: 'STAGE_NAME_THINKING',
} as const;

export const SSE_MESSAGE_STATUSES = {
  COMPLETED: 'MESSAGE_STATUS_COMPLETED',
} as const;

export const SSE_MASKS = {
  BLOCK_TEXT_CONTENT: 'block.text.content',
  BLOCK_THINK_CONTENT: 'block.think.content',
} as const;

// ─── URL / Encoding Patterns ─────────────────────────────────────────

export const URL_PATTERNS = {
  GOOGLE_CALLBACK: 'google-callback',
  ID_TOKEN_PARAM: 'id_token=',
} as const;

export const ENCODINGS = {
  BASE64URL: 'base64url',
  UTF8: 'utf8',
} as const;

// ─── ID Config ───────────────────────────────────────────────────────

export const ID_PREFIXES = {
  DEVICE: 'dev_',
  SESSION: 'sess_',
  TEMP_CHAT: 'kimi_temp_',
  USER: 'Kimi_',
} as const;

export const ID_RANDOM_BYTES = 8;
export const JWT_SUB_PREFIX_LENGTH = 8;
export const DEFAULT_EMAIL = 'kimi_user@kimi.ai';
export const DEFAULT_TIMEZONE = 'Asia/Saigon';
export const DEFAULT_TIMEOUT_MS = 120000;
export const LOGIN_PARTITION_PREFIX = 'kimi-';

// ─── Upload Config ───────────────────────────────────────────────────

export const UPLOAD_CONFIG = {
  FORM_FIELD_NAME: 'file',
  FORM_BOUNDARY_PREFIX: '----WebKitFormBoundary',
  BOUNDARY_RANDOM_BYTES: 8,
  CRLF: '\r\n',
  POLLING_INTERVAL_MS: 1000,
  POLLING_MAX_ATTEMPTS: 30,
} as const;

export const FILE_PROCESS_STATUS = {
  SUCCESS: 'PROCESS_STATUS_SUCCESS',
  PROCESSING: 'PROCESS_STATUS_PROCESSING',
  FAIL: 'PROCESS_STATUS_FAIL',
} as const;