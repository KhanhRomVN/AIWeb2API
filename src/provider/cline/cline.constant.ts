/**
 * ------------------------------------------------------------------
 * Cline Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Cline provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD         : Danh sách auth method
 * - CONNECTION_TYPE / IS_PAUSABLE
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URL            : Base URL của Cline API
 * - API_PATHS           : Tất cả API endpoint paths
 * - HTTP_HEADERS        : Header values dùng chung (X-Client-*)
 * - CLINE_EVENTS        : Event names dùng trong proxy handler
 * - DEFAULT_MODEL       : Model mặc định
 * - MODELS_TTL          : TTL cho cache model list
 * - FREE_MODEL_WHITELIST: Danh sách model free được hardcode
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'cline';
export const PROVIDER_NAME = 'Cline';
export const PROVIDER_DESCRIPTION =
  'Cline AI API — reverse proxy hỗ trợ OpenAI/Anthropic format với token rotation';
export const PROVIDER_COLOR = '#6B4FBB';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://cline.bot';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const CAN_REGENERATE = true;
export const SUPPORTS_SESSION_CLEANUP = false;

/**
 * Giới hạn request/account. undefined = không giới hạn.
 */
export const REQUEST_LIMIT = undefined;

export const REQUEST_LIMIT_PERIOD: 'day' | 'week' | 'month' = 'day';

/**
 * Khung giờ bị chặn (UTC). Để tắt: set = [].
 */
export const BLOCKED_TIME_RANGES: Array<{
  startTime: number;
  endTime: number;
}> = [];

// ─── Models ──────────────────────────────────────────────────────────

export const DEFAULT_MODEL = 'cline-free/deepseek-v4.1-flash';

/**
 * Danh sách model hardcode fallback khi không lấy được từ API.
 * Dynamic model list sẽ được refresh từ https://api.cline.bot/api/v1/models
 * mỗi MODELS_TTL ms.
 */
export const MODELS = [
  {
    id: 'cline-free/deepseek-v4.1-flash',
    name: 'Cline Free DeepSeek V4.1 Flash',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Cline official free channel — DeepSeek V4.1 Flash, no credits needed',
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash (via Cline)',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DeepSeek V4 Flash via Cline proxy',
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    name: 'Poolside Laguna S 2.1 (Free)',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Poolside Laguna S 2.1 free tier via Cline',
  },
  {
    id: 'zai/glm-5.3-flash',
    name: 'ZAI GLM 5.3 Flash (via Cline)',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'ZAI GLM 5.3 Flash via Cline proxy',
  },
] as const;

// ─── Model Cache TTL ─────────────────────────────────────────────────

/** Thời gian cache model list từ upstream (ms). Default 10 phút. */
export const MODELS_TTL = 10 * 60 * 1000;

/**
 * Whitelist model free được hardcode (dùng khi lọc dynamic model list).
 * Những model này không cần `:free` suffix vẫn được tính là free.
 */
export const FREE_MODEL_WHITELIST = [
  'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-v4-flash-0731',
  'z-ai/glm-5.3-flash',
  'z-ai/glm-5.2:free',
  'xiaomi/mimo-v2.5',
  'minimax/minimax-m3',
  'poolside/laguna-s-2.1',
  'cline-free/deepseek-v4.1-flash',
  'cline-free/muse-spark-1.3-contributor',
  'cline-free/solar-pro4',
] as const;

/**
 * Prefix của model cần force streaming về phía upstream.
 * Upstream không hỗ trợ non-stream cho các prefix này → phải stream + aggregate.
 */
export const FORCE_STREAM_PREFIXES = [
  'deepseek/',
  'cline-free/',
  'cline-pass/',
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://api.cline.bot/api/v1';

export const API_PATHS = {
  AUTH_REFRESH: '/auth/refresh',
  CHAT_COMPLETIONS: '/chat/completions',
  MODELS: '/models',
  RECOMMENDED_MODELS: '/ai/cline/recommended-models',
} as const;

// ─── Cline Client Fingerprint Headers ───────────────────────────────

/**
 * Header giả lập Cline official client (version 3.0.47).
 * Thiếu các header này sẽ bị upstream 403:
 * "deepseek/deepseek-v4-flash is only available via Cline product surfaces"
 */
export const CLIENT_VERSION = '3.0.47';
export const CORE_VERSION = '0.0.66';

export const HTTP_HEADERS = {
  USER_AGENT: `Cline/${CLIENT_VERSION}`,
  HTTP_REFERER: 'https://cline.bot',
  X_TITLE: 'Cline',
  X_IS_MULTIROOT: 'false',
  X_CLIENT_TYPE: 'cline-sdk',
  X_CLIENT_VERSION: CLIENT_VERSION,
  X_PLATFORM: 'terminal',
  X_PLATFORM_VERSION: CLIENT_VERSION,
  X_CORE_VERSION: CORE_VERSION,
} as const;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  HTTP_REFERER: 'HTTP-Referer',
  X_TITLE: 'X-Title',
  X_IS_MULTIROOT: 'X-IS-MULTIROOT',
  X_CLIENT_TYPE: 'X-CLIENT-TYPE',
  X_CLIENT_VERSION: 'X-CLIENT-VERSION',
  X_PLATFORM: 'X-PLATFORM',
  X_PLATFORM_VERSION: 'X-PLATFORM-VERSION',
  X_CORE_VERSION: 'X-CORE-VERSION',
  X_TASK_ID: 'X-Task-ID',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

export const AUTH_PREFIX = 'Bearer workos:';

// ─── WorkOS OAuth ────────────────────────────────────────────────────

export const WORKOS_DEVICE_URL =
  'https://api.workos.com/user_management/authorize/device';
export const WORKOS_AUTH_URL =
  'https://api.workos.com/user_management/authenticate';
export const CLINE_REGISTER_URL = `${BASE_URL}/auth/register`;
export const WORKOS_CLIENT_ID = 'client_01K3A541FN8TA3EPPHTD2325AR';

// ─── Token / Account Management ─────────────────────────────────────

/**
 * Khoảng cách tối thiểu giữa 2 upstream request liên tiếp (ms).
 * Upstream free channel bị limit khi concurrent > 1 → serialize requests.
 */
export const MIN_GAP_MS = 800;

/** Số lần retry tối đa khi upstream trả lỗi / empty response. */
export const MAX_RETRIES = 4;

/** Thời gian cooldown khi token refresh thất bại (ms). */
export const ACCOUNT_COOLDOWN_MS = 60 * 1000;

/** Thời gian cooldown khi account trả empty content (ms). */
export const EMPTY_CONTENT_COOLDOWN_MS = 30 * 1000;

/** Thời gian cooldown mặc định khi 429 (ms). */
export const DEFAULT_429_COOLDOWN_MS = 5 * 60 * 1000;

/** Thời gian cooldown mặc định khi empty response (ms). */
export const DEFAULT_EMPTY_COOLDOWN_MS = 60 * 1000;

/** Cooldown tối đa (ms). Upper bound khi parse "Try again in Xh Ym". */
export const MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Số lần thử tối đa khi aggregate non-stream với content check. */
export const MAX_NONSTREAM_ATTEMPTS = 3;

// ─── Cline Events ────────────────────────────────────────────────────

export const CLINE_EVENTS = {
  LOGIN_TOKEN: 'cline-login-token',
  LOGIN_EMAIL: 'cline-login-email',
} as const;

// ─── SSE ─────────────────────────────────────────────────────────────

export const SSE_DONE = '[DONE]';
export const DATA_PREFIX = 'data:';
export const VERSION = '1.1.8';
