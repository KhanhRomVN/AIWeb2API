/**
 * ------------------------------------------------------------------
 * Kiro Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Kiro provider.
 * Sync với OmniRoute src/lib/oauth/constants/oauth.ts → KIRO_CONFIG
 *
 * Auth methods:
 * 1. AWS Builder ID  – Device Code Flow (AWS OIDC)
 * 2. AWS IAM IDC     – Device Code Flow (AWS OIDC, custom startUrl/region)
 * 3. Google / GitHub – Social Device Code Flow (Kiro auth service)
 * 4. Import Token    – Paste refresh token
 * 5. API Key         – Long-lived CodeWhisperer API key
 * ------------------------------------------------------------------
 */

// ─── Provider Meta ────────────────────────────────────────────────────

export const PROVIDER_ID = 'kiro';
export const PROVIDER_NAME = 'Kiro';
export const PROVIDER_DESCRIPTION = 'AWS-powered AI coding assistant with OAuth authentication';
export const PROVIDER_COLOR = '#8B5CF6';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://kiro.dev/';
export const AUTH_METHOD = ['google', 'github'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── Models ───────────────────────────────────────────────────────────
// Sync với OmniRoute open-sse/config/providers/registry/kiro/index.ts
// IDs phải khớp chính xác với upstream Kiro catalog — ID sai → 400 "Invalid model"

export const MODELS = [
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    is_thinking: false,
    max_context_length: 1000000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Claude Sonnet 5 — plan-gated, available on entitled accounts',
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
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
    description: 'Claude Sonnet 4.5',
  },
  {
    id: 'claude-haiku-4.5',
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
    description: 'Claude Haiku 4.5',
  },
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    is_thinking: false,
    max_context_length: 272000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GPT-5.6 Sol — flagship tier',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    is_thinking: false,
    max_context_length: 272000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GPT-5.6 Terra — balanced mid-tier',
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    is_thinking: false,
    max_context_length: 272000,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GPT-5.6 Luna — fastest/cheapest',
  },
  {
    id: 'deepseek-3.2',
    name: 'DeepSeek V3.2',
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
    description: 'DeepSeek V3.2',
  },
  {
    id: 'minimax-m2.5',
    name: 'MiniMax M2.5',
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
    description: 'MiniMax M2.5',
  },
  {
    id: 'minimax-m2.1',
    name: 'MiniMax M2.1',
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
    description: 'MiniMax M2.1',
  },
  {
    id: 'glm-5',
    name: 'GLM-5',
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
    description: 'GLM-5',
  },
  {
    id: 'qwen3-coder-next',
    name: 'Qwen3 Coder Next',
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
    description: 'Qwen3 Coder Next',
  },
] as const;

// ─── AWS OIDC (Builder ID / IDC) ─────────────────────────────────────

/** Base AWS SSO OIDC endpoint cho us-east-1 */
export const AWS_OIDC_BASE = 'https://oidc.us-east-1.amazonaws.com';

export const AWS_OIDC = {
  REGISTER_CLIENT_URL: `${AWS_OIDC_BASE}/client/register`,
  DEVICE_AUTH_URL: `${AWS_OIDC_BASE}/device_authorization`,
  TOKEN_URL: `${AWS_OIDC_BASE}/token`,
} as const;

/** Builder ID default start URL */
export const BUILDER_ID_START_URL = 'https://view.awsapps.com/start';

/** OIDC client registration params dùng cho Builder ID / IDC */
export const OIDC_CLIENT = {
  clientName: 'kiro-oauth-client',
  clientType: 'public',
  scopes: [
    'codewhisperer:completions',
    'codewhisperer:analysis',
    'codewhisperer:conversations',
  ],
  grantTypes: [
    'urn:ietf:params:oauth:grant-type:device_code',
    'refresh_token',
  ],
  /** issuerUrl dùng cho Builder ID (không dùng cho IDC) */
  issuerUrl: 'https://identitycenter.amazonaws.com/ssoins-722374e8c3c8e6c6',
} as const;

