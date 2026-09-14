/**
 * ------------------------------------------------------------------
 * Qwen CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Qwen CLI provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / QWEN_AUTH_METHODS
 * - CONNECTION_TYPE / MODELS / IS_PAUSABLE / IS_MEMORY
 * - QWEN_CLI_EVENTS         : Event names dùng trong proxy handler
 * - CHAT_QWEN_BASE_URL / PORTAL_QWEN_BASE_URL / CHAT_QWEN_HOST
 * - USER_INFO_URL / CHAT_COMPLETIONS_URL / OAUTH_PATHS
 * - QWEN_CONFIG             : OAuth config (clientId, URLs, scope)
 * - HTTP_HEADER_NAMES / CONTENT_TYPES
 * - API_FIELDS / GRANT_TYPES / CONTENT_BLOCK_TYPES
 * - SSE_PROTOCOL            : data: prefix và [DONE] sentinel
 * - DASHSCOPE_AUTH_TYPE
 * - USER_AGENT templates
 * - TERMINAL_EMULATORS / LOGIN defaults
 * - DEFAULT_EXPIRES_IN_PROVIDER / DEFAULT_EXPIRES_IN_PROXY
 * - AUTHORIZE_URL_REGEX
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'qwen-cli';
export const PROVIDER_NAME = 'Qwen Coder CLI';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://modelscope.cn/';
export const AUTH_METHOD = ['basic'] as const;
export const QWEN_AUTH_METHODS = {
  BASIC: 'basic',
} as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'coder-model',
    name: 'Coder Model',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Qwen Coder Model - Specialized for code generation, debugging, and programming assistance',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const QWEN_CLI_EVENTS = {
  TOKENS: 'qwen-cli-tokens',
  USER_INFO: 'qwen-cli-user-info',
} as const;

export const CHAT_QWEN_BASE_URL = 'https://chat.qwen.ai';
export const PORTAL_QWEN_BASE_URL = 'https://portal.qwen.ai';
export const CHAT_QWEN_HOST = 'chat.qwen.ai';

export const USER_INFO_URL = `${CHAT_QWEN_BASE_URL}/api/v1/user/info`;
export const CHAT_COMPLETIONS_URL = `${PORTAL_QWEN_BASE_URL}/v1/chat/completions`;

export const OAUTH_PATHS = {
  TOKEN: '/api/v1/oauth2/token',
  USER: '/api/v1/user',
  AUTHS: '/api/v1/auths',
} as const;

// ─── OAuth Config ────────────────────────────────────────────────────

export const QWEN_CONFIG = {
  clientId: 'f0304373b74a44d2b584a3fb70ca9e56',
  deviceCodeUrl: 'https://chat.qwen.ai/api/v1/oauth2/device/code',
  tokenUrl: 'https://chat.qwen.ai/api/v1/oauth2/token',
  scope: 'openid profile email model.completion',
  codeChallengeMethod: 'S256',
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  X_DASHSCOPE_AUTHTYPE: 'x-dashscope-authtype',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
} as const;

export const AUTH_PREFIXES = {
  BEARER: 'Bearer ',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  // User profile
  EMAIL: 'email',
  USERNAME: 'username',
  DATA: 'data',
  // Token response
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  EXPIRES_IN: 'expires_in',
  RESPONSE: 'response',
  // Chat payload
  MODEL: 'model',
  MESSAGES: 'messages',
  ROLE: 'role',
  CONTENT: 'content',
  TEXT: 'text',
  TYPE: 'type',
  STREAM: 'stream',
  STREAM_OPTIONS: 'stream_options',
  INCLUDE_USAGE: 'include_usage',
  // SSE
  CHOICES: 'choices',
  DELTA: 'delta',
  MESSAGE: 'message',
  // OAuth request
  GRANT_TYPE: 'grant_type',
  CLIENT_ID: 'client_id',
} as const;

export const GRANT_TYPES = {
  REFRESH_TOKEN: 'refresh_token',
} as const;

export const CONTENT_BLOCK_TYPES = {
  TEXT: 'text',
} as const;

export const DASHSCOPE_AUTH_TYPE = 'qwen-oauth';

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

// ─── User Agent ──────────────────────────────────────────────────────

export const QWEN_CLI_VERSION = '0.10.6';
export const QWEN_CODE_USER_AGENT_PREFIX = 'QwenCode/';
export const QWEN_CHAT_USER_AGENT = 'QwenCode/0.10.6 (linux; x64)';

// ─── Login / OAuth Flow ──────────────────────────────────────────────

export const LOGIN_PARTITION = 'qwen-cli';
export const LOGIN_TEMP_HOME_PREFIX = 'qwen-login-fresh';
export const LOGIN_TIMEOUT_MS = 60000;
export const LOGIN_POLL_INTERVAL_MS = 1000;
export const QWEN_CLI_RELATIVE_PATH = '../../../../../temp/qwen-cli/cli.js';

export const TERMINAL_EMULATORS = [
  'gnome-terminal',
  'konsole',
  'xfce4-terminal',
  'kitty',
  'alacritty',
  'xterm',
  'x-terminal-emulator',
] as const;

export const AUTHORIZE_URL_REGEX =
  /https:\/\/chat\.qwen\.ai\/authorize\?user_code=[A-Z0-9-]+&client=qwen-code/;

// ─── Token Defaults ──────────────────────────────────────────────────

export const DEFAULT_EXPIRES_IN_PROVIDER = 21600;
export const DEFAULT_EXPIRES_IN_PROXY = 3600;