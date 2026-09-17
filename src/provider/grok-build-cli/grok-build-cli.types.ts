/**
 * ------------------------------------------------------------------
 * Grok Build CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Grok Build CLI API.
 *
 * Main exports:
 * - GrokBuildCredentials        : Credential format
 * - GrokBuildProviderData       : providerSpecificData (team/org/userId)
 * - GrokBuildRequestBody        : Request body format
 * - GrokBuildReasoning          : Reasoning configuration
 * - OAuthTokenResponse          : OAuth token response
 * ------------------------------------------------------------------
 */

// ─── Credentials ────────────────────────────────────────────────────────

/**
 * Extra identity fields stored inside providerSpecificData.
 * Follows OmniRoute's credential shape so tokens acquired via the OAuth flow
 * (device-code / browser PKCE) are compatible.
 */
export interface GrokBuildProviderData {
  userId?: string | null;
  email?: string | null;
  teamId?: string | null;
  tier?: number;
  principalType?: string | null;
  principalId?: string | null;
  organizationId?: string | null;
  rawAuthJson?: Record<string, unknown>;
}

export interface GrokBuildCredentials {
  /** OAuth Bearer access token. */
  accessToken: string;
  /** OAuth refresh token — required for auto-refresh. */
  refreshToken?: string | null;
  /**
   * Top-level email kept for backward-compat with legacy stored credentials.
   * Prefer providerSpecificData.email for new credentials.
   */
  email?: string | null;
  /**
   * Top-level userId kept for backward-compat.
   * Prefer providerSpecificData.userId for new credentials.
   */
  userId?: string | null;
  /**
   * principalType at root — kept for legacy compat.
   * Prefer providerSpecificData.principalType.
   */
  principalType?: string | null;
  /**
   * principalId at root — kept for legacy compat.
   * Prefer providerSpecificData.principalId.
   */
  principalId?: string | null;
  /** Nested identity / tier data following OmniRoute's providerSpecificData shape. */
  providerSpecificData?: GrokBuildProviderData;
}

// ─── Request Body ───────────────────────────────────────────────────────

export interface GrokBuildRequestBody {
  model?: string;
  messages?: unknown[];
  /** Responses API input array (alternative to messages). */
  input?: unknown[];
  stream?: boolean;
  tools?: unknown[];
  reasoning?: GrokBuildReasoning;
  store?: boolean;
  include?: unknown[];
  [key: string]: unknown;
}

// ─── Reasoning ──────────────────────────────────────────────────────────

export interface GrokBuildReasoning {
  effort?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

// ─── OAuth Token Response ───────────────────────────────────────────────

export interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}
