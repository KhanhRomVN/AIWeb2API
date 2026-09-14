/**
 * ------------------------------------------------------------------
 * Gemini CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Gemini CLI provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - BASE_URLS / HOSTS / API_PATHS
 * - CLOUDCODE_BASE_URL + derived Cloud Code endpoints
 * - OAUTH_URLS / OAUTH_SCOPES / OAUTH_CONFIG
 * - TOKEN_FIELDS / COOKIE_NAMES
 * - GEMINI_CLI_EVENTS
 * - USER_AGENT / X_GOOG_API_CLIENT
 * - HTTP_HEADERS / HTTP_HEADER_NAMES / CONTENT_TYPES
 * - API_FIELDS / MESSAGE_ROLES / PAYLOAD_DEFAULTS
 * - SSE_PROTOCOL / REGEX_PATTERNS
 * - TERMINALS / LOGIN_CONFIG
 * - CLIENT_METADATA / DEFAULT_PROJECT_ID
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'gemini-cli';
export const PROVIDER_NAME = 'Gemini CLI';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://gemini.google.com/';
export const AUTH_METHOD = ['google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── Base URLs / Hosts ───────────────────────────────────────────────

export const BASE_URLS = {
  CLOUDCODE_PA: 'https://cloudcode-pa.googleapis.com',
  GOOGLE_ACCOUNTS: 'https://accounts.google.com',
  OAUTH2: 'https://oauth2.googleapis.com',
  WWW_GOOGLEAPIS: 'https://www.googleapis.com',
} as const;

export const HOSTS = {
  CLOUDCODE_PA: 'cloudcode-pa.googleapis.com',
  GOOGLE_ACCOUNTS: 'accounts.google.com',
  OAUTH2: 'oauth2.googleapis.com',
  WWW_GOOGLEAPIS: 'www.googleapis.com',
} as const;

export const API_PATHS = {
  OAUTH_AUTHORIZE: '/o/oauth2/v2/auth',
  OAUTH_TOKEN: '/token',
  USERINFO: '/userinfo',
  LOAD_CODE_ASSIST: ':loadCodeAssist',
  STREAM_GENERATE: ':streamGenerateContent',
  RETRIEVE_USER_QUOTA: ':retrieveUserQuota',
} as const;

// ─── Cloud Code Endpoints ────────────────────────────────────────────

export const CLOUDCODE_BASE_URL = `${BASE_URLS.CLOUDCODE_PA}/v1internal`;
export const CLOUDCODE_LOAD_CODE_ASSIST_URL = `${CLOUDCODE_BASE_URL}${API_PATHS.LOAD_CODE_ASSIST}`;
export const CLOUDCODE_STREAM_GENERATE_URL = `${CLOUDCODE_BASE_URL}${API_PATHS.STREAM_GENERATE}?alt=sse`;
export const CLOUDCODE_RETRIEVE_QUOTA_URL = `${CLOUDCODE_BASE_URL}${API_PATHS.RETRIEVE_USER_QUOTA}`;

// ─── OAuth ───────────────────────────────────────────────────────────

export const OAUTH_URLS = {
  AUTHORIZE: `${BASE_URLS.GOOGLE_ACCOUNTS}${API_PATHS.OAUTH_AUTHORIZE}`,
  TOKEN: `${BASE_URLS.OAUTH2}${API_PATHS.OAUTH_TOKEN}`,
} as const;

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const;

export const OAUTH_CONFIG = {
  GRANT_TYPE_REFRESH: 'refresh_token',
  CLIENT_ID_ENV_KEY: 'GEMINI_CLIENT_ID',
  CLIENT_SECRET_ENV_KEY: 'GEMINI_CLIENT_SECRET',
} as const;

// ─── Credential Fields ───────────────────────────────────────────────

export const TOKEN_FIELDS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  EXPIRES_IN: 'expiresIn',
  PROJECT_ID: 'projectId',
} as const;

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'ACCESS_TOKEN',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
} as const;

// ─── Events ──────────────────────────────────────────────────────────

export const GEMINI_CLI_EVENTS = {
  TOKENS: 'gemini-cli-tokens',
  USER_INFO: 'gemini-cli-user-info',
} as const;

// ─── HTTP Headers ────────────────────────────────────────────────────

export const USER_AGENT =
  'GeminiCLI/0.29.7/gemini-3-pro-preview (linux; x64) google-api-nodejs-client/9.15.1';
export const X_GOOG_API_CLIENT = 'gl-node/22.21.1';

export const HTTP_HEADERS = {
  ACCEPT_JSON: 'application/json',
  BEARER_PREFIX: 'Bearer ',
} as const;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ACCEPT: 'Accept',
  X_GOOG_API_CLIENT: 'X-Goog-Api-Client',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  // OAuth response
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  EXPIRES_IN: 'expires_in',
  // User info
  EMAIL: 'email',
  NAME: 'name',
  // Project
  PROJECT_ID: 'cloudaicompanionProject',
  PROJECT_ID_NESTED: 'id',
  // Quota
  BUCKETS: 'buckets',
  MODEL_ID: 'modelId',
  // SSE
  RESPONSE: 'response',
  CANDIDATES: 'candidates',
  CONTENT: 'content',
  PARTS: 'parts',
  TEXT: 'text',
} as const;

// ─── Payload / Message Roles ───────────────────────���─────────────────

export const MESSAGE_ROLES = {
  USER: 'user',
  MODEL: 'model',
  ASSISTANT: 'assistant',
} as const;

export const PAYLOAD_DEFAULTS = {
  MODE: 1,
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  OAUTH_AUTHORIZE_URL:
    /https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?[^\s"']+/,
} as const;

// ─── Login / Terminal ────────────────────────────────────────────────

export const TERMINALS = [
  'gnome-terminal',
  'konsole',
  'xfce4-terminal',
  'kitty',
  'alacritty',
  'xterm',
  'x-terminal-emulator',
] as const;

export const LOGIN_CONFIG = {
  TEMP_DIR_PREFIX: 'gemini-login-fresh-',
  LOG_FILE_NAME: 'gemini-cli.log',
  POLL_INTERVAL_MS: 1000,
  TIMEOUT_MS: 60000,
  PARTITION_PREFIX: 'gemini-cli-',
} as const;

// ─── Misc ────────────────────────────────────────────────────────────

export const CLIENT_METADATA = { ideType: 9, platform: 3, pluginType: 2 };
export const DEFAULT_PROJECT_ID = 'reference-courage-zzsgc';