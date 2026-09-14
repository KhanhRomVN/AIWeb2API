/**
 * ------------------------------------------------------------------
 * Groq Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Groq provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / GROQ_AUTH_METHODS
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - BASE_URL                  : Base URL của Groq console
 * - API_BASE_URL              : Base URL của Groq API
 * - API_CHAT_COMPLETIONS_URL  : URL chat completion
 * - API_MODELS_URL            : URL lấy danh sách models
 * - SESSION_COOKIE_NAME       : Tên session cookie (chứa JWT)
 * - PREFERENCES_COOKIE_NAME / PREFERENCES_ORG_KEY
 * - BEARER_PREFIX / DEFAULT_LOGIN_PATH / LOGIN_PARTITION_PREFIX
 * - JWT_SESSION_CLAIM / JWT_AUTH_FACTORS_KEY / JWT_EMAIL_FACTOR_KEY / JWT_EMAIL_ADDRESS_KEY
 * - HTTP_HEADER_NAMES / CONTENT_TYPES / REFERER_PATHS
 * - GROQ_HOST / USER_AGENT
 * - API_FIELDS / GROQ_EVENTS / REGEX_PATTERNS
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'groq';
export const PROVIDER_NAME = 'Groq';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://groq.com';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const GROQ_AUTH_METHODS = {
  BASIC: 'basic',
} as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://console.groq.com';
export const API_BASE_URL = 'https://api.groq.com';

export const API_CHAT_COMPLETIONS_URL = `${API_BASE_URL}/openai/v1/chat/completions`;
export const API_MODELS_URL = `${API_BASE_URL}/internal/v1/models`;

// ─── Auth / Login ────────────────────────────────────────────────────

export const DEFAULT_LOGIN_PATH = '/login';
export const LOGIN_PARTITION_PREFIX = 'groq-';
export const SESSION_COOKIE_NAME = 'stytch_session_jwt';
export const PREFERENCES_COOKIE_NAME = 'user-preferences';
export const PREFERENCES_ORG_KEY = 'current-org';
export const BEARER_PREFIX = 'Bearer ';

// ─── JWT ─────────────────────────────────────────────────────────────

export const JWT_SESSION_CLAIM = 'https://stytch.com/session';
export const JWT_AUTH_FACTORS_KEY = 'authentication_factors';
export const JWT_EMAIL_FACTOR_KEY = 'email_factor';
export const JWT_EMAIL_ADDRESS_KEY = 'email_address';

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  COOKIE: 'Cookie',
  CONTENT_TYPE: 'Content-Type',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  AUTHORIZATION: 'Authorization',
  USER_AGENT: 'User-Agent',
  GROQ_ORGANIZATION: 'groq-organization',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
} as const;

// ─── Hosts ───────────────────────────────────────────────────────────

export const GROQ_HOST = 'console.groq.com';

// ─── User Agent ──────────────────────────────────────────────────────

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  // Chat payload
  MODEL: 'model',
  MESSAGES: 'messages',
  ROLE: 'role',
  CONTENT: 'content',
  STREAM: 'stream',
  TEMPERATURE: 'temperature',
  // SSE
  CHOICES: 'choices',
  DELTA: 'delta',
  // Models response
  DATA: 'data',
  ID: 'id',
  ACTIVE: 'active',
  METADATA: 'metadata',
  DISPLAY_NAME: 'display_name',
  MODEL_CARD: 'model_card',
  CONTEXT_WINDOW: 'context_window',
  FEATURES: 'features',
  REASONING: 'reasoning',
} as const;

// ─── Events ──────────────────────────────────────────────────────────

export const GROQ_EVENTS = {
  COOKIES: 'groq-cookies',
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  SESSION_COOKIE: new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`),
  PREFERENCES_COOKIE: /(?:^|;\s*)user-preferences=([^;]+)/,
  BASE64URL_DASH: /-/g,
  BASE64URL_UNDERSCORE: /_/g,
} as const;