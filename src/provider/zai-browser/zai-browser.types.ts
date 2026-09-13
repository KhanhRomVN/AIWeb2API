/**
 * ------------------------------------------------------------------
 * Z.AI Browser Types
 * ------------------------------------------------------------------
 * Type definitions cho Z.AI Browser provider.
 *
 * Main exports:
 * - ParsedZaiCredential    : Parsed credential structure
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParsedZaiCredential {
  cookies: string;
  userAgent: string;
}
