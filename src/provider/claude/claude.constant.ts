/**
 * ------------------------------------------------------------------
 * Claude Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Claude provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / CLAUDE_AUTH_METHODS / CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - FALLBACK_MODELS        : Danh sách models fallback (dùng khi bootstrap fail)
 * - BASE_URL               : Base URL của Claude AI
 * - CLAUDE_EVENTS          : Event names dùng trong proxy handler
 * - USER_AGENT             : User-Agent string dùng chung
 * - GOOGLE_OAUTH_LOGIN_URL : URL login qua Google
 * - API_PATHS              : Tất cả API endpoint paths
 * - ANTHROPIC_HEADERS      : Các header bắt buộc (anthropic-client-*, ...)
 * - HTTP_HEADER_NAMES / HTTP_HEADER_NAMES_LOWERCASE
 * - CONTENT_TYPES
 * - REFERER_PATHS
 * - API_FIELDS
 * - SSE_PROTOCOL / SSE_EVENT_TYPES
 * - DEFAULT_LOGIN_PATH / LOGIN_PARTITION_PREFIX
 * - MASKED_EMAIL_INDICATOR / MASKED_EMAIL_CHAR
 * - CLAUDE_HOST / CLAUDE_BOOTSTRAP_PATH_PREFIX
 * - DEFAULT_TIMEZONE / DEFAULT_LOCALE / DEFAULT_EFFORT / DEFAULT_THINKING_MODE
 *   / DEFAULT_RENDERING_MODE / DEFAULT_CHAT_MEMORY_MODE
 * - EFFORT_LEVELS / THINKING_MODES / WEB_SEARCH_TOOL
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

/**
 * Models fallback dùng khi bootstrap API fail.
 * Danh sách này không được coi là source-of-truth — models thực luôn lấy từ
 * `getModels()` (bootstrap `claude_ai_bootstrap_models_config`).
 */
