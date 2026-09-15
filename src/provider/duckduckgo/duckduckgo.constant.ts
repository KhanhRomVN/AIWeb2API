/**
 * ------------------------------------------------------------------
 * DuckDuckGo Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho DuckDuckGo provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - BASE_URL            : Base URL của DuckDuckGo AI
 * - API_PATHS           : Tất cả API endpoint paths
 * - MODELS              : Danh sách models hỗ trợ
 * - MODEL_ALIASES       : Model alias mapping
 * - DEFAULT_MODEL       : Model mặc định
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'duckduckgo';
export const PROVIDER_NAME = 'DuckDuckGo';
export const PROVIDER_DESCRIPTION = 'Free AI chat powered by DuckDuckGo with multiple models';
export const PROVIDER_COLOR = '#DE5833';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://duck.ai';
export const AUTH_METHOD = [] as const; // No authentication required
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://duck.ai';
export const STATUS_URL = `${BASE_URL}/duckchat/v1/status`;
export const CHAT_URL = `${BASE_URL}/duckchat/v1/chat`;
export const MODELS_URL = `${BASE_URL}/duckchat/v1/models`;

export const API_PATHS = {
  STATUS: '/duckchat/v1/status',
  CHAT: '/duckchat/v1/chat',
  MODELS: '/duckchat/v1/models',
} as const;

// ─── Models ──────────────────────────────────────────────────────────

export const DEFAULT_MODEL = 'gpt-5o';

export const MODEL_ALIASES: Record<string, string> = {
  'gpt-5o': 'gpt-5o',
  'claude-haiku-4-5': 'claude-haiku-4-5',
  'gpt-5.6-luna': 'gpt-5.6-luna',
  'llama-3.3-70b': 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'mixtral-8x7b': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
} as const;

export const MODELS = [
  {
    id: 'gpt-5o',
    name: 'GPT-5o',
    is_thinking: false,
    max_context_length: 128000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DuckDuckGo AI - GPT-5o model',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    is_thinking: false,
    max_context_length: 200000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DuckDuckGo AI - Claude Haiku 4.5 model',
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    is_thinking: false,
    max_context_length: 128000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DuckDuckGo AI - GPT-5.6 Luna model',
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    is_thinking: false,
    max_context_length: 128000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DuckDuckGo AI - Llama 3.3 70B Instruct',
  },
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    is_thinking: false,
    max_context_length: 32000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DuckDuckGo AI - Mixtral 8x7B Instruct',
  },
] as const;

// ─── HTTP Headers / User Agents ──────────────────────────────────────

export const USER_AGENTS = {
  LINUX_CHROME:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
} as const;

export const HTTP_HEADERS = {
  ACCEPT: '*/*',
  ACCEPT_ENCODING: 'gzip, deflate, br, zstd',
  ACCEPT_LANGUAGE: 'en-US,en;q=0.9',
  CACHE_CONTROL: 'no-cache',
  PRAGMA: 'no-cache',
  PRIORITY: 'u=1, i',
  SEC_CH_UA: '"Chromium";v="149", "Not-A.Brand";v="24", "Google Chrome";v="149"',
  SEC_CH_UA_MOBILE: '?0',
  SEC_CH_UA_PLATFORM: '"Linux"',
  SEC_FETCH_DEST: 'empty',
  SEC_FETCH_MODE: 'cors',
  SEC_FETCH_SITE: 'same-origin',
} as const;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  REFERER: 'Referer',
  ORIGIN: 'Origin',
  ACCEPT: 'Accept',
  X_VQD_4: 'x-vqd-4',
  X_VQD_HASH_1: 'x-vqd-hash-1',
  X_VQD_ACCEPT: 'x-vqd-accept',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
  EVENT_STREAM: 'text/event-stream',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

export const API_FIELDS = {
  MODEL: 'model',
  MESSAGES: 'messages',
  ROLE: 'role',
  CONTENT: 'content',
  MESSAGE: 'message',
  ACTION: 'action',
  STATUS: 'status',
} as const;

// ─── Reasoning Effort ────────────────────────────────────────────────

export const REASONING_EFFORT = {
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

// ─── Model Capabilities ──────────────────────────────────────────────

export const MODEL_CAPABILITIES: Record<
  string,
  { reasoningEffort: string }
> = {
  'claude-haiku-4-5': { reasoningEffort: REASONING_EFFORT.LOW },
  'tinfoil/gpt-oss-120b': { reasoningEffort: REASONING_EFFORT.LOW },
} as const;

// ─── Misc ────────────────────────────────────────────────────────────

export const FETCH_TIMEOUT_MS = 30_000;
export const DEFAULT_FE_VERSION = 'serp_20260424_180649_ET-0bdc33b2a02ebf8f235def65d887787f694720a1';

// ─── Circuit Breaker ─────────────────────────────────────────────────

export const CB_THRESHOLD = 5;
export const CB_COOLDOWN_MS = 30_000;
