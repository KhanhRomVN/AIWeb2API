/**
 * ------------------------------------------------------------------
 * Kiro Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Kiro provider.
 *
 * Main exports:
 * - BASE_URL           : Base URL của Kiro
 * - KIRO_EVENTS        : Các event name dùng trong proxy handler
 * - DEVICE_CODE_FLOW   : OAuth Device Code Flow endpoints và config
 * ------------------------------------------------------------------
 */

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