// ─── Kiro Social Auth (Google / GitHub) ──────────────────────────────

/** Kiro social auth service base URL */
export const KIRO_AUTH_SERVICE = 'https://prod.us-east-1.auth.desktop.kiro.dev';

export const SOCIAL_AUTH = {
  SOCIAL_AUTH_ENDPOINT: KIRO_AUTH_SERVICE,
  SOCIAL_LOGIN_URL: `${KIRO_AUTH_SERVICE}/login`,
  SOCIAL_TOKEN_URL: `${KIRO_AUTH_SERVICE}/oauth/token`,
  SOCIAL_REFRESH_URL: `${KIRO_AUTH_SERVICE}/refreshToken`,
  /**
   * Social device-code flow (Google / GitHub qua Kiro auth service).
   * `socialClientId` là public CLI identifier — Kiro device endpoint chấp nhận
   * bất kỳ non-empty string nào (hoạt động như User-Agent).
   */
  SOCIAL_CLIENT_ID: process.env.KIRO_OAUTH_CLIENT_ID || 'kiro-cli',
  SOCIAL_DEVICE_AUTHORIZE_URL: `${KIRO_AUTH_SERVICE}/oauth/device/authorization`,
  SOCIAL_DEVICE_POLL_URL: `${KIRO_AUTH_SERVICE}/oauth/device/poll`,
} as const;

// ─── CodeWhisperer / Amazon Q Runtime ─────────────────────────────────

export const CODEWHISPERER_BASE = 'https://codewhisperer.us-east-1.amazonaws.com';

export function kiroRuntimeHost(region: string): string {
  return region === 'us-east-1'
    ? CODEWHISPERER_BASE
    : `https://q.${region}.amazonaws.com`;
}

// ─── Base URLs / Hosts ────────────────────────────────────────────────

export const BASE_URLS = {
  KIRO_APP: 'https://app.kiro.dev',
  AWS_OIDC: AWS_OIDC_BASE,
  AWS_APPS: 'https://view.awsapps.com',
  IDENTITY_CENTER: 'https://identitycenter.amazonaws.com',
} as const;

export const HOSTS = {
  KIRO: 'kiro.dev',
  AWS: 'amazonaws.com',
} as const;

export const API_PATHS = {
  DEVICE_AUTHORIZATION: '/device_authorization',
  TOKEN: '/token',
  REGISTER_CLIENT: '/client/register',
  SIGNIN: '/signin',
  DEVICE: '/account/device',
  USER_PROFILE: '/api/user/profile',
} as const;

/** Base URL của Kiro app (giữ backward-compat) */
export const BASE_URL = BASE_URLS.KIRO_APP;

// ─── Auth Methods / Region ────────────────────────────────────────────

export const AUTH_METHODS = {
  BUILDER_ID: 'builder-id',
  IDC: 'idc',
  GOOGLE: 'google',
  GITHUB: 'github',
  IMPORTED: 'imported',
  API_KEY: 'api_key',
  DEVICE: 'device',
  EXTERNAL_IDP: 'external_idp',
} as const;

export const DEFAULT_REGION = 'us-east-1';

export const AUTH_DATA_DEFAULTS = {
  METHOD: 'device',
  REFRESH_TOKEN: '',
} as const;

// ─── Proxy Events ─────────────────────────────────────────────────────

export const KIRO_EVENTS = {
  ACCESS_TOKEN: 'kiro-access-token',
  REFRESH_TOKEN: 'kiro-refresh-token',
  LOGIN_EMAIL: 'kiro-login-email',
  DEVICE_CODE: 'kiro-device-code',
} as const;

// ─── Device Code Defaults ─────────────────────────────────────────────

export const DEVICE_CODE_DEFAULTS = {
  EXPIRES_SEC: 600,
  INTERVAL_SEC: 5,
  SLOW_DOWN_INCREMENT_MS: 5000,
  TOKEN_EXPIRES_SEC: 3600,
  TOKEN_TYPE: 'Bearer',
} as const;

