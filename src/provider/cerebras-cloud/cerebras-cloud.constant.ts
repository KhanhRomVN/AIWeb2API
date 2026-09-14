/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Cerebras Cloud provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - BASE_URL / API_BASE_URL / API_PATHS / HOSTS
 * - RATE_LIMITS / WINDOW_MS
 * - COOKIE_CONFIG / LOGIN_PARTITION_PREFIX
 * - CEREBRAS_EVENTS
 * - USER_AGENT / HTTP_HEADERS / HTTP_HEADER_NAMES
 * - CONTENT_TYPES / REFERER_PATHS
 * - PAYLOAD_DEFAULTS / MODELS_DEFAULTS
 * - SSE_PROTOCOL
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'cerebras-cloud';
export const PROVIDER_NAME = 'Cerebras Cloud';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://cloud.cerebras.ai/';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://cloud.cerebras.ai';
export const API_BASE_URL = 'https://api.cerebras.ai';

export const API_PATHS = {
  AUTH_SESSION: '/api/auth/session',
  MODELS: '/v1/models',
  CHAT_COMPLETIONS: '/v1/chat/completions',
} as const;

export const HOSTS = {
  CEREBRAS_CLOUD: 'cloud.cerebras.ai',
} as const;

// ─── Rate Limits ─────────────────────────────────────────────────────

export const RATE_LIMITS = {
  requests: {
    perMinute: 5,
    perHour: 150,
    perDay: 2400,
  },
  tokens: {
    perMinute: 30_000,
    perHour: 1_000_000,
    perDay: 1_000_000,
  },
} as const;

export const WINDOW_MS = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const;

// ─── Auth / Cookies ──────────────────────────────────────────────────

export const COOKIE_CONFIG = {
  SESSION_TOKEN_NAME: 'authjs.session-token',
  CALLBACK_URL_NAME: '__Secure-authjs.callback-url',
  API_KEY_PREFIX: 'csk-',
} as const;

export const LOGIN_PARTITION_PREFIX = 'cerebras-cloud-';

// ─── Proxy Events ────────────────────────────────────────────────────

export const CEREBRAS_EVENTS = {
  COOKIES: 'cerebras-cookies',
  USER_INFO: 'cerebras-user-info',
} as const;

// ─── HTTP Headers ────────────────────────────────────────────────────

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

export const HTTP_HEADERS = {
  ACCEPT_JSON: 'application/json',
  ACCEPT_ANY: '*/*',
  ACCEPT_LANGUAGE: 'en-US,en;q=0.9',
  SEC_CH_UA:
    '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  SEC_CH_UA_MOBILE: '?0',
  SEC_CH_UA_PLATFORM: '"Linux"',
  SEC_FETCH_SITE_SAME_SITE: 'same-site',
  SEC_FETCH_SITE_SAME_ORIGIN: 'same-origin',
  SEC_FETCH_MODE_CORS: 'cors',
  SEC_FETCH_DEST_EMPTY: 'empty',
  X_STAINLESS_LANG: 'js',
  X_STAINLESS_RUNTIME: 'browser:chrome',
  X_STAINLESS_RUNTIME_VERSION: '146.0.0',
  X_STAINLESS_PACKAGE_VERSION: '1.64.1',
  X_STAINLESS_OS: 'Unknown',
  X_STAINLESS_ARCH: 'unknown',
  X_STAINLESS_RETRY_COUNT: '0',
  X_STAINLESS_TIMEOUT: '10',
  BEARER_PREFIX: 'Bearer ',
} as const;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ACCEPT: 'Accept',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  COOKIE: 'Cookie',
  SEC_CH_UA: 'sec-ch-ua',
  SEC_CH_UA_MOBILE: 'sec-ch-ua-mobile',
  SEC_CH_UA_PLATFORM: 'sec-ch-ua-platform',
  SEC_FETCH_SITE: 'sec-fetch-site',
  SEC_FETCH_MODE: 'sec-fetch-mode',
  SEC_FETCH_DEST: 'sec-fetch-dest',
  ACCEPT_LANGUAGE: 'accept-language',
  X_STAINLESS_LANG: 'x-stainless-lang',
  X_STAINLESS_RUNTIME: 'x-stainless-runtime',
  X_STAINLESS_RUNTIME_VERSION: 'x-stainless-runtime-version',
  X_STAINLESS_PACKAGE_VERSION: 'x-stainless-package-version',
  X_STAINLESS_OS: 'x-stainless-os',
  X_STAINLESS_ARCH: 'x-stainless-arch',
  X_STAINLESS_RETRY_COUNT: 'x-stainless-retry-count',
  X_STAINLESS_TIMEOUT: 'x-stainless-timeout',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
} as const;

// ─── Payload / Model Defaults ────────────────────────────────────────

export const PAYLOAD_DEFAULTS = {
  MAX_COMPLETION_TOKENS: 65000,
  TEMPERATURE: 1,
  TOP_P: '0.95',
} as const;

export const MODELS_DEFAULTS = {
  MAX_CONTEXT_LENGTH: 8192,
} as const;

// ─── SSE Protocol ─────────────────────────────────────���──────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;