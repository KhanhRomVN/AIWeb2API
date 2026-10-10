/**
 * ------------------------------------------------------------------
 * Gemini CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Gemini CLI provider.
 * Gemini CLI dùng Code Assist API (cloudcode-pa.googleapis.com) thay vì
 * Gemini API trực tiếp, thông qua OAuth2 credential của Gemini CLI app.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD                  : 'oauth' flow
 * - MODELS                       : Danh sách models hỗ trợ
 * - CODE_ASSIST_ENDPOINT         : Base URL của Code Assist API
 * - OAUTH_CLIENT_ID/SECRET       : OAuth credential của Gemini CLI
 * - OAUTH_SCOPES                 : OAuth scopes cần thiết
 * - USER_AGENT_TEMPLATE          : User-Agent cho request
 * - THINKING_SUFFIXES            : Hậu tố điều khiển thinking budget/level
 * - SAFETY_SETTINGS              : Default safety settings
 * - API_PATHS                    : Endpoint paths
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'gemini-cli';
export const PROVIDER_NAME = 'Gemini CLI';
export const PROVIDER_DESCRIPTION =
  'Google Gemini models via Gemini CLI Code Assist API with OAuth authentication';
export const PROVIDER_COLOR = '#4285F4';
export const IS_ENABLED = false;
export const WEBSITE_URL = 'https://gemini.google.com';

/**
 * Auth method: 'oauth' — sử dụng OAuth2 flow của Gemini CLI.
 * Credential được lưu dưới dạng JSON gồm access_token, refresh_token, project_id, expiry.
 */
export const AUTH_METHOD = ['oauth'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const CAN_REGENERATE = true;

// ─── OAuth Configuration ─────────────────────────────────────────────

/**
 * OAuth client id/secret của Gemini CLI — đọc từ environment variables.
 * Dùng để xác thực với Google OAuth2, không phải credential của user.
 * Set trong .env: GEMINI_CLI_OAUTH_CLIENT_ID, GEMINI_CLI_OAUTH_CLIENT_SECRET
 */
export const OAUTH_CLIENT_ID =
  process.env.GEMINI_CLI_OAUTH_CLIENT_ID ??
  '';
export const OAUTH_CLIENT_SECRET =
  process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET ?? '';

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const USERINFO_ENDPOINT =
  'https://www.googleapis.com/oauth2/v2/userinfo';
export const RESOURCE_MANAGER_API =
  'https://cloudresourcemanager.googleapis.com/v1/projects';
export const SERVICE_USAGE_API =
  'https://serviceusage.googleapis.com/v1/projects';

/**
 * API cần bật để dùng Gemini CLI qua Code Assist:
 * - geminicloudassist.googleapis.com
 * - cloudaicompanion.googleapis.com
 */
export const REQUIRED_APIS = [
  'geminicloudassist.googleapis.com',
  'cloudaicompanion.googleapis.com',
];

// ─── API Configuration ───────────────────────────────────────────────

/**
 * Base endpoint của Code Assist API — upstream mà Gemini CLI dùng.
 * Khác với Gemini API trực tiếp (generativelanguage.googleapis.com).
 */
export const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';

export const API_PATHS = {
  STREAM_GENERATE: '/v1internal:streamGenerateContent',
  GENERATE_CONTENT: '/v1internal:generateContent',
} as const;

export const STREAM_QUERY_PARAMS = '?alt=sse';

// ─── User Agent ──────────────────────────────────────────────────────

/**
 * User-Agent template của Gemini CLI — giả lập CLI chính thức.
 * model sẽ được append vào cuối nếu có.
 */
export const USER_AGENT_BASE =
  'Mozilla/5.0 (compatible; Google-Gemini-CLI/1.0; +https://github.com/google-gemini/gemini-cli)';

// ─── Models ──────────────────────────────────────────────────────────

/**
 * Danh sách models Gemini CLI hỗ trợ (tĩnh).
 * Mỗi model có các thuộc tính thinking, search, upload,…
 */
export const MODELS = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'Google Gemini 2.5 Pro — Most capable model with advanced reasoning',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'Google Gemini 2.5 Flash — Fast and efficient with thinking support',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'Google Gemini 3 Flash Preview — Next-gen flash model (preview channel required)',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description:
      'Google Gemini 3.1 Pro Preview — Next-gen pro model (preview channel required)',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    is_thinking: false,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Google Gemini 3.1 Flash Lite — Lightweight and fast',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Google Gemini 3.5 Flash — Latest flash generation',
  },
] as const;

// ─── Thinking Configuration ──────────────────────────────────────────

/**
 * Hậu tố tên model điều khiển thinking (gắn vào model name của user).
 * Phải khớp với logic trong getThinkingSettings().
 *
 * Gemini 2.5 series → thinkingBudget (số token)
 * Gemini 3 series   → thinkingLevel (enum string)
 */
export const THINKING_SUFFIXES = {
  // Gemini 2.5 series — thinkingBudget
  GEMINI_25: ['-max', '-high', '-medium', '-low', '-minimal'] as const,
  // Gemini 3 Flash — thinkingLevel
  GEMINI_3_FLASH: ['-high', '-medium', '-low', '-minimal'] as const,
  // Gemini 3 Pro — thinkingLevel (không có medium)
  GEMINI_3_PRO: ['-high', '-low'] as const,
} as const;

export const SEARCH_SUFFIX = '-search';

/** Budget values cho Gemini 2.5 series */
export const THINKING_BUDGETS = {
  FLASH_MAX: 24576,
  PRO_MAX: 32768,
  HIGH: 16000,
  MEDIUM: 8192,
  LOW: 1024,
  FLASH_MINIMAL: 0,
  PRO_MINIMAL: 128,
} as const;

/** Level values cho Gemini 3 series */
export const THINKING_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

/** Giới hạn tham số output */
export const GENERATION_CONFIG_LIMITS = {
  MAX_OUTPUT_TOKENS: 64000,
  TOP_K: 64,
} as const;

// ─── Safety Settings ─────────────────────────────────────────────────

/**
 * Default safety settings — tắt hết bộ lọc để cho phép mọi nội dung.
 */
export const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
] as const;

/**
 * Safety settings nhẹ hơn cho gemini-2.5-flash-lite.
 */
export const LITE_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
] as const;

// ─── OAuth Device Code ───────────────────────────────────────────────

export const GOOGLE_DEVICE_CODE_URL =
  'https://oauth2.googleapis.com/device/code';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ─── OAuth Callback ───────────────────────────────────────────────────

/**
 * Port và host của redirect_uri cho Authorization Code flow.
 * Gemini CLI dùng localhost:11451 theo convention của gcli2api.
 */
export const OAUTH_CALLBACK_PORT = 11451;
export const OAUTH_CALLBACK_HOST = `localhost:${OAUTH_CALLBACK_PORT}`;
export const OAUTH_CALLBACK_URI = `http://${OAUTH_CALLBACK_HOST}`;

// ─── Proxy Events ────────────────────────────────────────────────────

export const GEMINI_CLI_EVENTS = {
  /** Emit khi proxy bắt được authorization code từ redirect về localhost */
  AUTH_CODE: 'gemini-cli-auth-code',
} as const;

// ─── Token Refresh Config ────────────────────────────────────────────

/**
 * Refresh token trước khi hết hạn N giây (5 phút = 300s).
 */
export const TOKEN_REFRESH_BUFFER_SECONDS = 300;

// ─── Retry Configuration ─────────────────────────────────────────────

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_INTERVAL_MS: 1000,
  RETRYABLE_STATUS_CODES: [429, 500, 503] as const,
} as const;

// ─── HTTP Header Names ───────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;
