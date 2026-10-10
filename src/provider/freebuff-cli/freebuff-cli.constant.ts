/**
 * ------------------------------------------------------------------
 * Freebuff CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng cho Freebuff CLI / Bearer protocol.
 * Giao thức này giao tiếp với https://www.codebuff.com.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / CONNECTION_TYPE / IS_PAUSABLE / CAN_REGENERATE
 * - BASE_URL / API_PATHS
 * - USER_AGENTS / HTTP_HEADERS
 * - MODELS / DEFAULT_MODEL_ID
 * - SESSION_CONFIG / ADS_CONFIG
 * - SSE_PROTOCOL / SSE_DONE_MARKER
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────────

export const PROVIDER_ID = 'freebuff-cli';
export const PROVIDER_NAME = 'Freebuff CLI';
export const PROVIDER_DESCRIPTION =
  'Freebuff CLI / Bearer protocol — multi-model chat via codebuff.com. GLM 5.3, DeepSeek V4, MiMo, MiniMax, Solar, GPT-6.';
export const PROVIDER_COLOR = '#4CAF50';
export const IS_ENABLED = false;
export const WEBSITE_URL = 'https://freebuff.com/';
export const AUTH_LOGIN_URL = 'https://www.codebuff.com';
export const AUTH_METHOD = ['bearer'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const CAN_REGENERATE = false;

/**
 * Giới hạn request/account. undefined = không giới hạn.
 */
export const REQUEST_LIMIT = undefined;
export const REQUEST_LIMIT_PERIOD: 'day' | 'week' | 'month' = 'day';

/**
 * Khung giờ bị chặn (UTC). Set = [] để không chặn.
 */
export const BLOCKED_TIME_RANGES: Array<{
  startTime: number;
  endTime: number;
}> = [];

// ─── URLs ────────────────────────────────────────────────────────────────

/**
 * Upstream host cho giao thức Bearer/CLI.
 * NOTE: Khác với freebuff.com (web/cookie protocol).
 */
export const BASE_URL = 'https://www.codebuff.com';

export const API_PATHS = {
  /** Tạo / kiểm tra session freebuff */
  FREEBUFF_SESSION: '/api/v1/freebuff/session',
  /** Bắt đầu / kết thúc agent run */
  AGENT_RUNS: '/api/v1/agent-runs',
  /** Chat completion (OpenAI-compatible, nhưng kèm codebuff_metadata) */
  CHAT_COMPLETIONS: '/api/v1/chat/completions',
  /** Quảng cáo — dùng để gia hạn session khi sắp hết hạn */
  ADS: '/api/v1/ads',
  ADS_IMPRESSION: '/api/v1/ads/impression',
} as const;

// ─── HTTP Headers ─────────────────────────────────────────────────────────

/**
 * User-Agent mà CLI client của Freebuff/Codebuff sử dụng.
 * Cần thiết để server nhận diện đúng giao thức CLI (tránh TLS fingerprint check).
 */
export const BEARER_USER_AGENT = 'ai-sdk/openai-compatible/1.0.25/codebuff';

/**
 * Header cố định cho tất cả request giao thức Bearer.
 */
export const BEARER_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'text/event-stream',
  'User-Agent': BEARER_USER_AGENT,
} as const;

/**
 * Header names dùng trong giao thức này.
 */
export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ACCEPT: 'Accept',
  /** Header để chỉ định model khi tạo session */
  X_FREEBUFF_MODEL: 'x-freebuff-model',
  /** Instance ID của session — sinh tất định từ token (FNV-1a) */
  X_FREEBUFF_INSTANCE_ID: 'x-freebuff-instance-id',
  /** Multi-session flag */
  X_FREEBUFF_MULTI_SESSION: 'x-freebuff-multi-session',
  /** Heartbeat flag — gửi khi keepalive */
  X_FREEBUFF_HEARTBEAT: 'x-freebuff-heartbeat',
  /** Include unused rate limits trong response session */
  X_FREEBUFF_INCLUDE_UNUSED_RATE_LIMITS:
    'x-freebuff-include-unused-rate-limits',
} as const;

export const BEARER_PREFIX = 'Bearer ';

// ─── Session ─────────────────────────────────────────────────────────────

export const SESSION_CONFIG = {
  /** Gửi heartbeat mỗi N ms */
  HEARTBEAT_INTERVAL_MS: 45_000,
  /** Ngưỡng còn lại (giây) → gia hạn bằng quảng cáo */
  ADS_RENEWAL_THRESHOLD_SECS: 120,
  /** Timeout tạo session (ms) */
  SESSION_TIMEOUT_MS: 30_000,
  /** Thời gian chờ tối đa khi session "queued" (ms) */
  QUEUE_MAX_WAIT_MS: 60_000,
} as const;

