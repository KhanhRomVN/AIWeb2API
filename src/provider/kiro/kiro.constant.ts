/**
 * ------------------------------------------------------------------
 * Kiro Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Kiro provider.
 *
 * Main exports:
 * - PROVIDER_ID        : ID định danh provider
 * - PROVIDER_NAME      : Tên hiển thị
 * - IS_ENABLED         : Bật/tắt provider
 * - WEBSITE_URL        : URL website
 * - AUTH_METHOD        : Phương thức xác thực
 * - CONNECTION_TYPE    : Loại kết nối (https/browser)
 * - MODELS             : Danh sách models hỗ trợ
 * - IS_PAUSABLE        : Hỗ trợ tạm dừng session
 * - IS_MEMORY          : Hỗ trợ bộ nhớ dài hạn
 * - BASE_URL           : Base URL của Kiro
 * - KIRO_EVENTS        : Các event name dùng trong proxy handler
 * - DEVICE_CODE_FLOW   : OAuth Device Code Flow endpoints và config
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'kiro';
export const PROVIDER_NAME = 'Kiro';
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
    description:
      'Kiro Default - AI model with OAuth authentication via Google/GitHub',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://app.kiro.dev';

export const KIRO_EVENTS = {
  ACCESS_TOKEN: 'kiro-access-token',
  REFRESH_TOKEN: 'kiro-refresh-token',
  LOGIN_EMAIL: 'kiro-login-email',
  DEVICE_CODE: 'kiro-device-code',
} as const;

/**
 * Kiro OAuth Device Code Flow Configuration
 * Sử dụng AWS OIDC Device Authorization Flow
 */
export const DEVICE_CODE_FLOW = {
  // AWS OIDC Device Authorization endpoint (us-east-1)
  DEVICE_AUTHORIZATION_URL: 'https://oidc.us-east-1.amazonaws.com/device_authorization',
  
  // AWS OIDC Token endpoint để poll và lấy tokens
  TOKEN_URL: 'https://oidc.us-east-1.amazonaws.com/token',
  
  // AWS OIDC Client Registration endpoint
  REGISTER_CLIENT_URL: 'https://oidc.us-east-1.amazonaws.com/client/register',
  
  // Kiro's device verification page
  VERIFICATION_URI: 'https://app.kiro.dev/account/device',
  
  // AWS Builder ID start URL (required for device authorization)
  START_URL: 'https://view.awsapps.com/start',
  
  // Polling configuration
  POLLING_INTERVAL: 5000, // 5 seconds
  DEVICE_CODE_EXPIRES: 600000, // 10 minutes
  
  // OAuth client configuration
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
