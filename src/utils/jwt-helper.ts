/**
 * ------------------------------------------------------------------
 * JWT Helper Utility
 * ------------------------------------------------------------------
 * Shared utility for JWT token validation and refresh management.
 * 
 * Features:
 * - JWT expiry checking with configurable threshold
 * - Token refresh state management (prevents duplicate refresh)
 * - Standardized across all providers
 * 
 * Best practices:
 * - Default threshold: 5 minutes (OAuth 2.0 standard)
 * - Thread-safe refresh state tracking
 * - Automatic cleanup of expired refresh states
 * ------------------------------------------------------------------
 */

// ─── Constants ──────────────────────────────────────────────────────────

/**
 * Default refresh threshold: 5 minutes before expiry
 * This provides enough buffer to complete the refresh without token expiring mid-request
 */
export const DEFAULT_REFRESH_THRESHOLD_SEC = 5 * 60; // 5 minutes

// ─── Types ──────────────────────────────────────────────────────────────

interface RefreshState {
  isRefreshing: boolean;
  promise: Promise<string | null> | null;
  timestamp: number;
}

// ─── State Management ───────────────────────────────────────────────────

/**
 * Track ongoing refresh operations to prevent duplicate refreshes
 * Key format: `${providerId}:${tokenHash}`
 */
const refreshStates = new Map<string, RefreshState>();

/**
 * Cleanup old refresh states (older than 10 minutes)
 */
function cleanupOldRefreshStates(): void {
  const now = Date.now();
  const CLEANUP_THRESHOLD = 10 * 60 * 1000; // 10 minutes

  for (const [key, state] of refreshStates.entries()) {
    if (now - state.timestamp > CLEANUP_THRESHOLD) {
      refreshStates.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldRefreshStates, 5 * 60 * 1000);

// ─── JWT Helpers ────────────────────────────────────────────────────────

/**
 * Extract expiry timestamp from JWT token
 * @param jwt - JWT token string
 * @returns Expiry timestamp (seconds since epoch) or null if invalid
 */
export function getJwtExpiry(jwt: string): number | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    );

    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param jwt - JWT token string
 * @returns true if token is expired
 */
export function isJwtExpired(jwt: string): boolean {
  const exp = getJwtExpiry(jwt);
  if (exp === null) return false;
  return Date.now() / 1000 >= exp;
}

/**
 * Check if JWT token is expiring soon (within threshold)
 * @param jwt - JWT token string
 * @param thresholdSec - Seconds before expiry to trigger refresh (default: 5 minutes)
 * @returns true if token will expire within threshold
 */
export function isJwtExpiringSoon(
  jwt: string,
  thresholdSec: number = DEFAULT_REFRESH_THRESHOLD_SEC,
): boolean {
  const exp = getJwtExpiry(jwt);
  if (exp === null) return false;
  const now = Date.now() / 1000;
  return now >= exp - thresholdSec;
}

/**
 * Get remaining time until JWT expiry
 * @param jwt - JWT token string
 * @returns Seconds until expiry, or null if invalid token
 */
export function getJwtTimeToExpiry(jwt: string): number | null {
  const exp = getJwtExpiry(jwt);
  if (exp === null) return null;
  const now = Date.now() / 1000;
  return Math.max(0, exp - now);
}

// ─── Refresh Management ─────────────────────────────────────────────────

/**
 * Generate a simple hash for token (for tracking refresh state)
 * @param token - Token string
 * @returns Hash string
 */
function hashToken(token: string): string {
  // Simple hash: take first 16 and last 16 chars
  if (token.length <= 32) return token;
  return token.slice(0, 16) + token.slice(-16);
}

/**
 * Get refresh state key
 * @param providerId - Provider identifier (e.g., 'qwen', 'kimi')
 * @param token - Token string
 * @returns State key
 */
function getRefreshStateKey(providerId: string, token: string): string {
  return `${providerId}:${hashToken(token)}`;
}

/**
 * Coordinate token refresh to prevent duplicate refresh operations
 * @param providerId - Provider identifier
 * @param token - Current token
 * @param refreshFn - Async function that performs the actual refresh
 * @returns New token or null if refresh failed
 */
export async function coordinateTokenRefresh(
  providerId: string,
  token: string,
  refreshFn: () => Promise<string | null>,
): Promise<string | null> {
  const key = getRefreshStateKey(providerId, token);
  const existingState = refreshStates.get(key);

  // If refresh is already in progress, wait for it
  if (existingState?.isRefreshing && existingState.promise) {
    return existingState.promise;
  }

  // Start new refresh
  const refreshPromise = (async () => {
    try {
      const newToken = await refreshFn();
      refreshStates.delete(key); // Clean up after success
      return newToken;
    } catch (error) {
      refreshStates.delete(key); // Clean up after error
      throw error;
    }
  })();

  refreshStates.set(key, {
    isRefreshing: true,
    promise: refreshPromise,
    timestamp: Date.now(),
  });

  return refreshPromise;
}

/**
 * Check if token needs refresh and is not currently being refreshed
 * @param providerId - Provider identifier
 * @param token - Token to check
 * @param thresholdSec - Threshold in seconds
 * @returns true if token should be refreshed
 */
export function shouldRefreshToken(
  providerId: string,
  token: string,
  thresholdSec: number = DEFAULT_REFRESH_THRESHOLD_SEC,
): boolean {
  // Check if already refreshing
  const key = getRefreshStateKey(providerId, token);
  if (refreshStates.get(key)?.isRefreshing) {
    return false;
  }

  // Check if token is expiring soon
  return isJwtExpiringSoon(token, thresholdSec);
}
