/**
 * ------------------------------------------------------------------
 * Codex Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Codex provider.
 *
 * Provider này gọi backend của ChatGPT/Codex bằng OAuth token,
 * giả lập Codex client (không dùng OpenAI public API key).
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD         : 'oauth' (via refresh token hoặc access token)
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URL            : Base URL của ChatGPT backend
 * - API_PATHS           : Endpoint paths
 * - OAUTH_CONFIG        : OAuth PKCE constants (client_id, endpoints)
 * - HTTP_HEADERS_CONFIG : User-Agent và headers giả lập Codex
 * - SSE_EVENTS          : Event names từ SSE stream
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ───────────────────────────────────────────

export const PROVIDER_ID = 'codex';
export const PROVIDER_NAME = 'Codex';
export const PROVIDER_DESCRIPTION =
  'OpenAI Codex via ChatGPT OAuth — powered by your ChatGPT account';
export const PROVIDER_COLOR = '#10A37F';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://chatgpt.com';

/**
 * Auth method: 'oauth' — login qua ChatGPT OAuth PKCE.
 * Credential lưu dạng JSON: `{"accessToken":"...","refreshToken":"...","email":"..."}`
 */
export const AUTH_METHOD = ['oauth'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const CAN_REGENERATE = true;
export const SUPPORTS_SESSION_CLEANUP = false;

// ─── Request Limits ──────────────────────────────────────────────────────

/**
 * Giới hạn request/account/ngày. undefined = không giới hạn cứng.
 * Codex có hạn mức riêng từ upstream (wham/usage), đây chỉ là soft limit phía gateway.
 */
export const REQUEST_LIMIT: number | undefined = undefined;
export const REQUEST_LIMIT_PERIOD: 'day' | 'week' | 'month' = 'day';

/**
 * Khung giờ bị chặn (UTC). Để tắt: set = [].
 */
export const BLOCKED_TIME_RANGES: Array<{
  startTime: number;
  endTime: number;
}> = [];

// ─── Models ──────────────────────────────────────────────────────────────

export const MODELS = [
  {
    id: 'codex-mini-latest',
    name: 'Codex Mini Latest',
    is_thinking: false,
    max_context_length: 200000,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Codex Mini — fast, cost-effective coding model',
  },
  {
    id: 'o4-mini',
    name: 'o4-mini',
    is_thinking: true,
    max_context_length: 200000,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'o4-mini — reasoning model optimized for coding tasks',
  },
  {
    id: 'o3',
    name: 'o3',
    is_thinking: true,
    max_context_length: 200000,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'o3 — powerful reasoning model for complex coding tasks',
  },
] as const;

// ─── API Configuration ────────────────────────────────────────────────────

/**
 * Base URL của ChatGPT backend. Endpoint Codex nằm ở /backend-api/codex/responses.
 * Đây là internal backend, không phải public API.
 */
export const BASE_URL = 'https://chatgpt.com';

export const API_PATHS = {
  /** Gửi chat request — endpoint chính của Codex */
  CODEX_RESPONSES: '/backend-api/codex/responses',
  /** Lấy danh sách model từ manifest (trả raw manifest) */
  CODEX_MODELS: '/backend-api/codex/models',
  /** Lấy usage/quota thông qua wham */
  WHAM_USAGE: '/backend-api/wham/usage',
} as const;

// ─── OAuth PKCE ───────────────────────────────────────────────────────────

/**
 * OAuth PKCE constants cho ChatGPT/Codex.
 * client_id là public client của Codex app — không có client_secret.
 * Redirect URI phải là localhost:1455/auth/callback (đã đăng ký phía OpenAI).
 */
export const OAUTH_CONFIG = {
  AUTHORIZE_URL: 'https://auth.openai.com/oauth/authorize',
  TOKEN_URL: 'https://auth.openai.com/oauth/token',
  /** Public client ID của Codex (app_EMoamEEZ73f0CkXaXp7hrann) */
  CLIENT_ID: 'app_EMoamEEZ73f0CkXaXp7hrann',
  /** Redirect URI duy nhất được đăng ký phía OpenAI cho Codex */
  REDIRECT_URI: 'http://localhost:1455/auth/callback',
  SCOPES: 'openid profile email offline_access',
  /** Tham số bổ sung để lấy tổ chức và flow đơn giản hóa */
  EXTRA_PARAMS: {
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
  },
} as const;

// ─── HTTP Headers / User Agents ──────────────────────────────────────────

/**
 * User-Agent strings giả lập Codex.
 * Gateway cần gửi đúng UA để không bị phát hiện là non-official client.
 */
export const USER_AGENTS = {
  /** Codex trên Linux (chuỗi UA chính thức) */
  CODEX_CLI_LINUX:
    'codex/0.1.0 (linux; x86_64) node/22.14.0',
  /** Codex trên macOS */
  CODEX_CLI_MACOS:
    'codex/0.1.0 (darwin; arm64) node/22.14.0',
} as const;

/**
 * Headers cần thiết để request trông giống Codex chính thức.
 */
export const HTTP_HEADERS_CONFIG = {
  /** Originator header — phải khớp với UA prefix */
  ORIGINATOR: 'codex-tui',
  /** Version header — phiên bản Codex */
  VERSION: '0.1.0',
  /** Content-Type */
  CONTENT_TYPE: 'application/json',
  /** Accept cho SSE stream */
  ACCEPT_SSE: 'text/event-stream',
  /** Beta features header */
  X_CODEX_BETA_FEATURES: 'remote_compaction_v2',
} as const;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  ORIGINATOR: 'Originator',
  VERSION: 'Version',
  CHATGPT_ACCOUNT_ID: 'Chatgpt-Account-Id',
  X_CODEX_BETA_FEATURES: 'X-Codex-Beta-Features',
  CONTENT_ENCODING: 'Content-Encoding',
} as const;