export const FALLBACK_EMAIL = {
  PREFIX: 'kiro-',
  SUFFIX: '@kiro.local',
} as const;

// ─── Redirect URI (social login PKCE) ────────────────────────────────

/** AWS Cognito chỉ whitelist kiro:// protocol, không phải localhost */
export const SOCIAL_REDIRECT_URI = 'kiro://kiro.kiroAgent/authenticate-success';

// ─── HTTP Headers ─────────────────────────────────────────────────────

export const HTTP_HEADERS = {
  ACCEPT_JSON: 'application/json',
  BEARER_PREFIX: 'Bearer ',
} as const;

export const HTTP_HEADER_NAMES = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM: 'application/x-www-form-urlencoded',
} as const;

// ─── Credential Fields (authData JSON) ────────────────────────────────

export const TOKEN_FIELDS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  EXPIRES_IN: 'expiresIn',
  AUTH_METHOD: 'authMethod',
  CLIENT_ID: 'clientId',
  CLIENT_SECRET: 'clientSecret',
  REGION: 'region',
  PROFILE_ARN: 'profileArn',
} as const;

// ─── API Field Names ──────────────────────────────────────────────────

export const API_FIELDS = {
  // AWS OIDC device authorization response (camelCase)
  DEVICE_CODE: 'deviceCode',
  USER_CODE: 'userCode',
  VERIFICATION_URI: 'verificationUri',
  VERIFICATION_URI_COMPLETE: 'verificationUriComplete',
  EXPIRES_IN: 'expiresIn',
  INTERVAL: 'interval',
  // Client registration
  CLIENT_ID: 'clientId',
  CLIENT_SECRET: 'clientSecret',
  CLIENT_SECRET_EXPIRES_AT: 'clientSecretExpiresAt',
  CLIENT_NAME: 'clientName',
  CLIENT_TYPE: 'clientType',
  SCOPES: 'scopes',
  GRANT_TYPES: 'grantTypes',
  ISSUER_URL: 'issuerUrl',
  // Token polling
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  TOKEN_TYPE: 'tokenType',
  GRANT_TYPE: 'grantType',
  // User profile
  EMAIL: 'email',
  USER: 'user',
  USER_EMAIL: 'userEmail',
  // snake_case variants (Kiro web / social)
  DEVICE_CODE_SNAKE: 'device_code',
  USER_CODE_SNAKE: 'user_code',
  ACCESS_TOKEN_SNAKE: 'access_token',
  REFRESH_TOKEN_SNAKE: 'refresh_token',
} as const;

// ─── Legacy aliases (backward-compat) ────────────────────────────────

/** @deprecated Dùng AWS_OIDC.* thay thế */
export const DEVICE_CODE_FLOW = {
  DEVICE_AUTHORIZATION_URL: AWS_OIDC.DEVICE_AUTH_URL,
  TOKEN_URL: AWS_OIDC.TOKEN_URL,
  REGISTER_CLIENT_URL: AWS_OIDC.REGISTER_CLIENT_URL,
  VERIFICATION_URI: `${BASE_URLS.KIRO_APP}${API_PATHS.DEVICE}`,
  START_URL: BUILDER_ID_START_URL,
  POLLING_INTERVAL: DEVICE_CODE_DEFAULTS.INTERVAL_SEC * 1000,
  DEVICE_CODE_EXPIRES: DEVICE_CODE_DEFAULTS.EXPIRES_SEC * 1000,
  CLIENT_NAME: OIDC_CLIENT.clientName,
  CLIENT_TYPE: OIDC_CLIENT.clientType,
  SCOPES: OIDC_CLIENT.scopes,
  GRANT_TYPES: OIDC_CLIENT.grantTypes,
  ISSUER_URL: OIDC_CLIENT.issuerUrl,
} as const;
