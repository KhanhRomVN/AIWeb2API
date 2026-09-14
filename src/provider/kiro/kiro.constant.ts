/**
 * ------------------------------------------------------------------
 * Kiro Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Kiro provider.
 *
 * Main exports:
 * - PROVIDER_ID / PROVIDER_NAME / IS_ENABLED / WEBSITE_URL
 * - AUTH_METHOD / CONNECTION_TYPE / IS_PAUSABLE / IS_MEMORY
 * - MODELS              : Danh sách models hỗ trợ
 * - BASE_URLS / HOSTS / API_PATHS
 * - BASE_URL            : alias cho BASE_URLS.KIRO_APP
 * - AUTH_METHODS / DEFAULT_REGION / AUTH_DATA_DEFAULTS
 * - DEVICE_CODE_FLOW    : OAuth Device Code Flow endpoints và config
 * - DEVICE_CODE_DEFAULTS / FALLBACK_EMAIL
 * - KIRO_EVENTS
 * - HTTP_HEADERS / HTTP_HEADER_NAMES / CONTENT_TYPES
 * - TOKEN_FIELDS / API_FIELDS
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'kiro';
export const PROVIDER_NAME = 'Kiro';
export const PROVIDER_DESCRIPTION = 'AWS-powered AI coding assistant with OAuth authentication';
export const PROVIDER_COLOR = '#FF6B6B';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://kiro.dev/';
export const AUTH_METHOD = ['google', 'github'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'kiro-default',
    name: 'Kiro Default',
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
    description:
      'Kiro Default - AI model with OAuth authentication via Google/GitHub',
  },
] as const;

// ─── Base URLs / Hosts ───────────────────────────────────────────────

export const BASE_URLS = {
  KIRO_APP: 'https://app.kiro.dev',
  AWS_OIDC: 'https://oidc.us-east-1.amazonaws.com',
  AWS_APPS: 'https://view.awsapps.com',
  IDENTITY_CENTER: 'https://identitycenter.amazonaws.com',
} as const;

export const HOSTS = {
  KIRO: 'kiro.dev',
  AWS: 'amazonaws.com',
} as const;

export const API_PATHS = {
  // AWS OIDC
  DEVICE_AUTHORIZATION: '/device_authorization',
  TOKEN: '/token',
  REGISTER_CLIENT: '/client/register',
  // Kiro app
  SIGNIN: '/signin',
  DEVICE: '/account/device',
  USER_PROFILE: '/api/user/profile',
} as const;

/** Base URL của Kiro app (giữ để backward-compat với code hiện tại) */
export const BASE_URL = BASE_URLS.KIRO_APP;

// ─── Auth Methods / Region ───────────────────────────────────────────

export const AUTH_METHODS = {
  GOOGLE: 'google',
  GITHUB: 'github',
  DEVICE: 'device',
} as const;

export const DEFAULT_REGION = 'us-east-1';

export const AUTH_DATA_DEFAULTS = {
  METHOD: 'device',
  REFRESH_TOKEN: '',
} as const;

// ─── Proxy Events ────────────────────────────────────────────────────

export const KIRO_EVENTS = {
  ACCESS_TOKEN: 'kiro-access-token',
  REFRESH_TOKEN: 'kiro-refresh-token',
  LOGIN_EMAIL: 'kiro-login-email',
  DEVICE_CODE: 'kiro-device-code',
} as const;

// ─── OAuth Device Code Flow ──────────────────────────────────────────

/**
 * Kiro OAuth Device Code Flow Configuration
 * Sử dụng AWS OIDC Device Authorization Flow.
 */
export const DEVICE_CODE_FLOW = {
  DEVICE_AUTHORIZATION_URL: `${BASE_URLS.AWS_OIDC}${API_PATHS.DEVICE_AUTHORIZATION}`,
  TOKEN_URL: `${BASE_URLS.AWS_OIDC}${API_PATHS.TOKEN}`,
  REGISTER_CLIENT_URL: `${BASE_URLS.AWS_OIDC}${API_PATHS.REGISTER_CLIENT}`,
  VERIFICATION_URI: `${BASE_URLS.KIRO_APP}${API_PATHS.DEVICE}`,
  START_URL: `${BASE_URLS.AWS_APPS}/start`,
  POLLING_INTERVAL: 5000,
  DEVICE_CODE_EXPIRES: 600000,
  CLIENT_NAME: 'kiro-oauth-client',
  CLIENT_TYPE: 'public',
  SCOPES: [
    'codewhisperer:completions',
    'codewhisperer:analysis',
    'codewhisperer:conversations',
  ],
  GRANT_TYPES: [
    'urn:ietf:params:oauth:grant-type:device_code',
    'refresh_token',
  ],
  ISSUER_URL: 'https://identitycenter.amazonaws.com/ssoins-722374e8c3c8e6c6',
} as const;

// ─── Device Code Defaults ────────────────────────────────────────────

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

// ─── HTTP Headers ────────────────────────────────────────────────────

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
} as const;

// ─── Credential Fields (authData JSON) ───────────────────────────────

export const TOKEN_FIELDS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  EXPIRES_IN: 'expiresIn',
  AUTH_METHOD: 'authMethod',
  CLIENT_ID: 'clientId',
  CLIENT_SECRET: 'clientSecret',
  REGION: 'region',
} as const;

// ─── API Field Names ─────────────────────────────────────────────────

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
  // snake_case variants (Kiro web)
  DEVICE_CODE_SNAKE: 'device_code',
  USER_CODE_SNAKE: 'user_code',
  ACCESS_TOKEN_SNAKE: 'access_token',
  REFRESH_TOKEN_SNAKE: 'refresh_token',
} as const;