export const FALLBACK_MODELS = [
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
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
    description: 'Most efficient for everyday tasks',
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
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

/**
 * JA3 fingerprint khớp với Chrome 146.
 * Lấy từ cycletls README (bộ cipher/extension/curve Chrome điển hình).
 * Nếu update USER_AGENT lên Chrome version mới hơn, phải cập nhật JA3 tương ứng
 * để tránh Cloudflare mismatch giữa UA và TLS ClientHello.
 */
export const CHROME_JA3 =
  '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0';

/**
 * HTTP/2 fingerprint khớp với Chrome (MASP priority, window size lớn).
 * Format: `<settings>|<windowUpdate>|<priority>|<pseudoHeaderOrder>`.
 */
export const CHROME_HTTP2_FINGERPRINT =
  '1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p';

/**
 * Thứ tự header chuẩn Chrome gửi cho API call JSON.
 * cycletls dùng array này để build header block theo đúng thứ tự.
 */
export const CHROME_HEADER_ORDER = [
  'host',
  'connection',
  'content-length',
  'sec-ch-ua',
  'anthropic-client-platform',
  'anthropic-client-version',
  'anthropic-client-build',
  'anthropic-client-sha',
  'anthropic-client-capabilities',
  'sec-ch-ua-mobile',
  'authorization',
  'content-type',
  'accept',
  'anthropic-dangerous-direct-browser-access',
  'sec-ch-ua-platform',
  'origin',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'referer',
  'accept-encoding',
  'accept-language',
  'cookie',
  'user-agent',
] as const;

export const GOOGLE_OAUTH_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://claude.ai/login';

export const API_PATHS = {
  /** Login bằng Google OAuth code + hcaptcha token (không dùng trong CDP flow). */
  VERIFY_GOOGLE: '/api/auth/verify_google',
  /** Bootstrap account + models config. Cần organizationId. */
  BOOTSTRAP: (orgId: string) =>
    `/edge-api/bootstrap/${orgId}/app_start?statsig_hashing_algorithm=djb2&growthbook_format=sdk&cache_bust=1&include_system_prompts=false`,
  /** Gửi tin nhắn (SSE stream). */
  COMPLETION: (orgId: string, convId: string) =>
    `/api/organizations/${orgId}/chat_conversations/${convId}/completion`,
  /** Đặt title cho conversation (best-effort, không ảnh hưởng response). */
  TITLE: (orgId: string, convId: string) =>
    `/api/organizations/${orgId}/chat_conversations/${convId}/title`,
  /** Upload file lên conversation. */
  UPLOAD_FILE: (orgId: string, convId: string) =>
    `/api/organizations/${orgId}/conversations/${convId}/wiggle/upload-file`,
  /** Load conversation (dùng cho tiếp tục hội thoại cũ). */
  CONVERSATION: (orgId: string, convId: string) =>
    `/api/organizations/${orgId}/chat_conversations/${convId}?tree=True&rendering_mode=messages&render_all_tools=true&include_inline_comparison=true&consistency=eventual`,
} as const;

/**
 * Headers mà claude.ai yêu cầu cho mọi API call.
 * Không bao gồm Cookie — được set riêng theo từng credential.
 */
export const ANTHROPIC_HEADERS = {
  CLIENT_PLATFORM: 'web_claude_ai',
  CLIENT_VERSION: '1.0.0',
  CLIENT_BUILD: '1789600962',
  CLIENT_SHA: 'dcb28fad37dadc374fa62d9a8f8ca9a64793f9ee',
  CLIENT_CAPABILITIES: 'mfa_sms_v1',
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
  ACCEPT: 'Accept',
  ACCEPT_LANGUAGE: 'Accept-Language',
  ACCEPT_ENCODING: 'Accept-Encoding',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  SEC_CH_UA: 'sec-ch-ua',
  SEC_CH_UA_MOBILE: 'sec-ch-ua-mobile',
  SEC_CH_UA_PLATFORM: 'sec-ch-ua-platform',
  SEC_FETCH_DEST: 'Sec-Fetch-Dest',
  SEC_FETCH_MODE: 'Sec-Fetch-Mode',
  SEC_FETCH_SITE: 'Sec-Fetch-Site',
  PRIORITY: 'priority',
  ANTHROPIC_CLIENT_PLATFORM: 'anthropic-client-platform',
  ANTHROPIC_CLIENT_VERSION: 'anthropic-client-version',
  ANTHROPIC_CLIENT_BUILD: 'anthropic-client-build',
  ANTHROPIC_CLIENT_SHA: 'anthropic-client-sha',
  ANTHROPIC_CLIENT_CAPABILITIES: 'anthropic-client-capabilities',
} as const;

/**
 * Giá trị header fingerprint của Chrome 146 (khớp USER_AGENT).
 * Dùng chung cho mọi request tới claude.ai để qua Cloudflare.
 */
export const CHROME_FINGERPRINT_HEADERS = {
  SEC_CH_UA: '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  SEC_CH_UA_MOBILE: '?0',
  SEC_CH_UA_PLATFORM: '"Linux"',
  ACCEPT_LANGUAGE: 'en-US,en;q=0.9',
  ACCEPT_ENCODING: 'gzip, deflate, br, zstd',
  SEC_FETCH_DEST: 'empty',
  SEC_FETCH_MODE: 'cors',
  SEC_FETCH_SITE: 'same-origin',
  PRIORITY: 'u=1, i',
} as const;

export const HTTP_HEADER_NAMES_LOWERCASE = {
  AUTHORIZATION: 'authorization',
  COOKIE: 'cookie',
  SET_COOKIE: 'set-cookie',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
  SSE: 'text/event-stream',
  MULTIPART_PREFIX: 'multipart/form-data; boundary=',
} as const;

// ─── Referer Paths ────────��──────────────────────────────────────────

export const REFERER_PATHS = {
  ROOT: '/',
  NEW: '/new',
  LOGIN: '/login',
  CHAT_PREFIX: '/chat/',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  // User / profile
  EMAIL: 'email',
  EMAIL_ADDRESS: 'email_address',
  NAME: 'name',
  FULL_NAME: 'full_name',
  DISPLAY_NAME: 'display_name',
  ID: 'id',
  UUID: 'uuid',
  TAGGED_ID: 'tagged_id',
  COOKIES: 'cookies',
  TOKEN: 'token',
  ORGANIZATION_ID: 'organizationId',
  // Bootstrap
  ACCOUNT: 'account',
  MEMBERSHIPS: 'memberships',
  ORGANIZATION: 'organization',
  MODELS_CONFIG: 'claude_ai_bootstrap_models_config',
  MODEL: 'model',
  // Completion
  PROMPT: 'prompt',
  TIMEZONE: 'timezone',
  LOCALE: 'locale',
  EFFORT: 'effort',
  THINKING_MODE: 'thinking_mode',
  TURN_MESSAGE_UUIDS: 'turn_message_uuids',
  HUMAN_MESSAGE_UUID: 'human_message_uuid',
  ASSISTANT_MESSAGE_UUID: 'assistant_message_uuid',
  COMPLETION_REQUEST_ID: 'completion_request_id',
  RENDERING_MODE: 'rendering_mode',
  CREATE_CONVERSATION_PARAMS: 'create_conversation_params',
  CHAT_MEMORY_MODE: 'chat_memory_mode',
  FILES: 'files',
  ATTACHMENTS: 'attachments',
  // Upload
  FILE_UUID: 'file_uuid',
  FILE_NAME: 'file_name',
  SUCCESS: 'success',
} as const;

// ─── Defaults for Completion Payload ─────────────────────────────────

export const DEFAULT_TIMEZONE = 'Asia/Saigon';
export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_EFFORT = 'medium';
export const DEFAULT_THINKING_MODE = 'auto';
export const DEFAULT_RENDERING_MODE = 'messages';
export const DEFAULT_CHAT_MEMORY_MODE = 'enabled';

/**
 * Các mức effort claude.ai chấp nhận cho completion request.
 * `getModels()` nhân mỗi model base với từng mức này để tạo model id
 * dạng `<base>-<effort>` (ví dụ `claude-sonnet-5-medium`).
 *
 * Lưu ý: hiện chỉ `low` và `medium` được xác nhận trong traffic capture.
 * `high` / `extra` / `max` theo yêu cầu — nếu API từ chối, chỉ cần rút gọn
 * mảng này, phần còn lại tự thích nghi.
 */
export const EFFORT_LEVELS = [
  'low',
  'medium',
  'high',
  'extra',
  'max',
] as const;

/** Giá trị `thinking_mode` trong completion payload. */
export const THINKING_MODES = {
  /** Tắt thinking hoàn toàn. */
  OFF: 'off',
  /** Để claude.ai tự quyết định (bật thinking cho model hỗ trợ). */
  AUTO: 'auto',
} as const;

/** Tool descriptor để bật web search trong completion request. */
export const WEB_SEARCH_TOOL = {
  type: 'web_search_v0',
  name: 'web_search',
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
export const CLAUDE_BOOTSTRAP_PATH_PREFIX = '/edge-api/bootstrap';
export const DEFAULT_LOGIN_PATH = '/login';
export const LOGIN_PARTITION_PREFIX = 'claude-';

// ─── Limits / Misc ───────────────────────────────────────────────────

export const MASKED_EMAIL_INDICATOR = '***';
export const MASKED_EMAIL_CHAR = '*';

// ─── Hosts ───────────────────────────────────────────────────────────

export const CLAUDE_HOST = 'claude.ai';