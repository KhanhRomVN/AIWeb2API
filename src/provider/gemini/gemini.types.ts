/**
 * ------------------------------------------------------------------
 * Gemini Types
 * ------------------------------------------------------------------
 * Type definitions cho Gemini Web API.
 *
 * Main exports:
 * - GeminiCredential   : Credential structure với cookie, sapisid, xsrf, authUser
 * - GeminiModelConfig  : Cấu hình mode/think cho một model
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface GeminiCredential {
  cookies: string;
  sapisid?: string;
  authUser?: string;
  xsrfToken?: string;
  email?: string;
}

export interface GeminiModelConfig {
  mode: number;
  think: number;
  desc?: string;
}