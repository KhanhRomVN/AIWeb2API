/**
 * ------------------------------------------------------------------
 * WorkBuddy / CodeBuddy Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho WorkBuddy provider.
 * WorkBuddy = Tencent CodeBuddy (phiên bản quốc tế: workbuddy.ai,
 * phiên bản CN: codebuddy.cn). Gateway tương thích OpenAI.
 *
 * Hai realm:
 *   - cn     → upstream: copilot.tencent.com, origin: www.codebuddy.cn
 *   - global → upstream: www.workbuddy.ai, origin: www.workbuddy.ai
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'workbuddy';
export const PROVIDER_NAME = 'WorkBuddy';
export const PROVIDER_DESCRIPTION =
  'Tencent CodeBuddy / WorkBuddy — OpenAI-compatible gateway for CN and Global realms';
export const PROVIDER_COLOR = '#0052CC';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://www.workbuddy.ai';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const CAN_REGENERATE = true;
export const SUPPORTS_SESSION_CLEANUP = false;

/**
 * Giới hạn request/account. undefined = không giới hạn.
 */
export const REQUEST_LIMIT: number | undefined = undefined;
export const REQUEST_LIMIT_PERIOD: 'day' | 'week' | 'month' = 'day';

/**
 * Khung giờ bị chặn (UTC). Để trống = không chặn.
 */
export const BLOCKED_TIME_RANGES: Array<{
  startTime: number;
  endTime: number;
}> = [];

// ─── Realm ───────────────────────────────────────────────────────────

/**
 * Realm mặc định khi credential không khai báo realm.
 * 'cn' = codebuddy.cn, 'global' = workbuddy.ai
 */
export const DEFAULT_REALM: 'cn' | 'global' = 'global';

// ─── Upstream Base URLs ───────────────────────────────────────────────

/** API base cho CN realm (chat/billing/auth) */
export const UPSTREAM_BASE_CN = 'https://copilot.tencent.com';
/** API base cho global realm */
export const UPSTREAM_BASE_GLOBAL = 'https://www.workbuddy.ai';

/** Origin/Referer cho CN */
export const ORIGIN_CN = 'https://www.codebuddy.cn';
/** Origin/Referer cho global */
export const ORIGIN_GLOBAL = 'https://www.workbuddy.ai';

// ─── Client Versions ─────────────────────────────────────────────────

/** WorkBuddy Desktop client version */
export const CLIENT_VERSION = '5.5.4';
/** CLI version */
export const CLI_VERSION = '2.137.1';

// ─── API Paths ───────────────────────────────────────────────────────

export const API_PATHS = {
  // Auth / token
  AUTH_TOKEN_REFRESH: '/v2/plugin/auth/token/refresh',
  LOGIN_STATE: '/v2/plugin/auth/state',
  LOGIN_TOKEN: '/v2/plugin/auth/token',
  LOGIN_ACCOUNT: '/v2/plugin/login/account',
  // Chat – CN realm
  CHAT_COMPLETIONS_V2: '/v2/chat/completions',
  // Chat – global realm (fallback to v2 if 404/405)
  CHAT_COMPLETIONS_CONSOLE: '/console/chat/completions',
  // Models
  MODELS_V3_CONFIG: '/v3/config',
  MODELS_ENTERPRISE: '/console/enterprises/personal/models',
  MODELS_GLOBAL_V2: '/v2/enterprises/personal/models',
  // Billing
  BILLING_USER_RESOURCE: '/v2/billing/meter/get-user-resource',
  BILLING_USER_RESOURCE_GLOBAL: '/billing/meter/get-user-resource',
  BILLING_DAILY_CHECKIN: '/v2/billing/meter/daily-checkin',
  BILLING_DAILY_CHECKIN_GLOBAL: '/billing/meter/daily-checkin',
} as const;

// ─── User Agents ─────────────────────────────────────────────────────

/**
 * WorkBuddy desktop UA:
 *   CN:     "WorkBuddy/<ver> WorkBuddy/<ver> CLI/<cliVer>"
 *   global: "WorkBuddy/<ver> WorkBuddy AI/<ver> CLI/<cliVer>"
 */
export const USER_AGENTS = {
  CN: `WorkBuddy/${CLIENT_VERSION} WorkBuddy/${CLIENT_VERSION} CLI/${CLI_VERSION}`,
  GLOBAL: `WorkBuddy/${CLIENT_VERSION} WorkBuddy AI/${CLIENT_VERSION} CLI/${CLI_VERSION}`,
  BILLING: `WorkBuddy/${CLIENT_VERSION}`,
  LOGIN: `CLI/${CLI_VERSION} CodeBuddy/${CLI_VERSION}`,
} as const;

// ─── HTTP Headers ─────────────────────────────────────────────────────