// ─── Ads (gia hạn session) ────────────────────────────────────────────────

export const ADS_CONFIG = {
  PLACEMENT: 'Desktop-Below-Chat',
} as const;

// ─── Agent Run ────────────────────────────────────────────────────────────

export const AGENT_CONFIG = {
  ROOT_AGENT_ID: 'base2-free',
  COST_MODE: 'free' as const,
} as const;

// ─── SSE ─────────────────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE_MARKER: '[DONE]',
} as const;

// ─── Models ──────────────────────────────────────────────────────────────

/**
 * Model ID mặc định khi caller không truyền model.
 */
export const DEFAULT_MODEL_ID = 'z-ai/glm-5.3-flash';

/**
 * Danh sách models hỗ trợ.
 * Nguồn: HARDCODED_MODELS trong src/models.rs của Freebuff2API Rust source.
 * Danh sách đầy đủ hơn freebuff (web) vì giao thức CLI hỗ trợ nhiều model hơn.
 */
export const MODELS = [
  {
    id: 'z-ai/glm-5.3-flash',
    name: 'GLM 5.3 Flash',
    is_thinking: true,
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
    description: 'GLM 5.3 Flash — default model, fast responses',
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    is_thinking: true,
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
    description: 'DeepSeek V4 Flash — fast with thinking support',
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    is_thinking: true,
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
    description: 'DeepSeek V4 Pro — advanced reasoning',
  },
  {
    id: 'mimo/mimo-v2.5',
    name: 'MiMo V2.5',
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
    description: 'MiMo V2.5',
  },
  {
    id: 'minimax/minimax-m3',
    name: 'MiniMax M3',
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
    description: 'MiniMax M3',
  },
  {
    id: 'openai/gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    is_thinking: true,
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
    description: 'GPT-5.6 Luna — advanced with thinking',
  },
  {
    id: 'google/gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    is_thinking: true,
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
    description: 'Gemini 3.8 Flash — Google model with thinking',
  },
  {
    id: 'anthropic/claude-fable-5',
    name: 'Claude Fable 5',
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
    description: 'Claude Fable 5 — Anthropic model',
  },
  {
    id: 'solar-pro4',
    name: 'Solar Pro 4',
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
    description: 'Solar Pro 4',
  },
  {
    id: 'kimi/kimi-k3-eco',
    name: 'Kimi K3 Eco',
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
    description: 'Kimi K3 Eco',
  },
  {
    id: 'meta/muse-spark-1.2',
    name: 'Muse Spark 1.2',
    is_thinking: true,
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
    description: 'Muse Spark 1.2',
  },
] as const;

/**
 * Models có hỗ trợ reasoning effort.
 * Map: model ID → danh sách effort hợp lệ theo thứ tự tăng dần.
 */
export const THINKING_MODEL_EFFORTS: Readonly<
  Record<string, readonly string[]>
> = {
  'z-ai/glm-5.3-flash': ['low', 'high', 'max'],
  'deepseek/deepseek-v4-flash': ['low', 'high', 'max'],
  'deepseek/deepseek-v4-pro': ['low', 'high', 'max'],
  'openai/gpt-5.6-luna': ['low', 'medium', 'high', 'xhigh', 'max'],
  'google/gemini-3.8-flash': ['low', 'medium', 'high', 'xhigh', 'max'],
  'meta/muse-spark-1.2': ['minimal', 'low', 'medium', 'high', 'xhigh'],
} as const;

/**
 * Default reasoning effort cho từng thinking model.
 */
export const THINKING_MODEL_DEFAULT_EFFORT: Readonly<Record<string, string>> = {
  'z-ai/glm-5.3-flash': 'max',
  'deepseek/deepseek-v4-flash': 'high',
  'deepseek/deepseek-v4-pro': 'high',
  'openai/gpt-5.6-luna': 'high',
  'google/gemini-3.8-flash': 'high',
  'meta/muse-spark-1.2': 'xhigh',
} as const;

// ─── Events ───────────────────────────────────────────────────────────────

export const FREEBUFF_CLI_EVENTS = {
  LOGIN_TOKEN: 'freebuff-cli-login-token',
  LOGIN_EMAIL: 'freebuff-cli-login-email',
} as const;

// ─── Error handling ───────────────────────────────────────────────────────

export const RETRY_CONFIG = {
  /** HTTP status codes → đổi tài khoản */
  AUTH_ERROR_CODES: [401, 403],
  /** HTTP status code → backoff */
  RATE_LIMIT_CODE: 429,
  /** Số lần retry tối đa */
  MAX_RETRIES: 1,
} as const;
