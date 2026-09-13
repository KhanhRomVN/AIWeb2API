/**
 * ------------------------------------------------------------------
 * Z.AI Browser Helpers
 * ------------------------------------------------------------------
 * Helper functions cho Z.AI Browser provider.
 *
 * Main functions:
 * - parseZaiBrowserCredential() : Parse credential thành cookies + userAgent
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ParsedZaiCredential } from './zai-browser.types';
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZaiBrowserHelpers');

// ─── Functions ──────────────────────────────────────────────────────────

export const parseZaiBrowserCredential = (credential: string): ParsedZaiCredential | null => {
  const parts = credential.split('|||');
  if (parts.length < 2) {
    logger.warn(`[ZaiBrowser] Invalid credential format, expected "cookies|||user_agent"`);
    return null;
  }
  return {
    cookies: parts[0],
    userAgent: parts[1],
  };
};