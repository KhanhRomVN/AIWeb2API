/**
 * ------------------------------------------------------------------
 * Mistral Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Mistral provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / MISTRAL_AUTH_METHODS
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - BASE_URL / CHAT_BASE_URL / AUTH_LOGIN_URL
 * - API_PATHS              : Endpoint paths
 * - MISTRAL_HOSTS          : Hostname constants
 * - HTTP_HEADER_NAMES      : Header names
 * - CONTENT_TYPES          : Content-Type values
 * - REFERER_PATHS          : Path dùng cho Referer
 * - USER_AGENTS            : User-Agent cho profile và stream
 * - CHAT_MODES / PATCH_OPS / MESSAGE_INPUT_TYPES
 * - DEFAULT_FEATURES       : Danh sách beta features
 * - LOGIN_PARTITION_PREFIX / DEFAULT_TIMEZONE / DEFAULT_STABLE_ID
 * - PATCH_PATH_TEXT_SUFFIX
 * - MISTRAL_EVENTS         : Event names dùng trong proxy handler
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'mistral';
export const PROVIDER_NAME = 'Mistral';
export const PROVIDER_DESCRIPTION = 'European AI with efficient models and extended reasoning';
export const PROVIDER_COLOR = '#F2A93B';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://mistral.ai/';
export const AUTH_METHOD = ['basic'] as const;
export const MISTRAL_AUTH_METHODS = {
  BASIC: 'basic',
} as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://console.mistral.ai';
export const CHAT_BASE_URL = 'https://chat.mistral.ai';
export const AUTH_LOGIN_URL = 'https://auth.mistral.ai/ui/login';

export const API_PATHS = {
  USERS_ME: '/api/users/me',
  CHAT: '/api/chat',
} as const;

// ─── Hosts ───────────────────────────────────────────────────────────

export const MISTRAL_HOSTS = {
  AUTH: 'auth.mistral.ai',
  CONSOLE: 'console.mistral.ai',
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  COOKIE: 'Cookie',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  ACCEPT: 'accept',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  CHAT_PREFIX: '/chat/',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  EMAIL: 'email',
  NAME: 'name',
  FULL_NAME: 'full_name',
  ID: 'id',
} as const;

// ─── User Agents ─────────────────────────────────────────────────────
// 2 giá trị khác nhau: PROFILE dùng cho console API (Chrome/Linux),
// STREAM dùng cho chat stream (Windows).

export const USER_AGENTS = {
  PROFILE:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  STREAM: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
} as const;

// ─── Chat Modes ──────────────────────────────────────────────────────

export const CHAT_MODES = {
  START: 'start',
  APPEND: 'append',
} as const;

// ─── Patch Ops ───────────────────────────────────────────────────────

export const PATCH_OPS = {
  APPEND: 'append',
  ADD: 'add',
} as const;

// ─── Message Input Types ─────────────────────────────────────────────

export const MESSAGE_INPUT_TYPES = {
  TEXT: 'text',
} as const;

// ─── Default Features ────────────────────────────────────────────────

export const DEFAULT_FEATURES = [
  'beta-code-interpreter',
  'beta-imagegen',
  'beta-websearch',
  'beta-reasoning',
] as const;

// ─── Defaults ────────────────────────────────────────────────────────

export const LOGIN_PARTITION_PREFIX = 'mistral-';
export const DEFAULT_TIMEZONE = 'Asia/Saigon';
export const DEFAULT_STABLE_ID = '79zqlm';

// ─── Patch Path ──────────────────────────────────────────────────────

export const PATCH_PATH_TEXT_SUFFIX = '/text';

// ─── Events ──────────────────────────────────────────────────────────

export const MISTRAL_EVENTS = {
  COOKIES: 'mistral-cookies',
} as const;