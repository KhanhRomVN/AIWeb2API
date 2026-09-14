/**
 * ------------------------------------------------------------------
 * Claude Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Claude provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD            : Danh sách auth method (legacy export)
 * - CLAUDE_AUTH_METHODS    : Basic / Google auth literals
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - MODELS                 : Danh sách models hỗ trợ
 * - BASE_URL               : Base URL của Claude AI
 * - CLAUDE_EVENTS          : Event names dùng trong proxy handler
 * - USER_AGENT             : User-Agent string dùng chung
 * - GOOGLE_OAUTH_LOGIN_URL : URL login qua Google
 * - API_PATHS              : Tất cả API endpoint paths
 * - AUTH_PATH_PREFIX       : Prefix của endpoint auth (dùng để match URL)
 * - HTTP_HEADER_NAMES      : Header names (dạng gốc)
 * - HTTP_HEADER_NAMES_LOWERCASE : Header names (dạng lowercase, dùng khi lookup)
 * - CONTENT_TYPES          : Content-Type values
 * - REFERER_PATHS          : Path cho Referer header
 * - API_FIELDS             : Key dùng trong request/response body
 * - SSE_PROTOCOL           : Tiền tố và sentinel của SSE
 * - SSE_EVENT_TYPES        : Các event type dùng trong SSE parser
 * - DEFAULT_LOGIN_PATH     : Path trang login mặc định
 * - LOGIN_PARTITION_PREFIX : Prefix partition khi mở browser login
 * - MAX_TOKENS             : Max tokens mặc định cho chat completion
 * - MASKED_EMAIL_INDICATOR / MASKED_EMAIL_CHAR
 * - CLAUDE_HOST            : Hostname của Claude AI
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'claude';
export const PROVIDER_NAME = 'Claude';
export const PROVIDER_DESCRIPTION = 'Advanced AI assistant from Anthropic with strong reasoning';
export const PROVIDER_COLOR = '#CC785C';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://claude.ai/';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      "Anthropic's Claude Sonnet 4.5 - Balanced performance for everyday tasks with strong reasoning and image understanding",
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      "Anthropic's Claude Haiku 4.5 - Fast, compact model optimized for low-latency responses and efficient processing",
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      "Anthropic's Claude Sonnet 4.6 - Enhanced version with improved accuracy and broader knowledge base",
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://claude.ai';

export const CLAUDE_EVENTS = {
  AUTH_HEADER: 'claude-auth-header',
  LOGIN_EMAIL: 'claude-login-email',
  LOGIN_TOKEN: 'claude-login-token',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

export const GOOGLE_OAUTH_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://claude.ai/login';

export const API_PATHS = {
  PROFILE: '/api/auth/me',
  CHAT: '/api/chat',
} as const;

// ─── Auth Methods ────────────────────────────────────────────────────

export const CLAUDE_AUTH_METHODS = {
  BASIC: 'basic',
  GOOGLE: 'google',
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  COOKIE: 'Cookie',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
} as const;

export const HTTP_HEADER_NAMES_LOWERCASE = {
  AUTHORIZATION: 'authorization',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

// ─── Referer Paths ───────────────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  // User / profile
  EMAIL: 'email',
  NAME: 'name',
  ID: 'id',
  COOKIES: 'cookies',
  TOKEN: 'token',
  // Chat payload
  MODEL: 'model',
  MESSAGES: 'messages',
  ROLE: 'role',
  CONTENT: 'content',
  STREAM: 'stream',
  MAX_TOKENS: 'max_tokens',
  CONVERSATION_ID: 'conversation_id',
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

export const SSE_EVENT_TYPES = {
  CONTENT_BLOCK_DELTA: 'content_block_delta',
  MESSAGE_STOP: 'message_stop',
} as const;

// ─── Path / Partition ────────────────────────────────────────────────

export const AUTH_PATH_PREFIX = '/api/auth';
export const DEFAULT_LOGIN_PATH = '/login';
export const LOGIN_PARTITION_PREFIX = 'claude-';

// ─── Limits / Misc ───────────────────────────────────────────────────

export const MAX_TOKENS = 4096;
export const MASKED_EMAIL_INDICATOR = '***';
export const MASKED_EMAIL_CHAR = '*';

// ─── Hosts ───────────────────────────────────────────────────────────

export const CLAUDE_HOST = 'claude.ai';