// ─── SSE Protocol ─────────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

/**
 * SSE event types từ Codex /responses stream.
 */
export const SSE_EVENTS = {
  RESPONSE_CREATED: 'response.created',
  RESPONSE_IN_PROGRESS: 'response.in_progress',
  RESPONSE_DONE: 'response.done',
  RESPONSE_FAILED: 'response.failed',
  RESPONSE_CANCELLED: 'response.cancelled',

  /** Output item (message, tool_call, v.v.) được thêm */
  OUTPUT_ITEM_ADDED: 'response.output_item.added',
  OUTPUT_ITEM_DONE: 'response.output_item.done',

  /** Content part bên trong output item */
  CONTENT_PART_ADDED: 'response.content_part.added',
  CONTENT_PART_DONE: 'response.content_part.done',

  /** Text delta — content chính */
  OUTPUT_TEXT_DELTA: 'response.output_text.delta',
  OUTPUT_TEXT_DONE: 'response.output_text.done',

  /** Reasoning (thinking) delta */
  REASONING_DELTA: 'response.reasoning.delta',
  REASONING_DONE: 'response.reasoning.done',
  REASONING_SUMMARY_DELTA: 'response.reasoning_summary.delta',
  REASONING_SUMMARY_DONE: 'response.reasoning_summary.done',

  /** Function call (tool use) */
  FUNCTION_CALL_ARGS_DELTA: 'response.function_call_arguments.delta',
  FUNCTION_CALL_ARGS_DONE: 'response.function_call_arguments.done',

  /** Usage info */
  USAGE: 'response.usage',

  /** Lỗi rate limit */
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  ERROR: 'error',
} as const;

// ─── Token Refresh ────────────────────────────────────────────────────────

export const TOKEN_REFRESH_CONFIG = {
  /** Refresh token khi access token còn ít hơn N giây */
  REFRESH_BEFORE_EXPIRY_SECS: 300,
  /** Timeout cho 1 lần refresh (ms) */
  REQUEST_TIMEOUT_MS: 30_000,
  /** Số lần retry khi gặp lỗi mạng */
  MAX_RETRIES: 2,
} as const;

// ─── Misc ─────────────────────────────────────────────────────────────────

export const SUCCESS_HTTP_STATUSES = [200, 201] as const;

/** Prefix của Bearer token trong Authorization header */
export const BEARER_PREFIX = 'Bearer ';

/** Login partition prefix cho browser session */
export const LOGIN_PARTITION_PREFIX = 'codex-';

/**
 * Event names dùng trong CDP login capture
 */
export const CODEX_EVENTS = {
  LOGIN_TOKEN: 'codex-login-token',
  LOGIN_EMAIL: 'codex-login-email',
} as const;

/** Model mapping: tên model phổ biến → model ID trong Codex */
export const MODEL_ALIASES: Record<string, string> = {
  'gpt-4o': 'codex-mini-latest',
  'gpt-4': 'codex-mini-latest',
  'o4-mini': 'o4-mini',
  'o3': 'o3',
};
