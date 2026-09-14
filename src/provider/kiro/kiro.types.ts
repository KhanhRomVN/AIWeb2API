/**
 * ------------------------------------------------------------------
 * Kiro Types
 * ------------------------------------------------------------------
 * Type definitions cho Kiro API.
 *
 * Main exports:
 * - KiroAuthMethod                    : Auth method literal type
 * - KiroAuthData                      : OAuth authentication data (credential JSON)
 * - KiroClientRegistrationRequest     : AWS OIDC client registration request
 * - KiroClientRegistrationResponse    : AWS OIDC client registration response
 * - KiroDeviceAuthorizationRequest    : Device authorization request body
 * - KiroDeviceAuthorizationResponse   : Device authorization response (camelCase AWS)
 * - DeviceCodeResponse                : Normalized device code response
 * - KiroTokenPollRequest              : Token poll request body
 * - KiroTokenPollResponse             : Token poll response (camelCase AWS)
 * - DeviceTokenResponse               : Normalized token response
 * - DeviceCodeError                   : Polling error
 * - KiroUserProfileResponse           : User profile response
 * ------------------------------------------------------------------
 */

// ─── Auth ───────────────────────────────────────────────────────────────

export type KiroAuthMethod = 'google' | 'github' | 'device';

export interface KiroAuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  authMethod: KiroAuthMethod;
  clientId?: string;
  clientSecret?: string;
  region?: string;
}

// ─── Client Registration ────────────────────────────────────────────────

export interface KiroClientRegistrationRequest {
  clientName: string;
  clientType: string;
  scopes: readonly string[];
  grantTypes: readonly string[];
  issuerUrl: string;
}

export interface KiroClientRegistrationResponse {
  clientId: string;
  clientSecret: string;
  clientSecretExpiresAt: number;
}

// ─── Device Authorization ───────────────────────────────────────────────

export interface KiroDeviceAuthorizationRequest {
  clientId: string;
  clientSecret: string;
  startUrl: string;
}

export interface KiroDeviceAuthorizationResponse {
  deviceCode: string;
  userCode: string;
  verificationUri?: string;
  verificationUriComplete?: string;
  expiresIn?: number;
  interval?: number;
}

/**
 * Normalized device code response (snake_case) kèm client credentials.
 */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
  clientId?: string;
  clientSecret?: string;
}

// ─── Token Polling ──────────────────────────────────────────────────────

export interface KiroTokenPollRequest {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
  grantType: string;
}

export interface KiroTokenPollResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  tokenType?: string;
}

/**
 * Normalized token response từ device code polling.
 */
export interface DeviceTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface DeviceCodeError {
  error:
    | 'authorization_pending'
    | 'slow_down'
    | 'access_denied'
    | 'expired_token';
  error_description?: string;
}

// ─── User Profile ───────────────────────────────────────────────────────

export interface KiroUserProfileResponse {
  email?: string;
  user?: { email?: string };
  userEmail?: string;
}