/**
 * ------------------------------------------------------------------
 * ChatGPT Constants
 * ------------------------------------------------------------------
 * Tập trung constant cho ChatGPT provider (chatgpt.com upstream).
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / ... : metadata provider
 * - MODELS                            : danh sách model hỗ trợ
 * - BASE_URL                          : base URL chatgpt.com
 * - API_PATHS                         : endpoint paths
 * - USER_AGENT / CLIENT_VERSION       : header values
 * - SENTINEL                          : hằng số cho PoW sentinel
 * - POW_*                             : mảng lookup cho build_pow_config
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'chatgpt';
export const PROVIDER_NAME = 'ChatGPT';
export const PROVIDER_DESCRIPTION =
  'ChatGPT web backend with reasoning, text generation and file understanding';
export const PROVIDER_COLOR = '#10A37F';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://chatgpt.com';
export const AUTH_METHOD = ['google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = true;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'auto',
    name: 'ChatGPT Auto',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: true,
    is_larger_content_paste_upload: true,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'ChatGPT automatic model selection',
  },
  {
    id: 'gpt-5.6',
    name: 'GPT-5.6',
    is_thinking: true,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: true,
    is_larger_content_paste_upload: true,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GPT-5.6 with extended reasoning',
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    is_thinking: true,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: true,
    is_larger_content_paste_upload: true,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GPT-5 with reasoning',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: true,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: true,
    is_larger_content_paste_upload: true,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GPT-4o multimodal model',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://chatgpt.com';

export const API_PATHS = {
  ME: '/backend-api/me',
  MODELS: '/backend-api/models',
  CONVERSATION: '/backend-api/conversation',
  CHAT_REQUIREMENTS_PREPARE:
    '/backend-api/sentinel/chat-requirements/prepare',
  CHAT_REQUIREMENTS_FINALIZE:
    '/backend-api/sentinel/chat-requirements/finalize',
} as const;

export const CHATGPT_EVENTS = {
  AUTH_HEADER: 'chatgpt-auth-header',
  LOGIN_TOKEN: 'chatgpt-login-token',
  LOGIN_EMAIL: 'chatgpt-login-email',
  USER_INFO: 'chatgpt-user-info',
} as const;

export const LOGIN_PARTITION_PREFIX = 'chatgpt-';

// ─── HTTP Headers / User Agents ──────────────────────────────────────

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const CLIENT_VERSION =
  'prod-a194cd50d4416d3c0b47c740f206b12ce60f5887';
export const CLIENT_BUILD_NUMBER = '6708908';

export const DEFAULT_POW_SCRIPT =
  'https://chatgpt.com/backend-api/sentinel/sdk.js';

export const SEC_CH_UA =
  '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"';

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  ACCEPT: 'Accept',
  ACCEPT_LANGUAGE: 'Accept-Language',
  CACHE_CONTROL: 'Cache-Control',
  PRAGMA: 'Pragma',
  PRIORITY: 'Priority',
  SEC_CH_UA: 'Sec-Ch-Ua',
  SEC_CH_UA_ARCH: 'Sec-Ch-Ua-Arch',
  SEC_CH_UA_BITNESS: 'Sec-Ch-Ua-Bitness',
  SEC_CH_UA_FULL_VERSION: 'Sec-Ch-Ua-Full-Version',
  SEC_CH_UA_FULL_VERSION_LIST: 'Sec-Ch-Ua-Full-Version-List',
  SEC_CH_UA_MOBILE: 'Sec-Ch-Ua-Mobile',
  SEC_CH_UA_MODEL: 'Sec-Ch-Ua-Model',
  SEC_CH_UA_PLATFORM: 'Sec-Ch-Ua-Platform',
  SEC_CH_UA_PLATFORM_VERSION: 'Sec-Ch-Ua-Platform-Version',
  SEC_FETCH_DEST: 'Sec-Fetch-Dest',
  SEC_FETCH_MODE: 'Sec-Fetch-Mode',
  SEC_FETCH_SITE: 'Sec-Fetch-Site',
  SEC_FETCH_USER: 'Sec-Fetch-User',
  UPGRADE_INSECURE_REQUESTS: 'Upgrade-Insecure-Requests',
  OAI_DEVICE_ID: 'OAI-Device-Id',
  OAI_SESSION_ID: 'OAI-Session-Id',
  OAI_LANGUAGE: 'OAI-Language',
  OAI_CLIENT_VERSION: 'OAI-Client-Version',
  OAI_CLIENT_BUILD_NUMBER: 'OAI-Client-Build-Number',
  X_OPENAI_TARGET_PATH: 'X-OpenAI-Target-Path',
  X_OPENAI_TARGET_ROUTE: 'X-OpenAI-Target-Route',
  SENTINEL_CHAT_REQUIREMENTS: 'OpenAI-Sentinel-Chat-Requirements-Token',
  SENTINEL_PROOF_TOKEN: 'OpenAI-Sentinel-Proof-Token',
  SENTINEL_TURNSTILE_TOKEN: 'OpenAI-Sentinel-Turnstile-Token',
  SENTINEL_SO_TOKEN: 'OpenAI-Sentinel-SO-Token',
} as const;

export const HTTP_HEADER_NAMES_LOWERCASE = {
  AUTHORIZATION: 'authorization',
  COOKIE: 'cookie',
  OAI_DEVICE_ID: 'oai-device-id',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

export const REFERER_PATHS = {
  ROOT: '/',
} as const;

// ─── SSE Protocol ────────────────────────────────────────────────────

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  EVENT_PREFIX: 'event: ',
  DONE: '[DONE]',
} as const;

export const SSE_MESSAGE_TYPES = {
  MESSAGE_STREAM_COMPLETE: 'message_stream_complete',
  TITLE_GENERATION: 'title_generation',
  SUBSCRIPTION: 'subscription',
} as const;

export const SSE_CONTENT_TYPES = {
  TEXT: 'text',
  MULTIMODAL_TEXT: 'multimodal_text',
  THOUGHTS: 'thoughts',
  CODE: 'code',
  MODEL_EDIATED: 'model_editable_context',
} as const;

export const SSE_MESSAGE_STATUS = {
  IN_PROGRESS: 'in_progress',
  FINISHED_SUCCESSFULLY: 'finished_successfully',
  FINISHED_PARTIAL_COMPLETION: 'finished_partial_completion',
} as const;

export const ROLE_VALUES = {
  ASSISTANT: 'assistant',
  USER: 'user',
  SYSTEM: 'system',
  TOOL: 'tool',
} as const;

// ─── Sentinel / PoW ──────────────────────────────────────────────────

export const SENTINEL_TOKEN_PREFIX = {
  LEGACY_REQUIREMENTS: 'gAAAAAC',
  PROOF: 'gAAAAAB',
} as const;

export const POW_LIMIT = 500000;

export const POW_FALLBACK_PREFIX = 'wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D';

export const POW_CORES = [8, 16, 24, 32] as const;

export const POW_DOCUMENT_KEYS = [
  '__reactContainer$fzelfjyxej8',
  '_reactListening5dehydibo78',
  'location',
] as const;

export const POW_SCREEN_RESOLUTIONS = [
  [1920, 1080],
  [1440, 900],
  [2560, 1440],
  [3840, 2160],
] as const;

export const POW_NAVIGATOR_KEYS = [
  'registerProtocolHandler−function registerProtocolHandler() { [native code] }',
  'storage−[object StorageManager]',
  'locks−[object LockManager]',
  'appCodeName−Mozilla',
  'permissions−[object Permissions]',
  'share−function share() { [native code] }',
  'webdriver−false',
  'managed−[object NavigatorManagedData]',
  'canShare−function canShare() { [native code] }',
  'vendor−Google Inc.',
  'mediaDevices−[object MediaDevices]',
  'vibrate−function vibrate() { [native code] }',
  'storageBuckets−[object StorageBucketManager]',
  'mediaCapabilities−[object MediaCapabilities]',
  'cookieEnabled−true',
  'virtualKeyboard−[object VirtualKeyboard]',
  'product−Gecko',
  'presentation−[object Presentation]',
  'onLine−true',
  'mimeTypes−[object MimeTypeArray]',
  'credentials−[object CredentialsContainer]',
  'serviceWorker−[object ServiceWorkerContainer]',
  'keyboard−[object Keyboard]',
  'gpu−[object GPU]',
  'doNotTrack',
  'serial−[object Serial]',
  'pdfViewerEnabled−true',
  'language−zh-CN',
  'geolocation−[object Geolocation]',
  'userAgentData−[object NavigatorUAData]',
  'getUserMedia−function getUserMedia() { [native code] }',
  'sendBeacon−function sendBeacon() { [native code] }',
  'hardwareConcurrency−32',
  'windowControlsOverlay−[object WindowControlsOverlay]',
] as const;

export const POW_WINDOW_KEYS = [
  '0',
  'window',
  'self',
  'document',
  'name',
  'location',
  'customElements',
  'history',
  'navigation',
  'innerWidth',
  'innerHeight',
  'scrollX',
  'scrollY',
  'visualViewport',
  'screenX',
  'screenY',
  'outerWidth',
  'outerHeight',
  'devicePixelRatio',
  'screen',
  'chrome',
  'navigator',
  'onresize',
  'performance',
  'crypto',
  'indexedDB',
  'sessionStorage',
  'localStorage',
  'scheduler',
  'alert',
  'atob',
  'btoa',
  'fetch',
  'matchMedia',
  'postMessage',
  'queueMicrotask',
  'requestAnimationFrame',
  'setInterval',
  'setTimeout',
  'caches',
  '__NEXT_DATA__',
  '__BUILD_MANIFEST',
  '__NEXT_PRELOADREADY',
] as const;

export const POW_SCRIPT_SRC_REGEX = /c\/[^/]*\/_/;

export const POW_DATA_BUILD_REGEX = /<html[^>]*data-build="([^"]*)"/;

export const SUCCESS_STATUS_MIN = 200;
export const SUCCESS_STATUS_MAX = 300;

export const DEFAULT_TIMEZONE = 'Asia/Shanghai';
export const DEFAULT_TIMEZONE_OFFSET_MIN = -480;

export const CONVERSATION_MODE_PRIMARY_ASSISTANT = 'primary_assistant';