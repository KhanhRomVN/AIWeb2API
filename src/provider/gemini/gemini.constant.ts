/**
 * ------------------------------------------------------------------
 * Gemini Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Gemini provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / GEMINI_AUTH_METHODS
 * - CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URL            : Base URL cho Gemini
 * - GEMINI_BL           : Build label (bl parameter)
 * - GEMINI_MODES        : Mode category literals
 * - GEMINI_DEFAULT_THINK / GEMINI_DEFAULT_MODE
 * - MODEL_MAP           : Mapping từ model name sang mode và think level
 * - USER_AGENT          : User-Agent string dùng chung
 * - GEMINI_EVENTS       : Event names dùng trong proxy handler
 * - HTTP_HEADER_NAMES   : Header names
 * - CONTENT_TYPES       : Content-Type values
 * - SAPISID_HASH_PREFIX : Prefix của Authorization header SAPISIDHASH
 * - FORM_FIELDS         : Field name trong URL-encoded form
 * - DEFAULT_LOGIN_PATH / LOGIN_PARTITION_PREFIX / STREAM_GENERATE_PATH
 * - BATCH_EXECUTE_PATH / OAUTH2_PATH / USERINFO_PATH / SIGNIN_OAUTH_PATH
 * - GEMINI_HOST / GOOGLE_APIS_HOST / GOOGLE_ACCOUNTS_HOST
 * - COOKIE_NAMES / XSRF_MARKER / EMAIL_MARKER / MASKED_EMAIL_INDICATOR
 * - MAX_LOGIN_RETRY / XSRF_WAIT_MS / ERROR_SLICE_LENGTH
 * - MIN_LINE_LENGTH_FOR_PARSE / MIN_INNER_STR_LENGTH / PAYLOAD_ARRAY_SIZE
 * - REGEX_PATTERNS      : Các regex dùng chung
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'gemini';
export const PROVIDER_NAME = 'Gemini';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://gemini.google.com/';
export const AUTH_METHOD = ['google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const GEMINI_AUTH_METHODS = {
  GOOGLE: 'google',
  BASIC: 'basic',
} as const;

export const MODELS = [
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.5 Flash - Fast and efficient model for everyday tasks, optimized for quick responses',
  },
  {
    id: 'gemini-3.5-flash-thinking',
    name: 'Gemini 3.5 Flash Thinking',
    is_thinking: true,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.5 Flash Thinking - Enhanced reasoning with step-by-step thinking process for complex problems',
  },
  {
    id: 'gemini-3.5-flash-thinking-lite',
    name: 'Gemini 3.5 Flash Thinking Lite',
    is_thinking: true,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.5 Flash Thinking Lite - Lightweight version with thinking mode, balances speed and depth',
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.1 Pro - Professional-grade model with advanced capabilities for complex tasks',
  },
  {
    id: 'gemini-auto',
    name: 'Gemini Auto',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini Auto - Automatically selects optimal model based on task complexity and requirements',
  },
  {
    id: 'gemini-flash-lite',
    name: 'Gemini Flash Lite',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini Flash Lite - Ultra-lightweight model for resource-constrained environments and high throughput',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://gemini.google.com';

// Gemini Web build label — may need periodic update
export const GEMINI_BL = 'boq_assistant-bard-web-server_20260525.09_p0';

// Model mode category enum from Gemini frontend JS source
export const GEMINI_MODES = {
  FAST: 1,
  THINKING: 2,
  PRO: 3,
  AUTO: 4,
  FAST_DYNAMIC_THINKING: 5,
  FLASH_LITE: 6,
} as const;

export const GEMINI_DEFAULT_THINK = 4;
export const GEMINI_DEFAULT_MODE = GEMINI_MODES.FAST;

export const MODEL_MAP: Record<
  string,
  { mode: number; think: number; desc: string }
> = {
  'gemini-3.5-flash': {
    mode: GEMINI_MODES.FAST,
    think: 4,
    desc: 'Fast general-purpose model',
  },
  'gemini-3.5-flash-thinking': {
    mode: GEMINI_MODES.THINKING,
    think: 0,
    desc: 'Deep thinking mode, longest output (~20k chars)',
  },
  'gemini-3.1-pro': {
    mode: GEMINI_MODES.PRO,
    think: 4,
    desc: 'Pro model (requires cookie for real routing)',
  },
  'gemini-auto': {
    mode: GEMINI_MODES.AUTO,
    think: 4,
    desc: 'Auto model selection',
  },
  'gemini-3.5-flash-thinking-lite': {
    mode: GEMINI_MODES.FAST_DYNAMIC_THINKING,
    think: 0,
    desc: 'Dynamic thinking with adaptive depth',
  },
  'gemini-flash-lite': {
    mode: GEMINI_MODES.FLASH_LITE,
    think: 4,
    desc: 'Lightweight fast model',
  },
};

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const GEMINI_EVENTS = {
  COOKIES: 'gemini-cookies',
  USER_INFO: 'gemini-user-info',
  XSRF: 'gemini-xsrf',
  AUTH_USER: 'gemini-auth-user',
  EMAIL: 'gemini-email',
  SAPISID: 'gemini-sapisid',
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  USER_AGENT: 'User-Agent',
  COOKIE: 'Cookie',
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  X_GOOG_AUTH_USER: 'X-Goog-AuthUser',
  X_SAME_DOMAIN: 'X-Same-Domain',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
} as const;

// ─── SAPISID / Form ──────────────────────────────────────────────────

export const SAPISID_HASH_PREFIX = 'SAPISIDHASH ';

export const FORM_FIELDS = {
  F_REQ: 'f.req',
  AT: 'at',
} as const;

// ─── Paths ───────────────────────────────────────────────────────────

export const DEFAULT_LOGIN_PATH = '/app';
export const LOGIN_PARTITION_PREFIX = 'gemini-';
export const BATCH_EXECUTE_PATH = 'batchexecute';
export const OAUTH2_PATH = 'oauth2';
export const USERINFO_PATH = 'userinfo';
export const SIGNIN_OAUTH_PATH = 'signin/oauth';
export const STREAM_GENERATE_PATH =
  'assistant.lamda.BardFrontendService/StreamGenerate';

// ─── Hosts ───────────────────────────────────────────────────────────

export const GEMINI_HOST = 'gemini.google.com';
export const GOOGLE_APIS_HOST = 'www.googleapis.com';
export const GOOGLE_ACCOUNTS_HOST = 'accounts.google.com';

// ─── Cookie Names / Markers ──────────────────────────────────────────

export const COOKIE_NAMES = {
  SID: 'SID=',
  SECURE_1PSID: '__Secure-1PSID=',
  SAPISID: 'SAPISID=',
} as const;

export const XSRF_MARKER = 'SNlM0e';
export const EMAIL_MARKER = 'o30O0e';
export const MASKED_EMAIL_INDICATOR = '***';
export const WRB_FR_MARKER = '"wrb.fr"';

// ─── Retry / Limits ──────────────────────────────────────────────────

export const MAX_RETRY_ATTEMPTS = 2;
export const XSRF_WAIT_MS = 1500;
export const ERROR_SLICE_LENGTH = 500;
export const MIN_LINE_LENGTH_FOR_PARSE = 200;
export const MIN_INNER_STR_LENGTH = 50;
export const PAYLOAD_ARRAY_SIZE = 102;

// ─── Regex Patterns ──────────────────────────────────────────────────

export const REGEX_PATTERNS = {
  SAPISID_IN_COOKIE: /SAPISID=([^;]+)/,
  THINK_OVERRIDE: /@think=(\d+)$/,
  EMAIL_IN_HTML: /"email"\s*:\s*"([^"]+@[^"]+)"/,
  USER_EMAIL_IN_HTML: /userEmail["']?\s*:\s*["']([^"']+)["']/,
  XSRF_IN_ERROR: /"xsrf","([^"]+)"/,
  AUTH_USER_IN_URL: /\/u\/(\d+)\//,
  EMAIL_IN_BODY:
    /"email"\s*:\s*"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})"/,
  USER_EMAIL_JSON: /"oPEP7c"\s*:\s*"([^"]+)"/,
  XSRF_IN_BODY: /"SNlM0e"\s*:\s*"([^"]+)"/,
  CODE_BLOCK:
    /```(?:python|javascript|text)\?code_(?:reference|stdout)&code_event_index=\d+\n.*?```\n?/gs,
  CARD_CONTENT: /http:\/\/googleusercontent\.com\/card_content\/\d+\n?/g,
} as const;