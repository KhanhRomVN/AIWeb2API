/**
 * ------------------------------------------------------------------
 * Grok Build CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Grok Build CLI provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - BASE_URL            : Base URL của Grok Build API
 * - API_PATHS           : Tất cả API endpoint paths
 * - MODELS              : Danh sách models hỗ trợ (sync với OmniRoute registry)
 * - OAUTH_CONFIG        : OAuth configuration
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'grok-build-cli';
export const PROVIDER_NAME = 'Grok Build CLI';
export const PROVIDER_DESCRIPTION = 'Grok Build CLI with OAuth authentication';
export const PROVIDER_COLOR = '#000000';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://x.ai';
export const AUTH_METHOD = ['x'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://cli-chat-proxy.grok.com/v1';
export const OAUTH_ISSUER = 'https://auth.x.ai';

export const API_PATHS = {
  RESPONSES: '/responses',
  MODELS: '/models',
  DEVICE_CODE: '/oauth2/device/code',
  TOKEN: '/oauth2/token',
} as const;

export const RESPONSES_URL = `${BASE_URL}${API_PATHS.RESPONSES}`;
export const MODELS_URL = `${BASE_URL}${API_PATHS.MODELS}`;
export const DEVICE_CODE_URL = `${OAUTH_ISSUER}${API_PATHS.DEVICE_CODE}`;
export const TOKEN_URL = `${OAUTH_ISSUER}${API_PATHS.TOKEN}`;

// ─── Models ──────────────────────────────────────────────────────────
// Synced with OmniRoute open-sse/config/providers/registry/grok-cli/index.ts

export const MODELS = [
  {
    id: 'grok-4.6',
    name: 'Grok 4.6',
    is_thinking: true,
    max_context_length: 500_000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Grok 4.6 with reasoning capabilities',
  },
  {
    id: 'grok-4.5',
    name: 'Grok 4.5',
    is_thinking: true,
    max_context_length: 500_000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Grok 4.5 with reasoning capabilities',
  },
  {
    id: 'grok-composer-2.5-fast',
    name: 'Grok Composer 2.5 Fast',
    is_thinking: false,
    max_context_length: 200_000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Grok Composer 2.5 Fast model',
  },
] as const;

// ─── OAuth Configuration ─────────────────────────────────────────────

export const CLIENT_IDENTIFIER = 'grok-shell';
export const TOKEN_AUTH = 'xai-grok-cli';
export const OAUTH_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
export const REASONING_INCLUDE = 'reasoning.encrypted_content';
export const OAUTH_REFERRER = 'grok-build';

export const OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'grok-cli:access',
  'api:access',
  'conversations:read',
  'conversations:write',
  'workspaces:read',
  'workspaces:write',
] as const;

// ─── Client Configuration ────────────────────────────────────────────

export const DEFAULT_CLIENT_VERSION = '0.2.106';
/**
 * Default context window reported by OmniRoute (256 k tokens).
 * Individual model entries override this via max_context_length.
 */
export const DEFAULT_CONTEXT_WINDOW = 256_000;
export const DEFAULT_REASONING_EFFORT = 'high';
export const SUPPORTED_REASONING_EFFORTS = ['low', 'medium', 'high'] as const;

export type ClientMode = 'headless' | 'interactive';
export type ClientSurface = 'ui' | 'cli' | 'headless';

// ─── HTTP Headers ────────────────────────────────────────────────────

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  X_GROK_CLIENT_VERSION: 'x-grok-client-version',
  X_GROK_CLIENT_IDENTIFIER: 'x-grok-client-identifier',
  X_GROK_CLIENT_MODE: 'x-grok-client-mode',
  X_GROK_CLIENT_SURFACE: 'x-grok-client-surface',
  X_XAI_TOKEN_AUTH: 'X-XAI-Token-Auth',
  X_AUTHENTICATE_RESPONSE: 'x-authenticateresponse',
  X_GROK_MODEL_OVERRIDE: 'x-grok-model-override',
  X_USERID: 'x-userid',
  X_GROK_USER_ID: 'x-grok-user-id',
  X_EMAIL: 'x-email',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
  EVENT_STREAM: 'text/event-stream',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
} as const;

// ─── Unsupported Parameters ──────────────────────────────────────────

export const UNSUPPORTED_PARAMS = [
  'presencePenalty',
  'frequencyPenalty',
  'logprobs',
  'topLogprobs',
  'presence_penalty',
  'frequency_penalty',
  'top_logprobs',
  'reasoning_effort',
] as const;

// ─── Misc ────────────────────────────────────────────────────────────

export const MAX_TOOLS = 200;
export const REFRESH_MAX_ATTEMPTS = 3;
export const REFRESH_MIN_DELAY_MS = 200;
export const TERMINAL_REFRESH_ERRORS = new Set([
  'invalid_grant',
  'invalid_client',
]);
