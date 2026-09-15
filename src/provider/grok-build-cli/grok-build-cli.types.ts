/**
 * ------------------------------------------------------------------
 * Grok Build CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Grok Build CLI API.
 *
 * Main exports:
 * - GrokBuildCredentials  : Credential format
 * - GrokBuildRequestBody  : Request body format
 * - GrokBuildReasoning    : Reasoning configuration
 * ------------------------------------------------------------------
 */

// ─── Credentials ────────────────────────────────────────────────────────

export interface GrokBuildCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  email?: string;
  userId?: string;
  principalType?: string;
  principalId?: string;
}

// ─── Request Body ───────────────────────────────────────────────────────

export interface GrokBuildRequestBody {
  model?: string;
  messages?: unknown[];
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
}
