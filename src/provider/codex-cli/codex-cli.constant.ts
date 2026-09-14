/**
 * ------------------------------------------------------------------
 * Codex CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Codex CLI provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URLS / API_PATHS / HOSTS
 * - CHATGPT_USAGE_URL / CODEX_RESPONSES_URL / AUTH_TOKEN_URL (derived)
 * - AUTH_CONFIG         : OAuth client_id, grant type, default expires
 * - TOKEN_FIELDS        : Field names trong credential JSON
 * - CODEX_CLI_EVENTS    : Event names dùng trong proxy handler
 * - USER_AGENT / ORIGINATOR / DEFAULT_INSTRUCTIONS
 * - HTTP_HEADERS / HTTP_HEADER_NAMES / CONTENT_TYPES
 * - API_FIELDS / MESSAGE_TYPES / PAYLOAD_DEFAULTS
 * - SSE_PROTOCOL / REGEX_PATTERNS
 * - TERMINALS / LOGIN_CONFIG
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'codex-cli';
export const PROVIDER_NAME = 'Codex CLI';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://google.com/';
export const AUTH_METHOD = ['google', 'basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.3 Codex - Advanced coding model with extensive programming knowledge and problem-solving',
  },
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.2 Codex - Powerful code generation model with strong reasoning for complex algorithms',
  },
  {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.1 Codex Max - Maximum capacity coding model for large-scale software development',
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.2 - General purpose model with balanced capabilities for diverse tasks',
  },
  {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.1 Codex Mini - Compact coding assistant for quick iterations and lightweight tasks',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URLS = {
  CHATGPT: 'https://chatgpt.com',
  AUTH_OPENAI: 'https://auth.openai.com',
} as const;

export const API_PATHS = {
  OAUTH_TOKEN: '/oauth/token',
  OAUTH_AUTHORIZE: '/oauth/authorize',
  CODEX_RESPONSES: '/backend-api/codex/responses',
  WHAM_USAGE: '/backend-api/wham/usage',
} as const;

export const HOSTS = {
  CHATGPT: 'chatgpt.com',
  AUTH_OPENAI: 'auth.openai.com',
} as const;

// ─── Endpoint URLs (derived) ─────────────────────────────────────────

export const CHATGPT_USAGE_URL = `${BASE_URLS.CHATGPT}${API_PATHS.WHAM_USAGE}`;
export const CODEX_RESPONSES_URL = `${BASE_URLS.CHATGPT}${API_PATHS.CODEX_RESPONSES}`;
export const AUTH_TOKEN_URL = `${BASE_URLS.AUTH_OPENAI}${API_PATHS.OAUTH_TOKEN}`;

// ─── Auth / OAuth ────────────────────────────────────────────────────

export const AUTH_CONFIG = {
  CLIENT_ID: 'app_EMoamEEZ73f0CkXaXp7hrann',
  GRANT_TYPE_REFRESH: 'refresh_token',
  DEFAULT_EXPIRES_IN: 86400,
} as const;

export const TOKEN_FIELDS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  EXPIRES_IN: 'expiresIn',
} as const;

// ─── Proxy Events ────────────────────────────────────────────────────

export const CODEX_CLI_EVENTS = {
  TOKENS: 'codex-cli-tokens',
  USER_INFO: 'codex-cli-user-info',
} as const;

// ─── HTTP Headers ────────────────────────────────────────────────────

export const USER_AGENT =
  'codex_cli_rs/0.104.0 (Ubuntu 24.4.0; x86_64) gnome-terminal';

export const ORIGINATOR = 'codex_cli_rs';

export const DEFAULT_INSTRUCTIONS = 'You are Codex, a GPT-5 coding agent';

export const HTTP_HEADERS = {
  ACCEPT_JSON: 'application/json',
  ACCEPT_SSE: 'text/event-stream',
  BEARER_PREFIX: 'Bearer ',
  CONTENT_ENCODING_ZSTD: 'zstd',
} as const;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ACCEPT: 'Accept',
  CONTENT_ENCODING: 'Content-Encoding',
  ORIGINATOR: 'originator',
  CHATGPT_ACCOUNT_ID: 'chatgpt-account-id',
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
  // Usage response
  EMAIL: 'email',
  USER_ID: 'user_id',
  ACCOUNT_ID: 'account_id',
  // JWT claim
  JWT_AUTH_CLAIM: 'https://api.openai.com/auth',
  JWT_CHATGPT_ACCOUNT_ID: 'chatgpt_account_id',
  // SSE chunk
  DELTA: 'delta',
  CHOICES: 'choices',
  MESSAGE: 'message',
  CONTENT: 'content',
  PARTS: 'parts',
} as const;

// ─── Payload / Message Types ─────────────────────────────────────────

export const MESSAGE_TYPES = {
  MESSAGE: 'message',
  OUTPUT_TEXT: 'output_text',
  INPUT_TEXT: 'input_text',
} as const;

export const PAYLOAD_DEFAULTS = {
  STORE: false,
  STREAM: true,
  INCLUDE_REASONING_ENCRYPTED: 'reasoning.encrypted_content',
  REASONING_EFFORT: 'medium',
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  OAUTH_AUTHORIZE_URL:
    /https:\/\/auth\.openai\.com\/oauth\/authorize\?[^\s"']+/,
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
  TEMP_DIR_NAME: '.elara',
  HOME_PREFIX: 'codex-login-fresh-',
  LOG_FILE_NAME: 'codex-cli.log',
  POLL_INTERVAL_MS: 1000,
  TIMEOUT_MS: 60000,
} as const;