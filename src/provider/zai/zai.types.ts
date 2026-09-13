/**
 * ------------------------------------------------------------------
 * Z.AI Types
 * ------------------------------------------------------------------
 * Type definitions cho Z.AI API.
 *
 * Main exports:
 * - ZAIAuthData           : Authentication data
 * - SignatureResult       : Signature generation result
 * - ZAIUserAgentDetails   : Parsed user-agent details
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface ZAIAuthData {
  token: string;
  userId: string;
  email?: string;
  cookies?: string;
  userAgent?: string;
}

export interface SignatureResult {
  signature: string;
  timestamp: string;
  requestId: string;
  queryParams: string;
}

export interface ZAIUserAgentDetails {
  osName: string;
  secChUaPlatform: string;
  secChUa: string;
}
