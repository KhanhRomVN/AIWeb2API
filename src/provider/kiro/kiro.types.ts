/**
 * ------------------------------------------------------------------
 * Kiro Types
 * ------------------------------------------------------------------
 * Type definitions cho Kiro API.
 * Sync với OmniRoute providers/kiro.ts và services/kiro.ts.
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
 * - KiroPollContext                   : Serialized poll context (JSON stored in tempSessionId)
 * ------------------------------------------------------------------
 */

// ─── Auth Method ────────────────────────────────────────────────────────

export type KiroAuthMethod =
  | 'google'
  | 'github'
  | 'builder-id'
  | 'idc'
  | 'imported'
  | 'api_key'
  | 'device'
  | 'external_idp';

// ─── Auth Data (credential JSON) ────────────────────────────────────────

export interface KiroAuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  authMethod: KiroAuthMethod;
  clientId?: string;
  clientSecret?: string;
  clientSecretExpiresAt?: number;
  region?: string;
  profileArn?: string;
  provider?: string;
}

// ─── Poll Context (serialized into tempSessionId) ────────────────────────

/**
 * Context serialized khi login() trả về pending=true,
 * được UI gửi lại qua pollOnce(pollContext).
 *
 * flowType:
 * - 'aws_oidc'  → Builder ID / IDC device code poll → AWS OIDC token endpoint
 * - 'social'    → Google / GitHub social device poll → Kiro auth service
 */
export interface KiroPollContext {
  flowType: 'aws_oidc' | 'social';
  device_code: string;
  client_id: string;
  client_secret?: string; // chỉ có ở aws_oidc
  region?: string;        // chỉ có ở aws_oidc
  auth_method: KiroAuthMethod; // 'builder-id' | 'idc' | 'google' | 'github'
  interval: number;
}

// ─── Client Registration ─────────────────────────────────────────────────

export interface KiroClientRegistrationRequest {
  clientName: string;
  clientType: string;
  scopes: readonly string[];
  grantTypes: readonly string[];
  issuerUrl?: string;
}

export interface KiroClientRegistrationResponse {
  clientId: string;
  clientSecret: string;
  clientSecretExpiresAt: number;
}

// ─── Device Authorization ─────────────────────────────────────────────────

/** AWS OIDC device authorization request */
export interface KiroDeviceAuthorizationRequest {
  clientId: string;
  clientSecret: string;
  startUrl: string;
}

/** AWS OIDC device authorization response (camelCase) */
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

// ─── Token Polling ────────────────────────────────────────────────────────

/** AWS OIDC token poll request */
export interface KiroTokenPollRequest {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
  grantType: string;
}

/** AWS OIDC token poll response (camelCase) */
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
    | 'expired_token'
    | string;
  error_description?: string;
  message?: string;
}

// ─── User Profile ─────────────────────────────────────────────────────────

export interface KiroUserProfileResponse {
  email?: string;
  user?: { email?: string };
  userEmail?: string;
}

// ─── Social Device Poll Response ─────────────────────────────────────────

/** Response từ Kiro social device poll endpoint */
export interface KiroSocialPollResponse {
  error?: string;
  status?: string;
  accessToken?: string;
  refreshToken?: string;
  profileArn?: string;
  expiresIn?: number;
}
