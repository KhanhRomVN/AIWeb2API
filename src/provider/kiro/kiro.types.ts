/**
 * ------------------------------------------------------------------
 * Kiro Types
 * ------------------------------------------------------------------
 * Type definitions cho Kiro API.
 *
 * Main exports:
 * - KiroAuthData             : OAuth authentication data
 * - DeviceCodeResponse       : Device authorization response
 * - DeviceTokenResponse      : Token polling response
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface KiroAuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  authMethod: 'google' | 'github' | 'device';
  clientId?: string;
  clientSecret?: string;
  region?: string;
}

/**
 * Device Authorization Response từ AWS OIDC
 */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

/**
 * Token Response từ Device Code Polling
 */
export interface DeviceTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Device Code Polling Error
 */
export interface DeviceCodeError {
  error: 'authorization_pending' | 'slow_down' | 'access_denied' | 'expired_token';
  error_description?: string;
}