export const HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  ACCEPT_LANGUAGE: 'Accept-Language',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  USER_AGENT: 'User-Agent',
  X_REQUESTED_WITH: 'X-Requested-With',
  X_CODEBUDDY_REQUEST: 'X-CodeBuddy-Request',
  X_USER_ID: 'X-User-Id',
  X_ENTERPRISE_ID: 'X-Enterprise-Id',
  X_DOMAIN: 'X-Domain',
  X_NO_AUTHORIZATION: 'X-No-Authorization',
  X_NO_USER_ID: 'X-No-User-Id',
  X_NO_ENTERPRISE_ID: 'X-No-Enterprise-Id',
  X_NO_DEPARTMENT_INFO: 'X-No-Department-Info',
  X_REFRESH_TOKEN: 'X-Refresh-Token',
  X_DEVICE_TOKEN: 'X-Device-Token',
  X_MACHINE_ID: 'X-Machine-ID',
  X_SESSION_ID: 'X-Session-ID',
  X_IDE_VERSION: 'X-IDE-Version',
  RETRY_AFTER: 'Retry-After',
  RETRY_AFTER_MS: 'retry-after-ms',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  EVENT_STREAM: 'text/event-stream',
} as const;

// ─── SSE Protocol ─────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;

// ─── Credential Field Names ───────────────────────────────────────────

export const CREDENTIAL_FIELDS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  EXPIRES_AT: 'expiresAt',
  REALM: 'realm',
  UID: 'uid',
  ENTERPRISE_ID: 'enterpriseId',
  DEVICE_TOKEN: 'deviceToken',
} as const;

// ─── Error Codes / Markers ────────────────────────────────────────────

/** Markers nhận diện session upstream đã chết (cần đăng nhập lại) */
export const SESSION_DEAD_MARKERS = [
  'Offline user session not found',
  '12153',
] as const;

/** Markers nhận diện hết credit (cứng) */
export const HARD_CREDIT_MARKERS = [
  'insufficient credit', 'no credit', 'credit exhausted', 'credits exhausted',
  'out of credit', 'quota exceeded', 'quota exhaust', 'payment required',
  'credit not enough', 'not enough credit',
  '积分不足', '额度不足', '余额不足', '积分用完', '额度用尽', '没有积分',
] as const;

/** Markers nhận diện rate limit / throttle */
export const RATE_LIMIT_MARKERS = [
  'rate limit', 'rate-limiting', 'rate-limited',
  'too many requests', 'too many', 'usage limit',
  '请求过于频繁', '限流',
] as const;

/** Model bị chặn / không tồn tại */
export const MODEL_BLOCKED_CODE = '11102';

/** Prompt quá dài */
export const PROMPT_TOO_LONG_MARKERS = [
  '"code":11115', '"code": 11115', '"code":"11115"',
  'prompt is too long',
] as const;

/** Content bị chặn bởi security policy */
export const CONTENT_BLOCKED_MARKERS = [
  'blocked by security policy',
  'unapproved channel',
  'illegal api invocation',
] as const;

/** Account fault markers */
export const ACCOUNT_FAULT_MARKERS = [
  'request illegal',
  'trial not activated',
  'trial version is not yet activated',
] as const;

/** Bad params (request body lỗi) */
export const BAD_PARAMS_MARKER = 'Unmarshal chat params failed';

/** Invalid image markers */
export const INVALID_IMAGE_MARKERS = [
  'invalid image_url content',
  'invalid_image_data',
  'replace the image',
] as const;

// ─── Login OAuth ──────────────────────────────────────────────────────

export const LOGIN_PLATFORM = 'CLI';
export const LOGIN_STATE_FILE = 'workbuddy-login-state.json';

// ─── Token Refresh ─────────────────────────────────────────────────────

/** Refresh token expiry tối đa chấp nhận (10 năm = dữ liệu bẩn) */
export const REFRESH_TOKEN_MAX_EXPIRY_SECONDS = 10 * 365 * 24 * 3600;

// ─── Models ───────────────────────────────────────────────────────────

/**
 * Model mặc định khi không fetch được danh sách từ upstream.
 * WorkBuddy fetch model động từ upstream (/v3/config + enterprise), nên
 * danh sách tĩnh này chỉ là fallback.
 */
export const MODELS = [
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    is_thinking: false,
    max_context_length: 65536,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DeepSeek V3 via WorkBuddy',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 (Thinking)',
    is_thinking: true,
    max_context_length: 65536,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DeepSeek R1 with thinking/reasoning via WorkBuddy',
  },
] as const;

// ─── Timeouts ─────────────────────────────────────────────────────────

/** Timeout cho request refresh token (ms) */
export const REFRESH_TOKEN_TIMEOUT_MS = 30_000;
/** Timeout cho request fetch models (ms) */
export const FETCH_MODELS_TIMEOUT_MS = 20_000;
/** Timeout cho request chat (ms) */
export const CHAT_TIMEOUT_MS = 120_000;
