/**
 * ------------------------------------------------------------------
 * Shared HTTP Constants
 * ------------------------------------------------------------------
 * Header names và content-type values dùng chung giữa nhiều provider.
 * Provider chỉ spread rồi thêm key riêng nếu cần.
 * ------------------------------------------------------------------
 */

// ─── Standard HTTP Header Names ──────────────────────────────────────

export const STANDARD_HTTP_HEADERS = {
  AUTHORIZATION: 'Authorization',
  COOKIE: 'Cookie',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
} as const;

// ─── Content Types ───────────────────────────────────────────────────

export const CONTENT_TYPES = {
  JSON: 'application/json',
  SSE: 'text/event-stream',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART_PREFIX: 'multipart/form-data; boundary=',
} as const;

// ─── Auth Prefixes ───────────────────────────────────────────────────

export const AUTH_PREFIXES = {
  BEARER: 'Bearer ',
  JWT: 'eyJ',
} as const;

// ─── Lowercase Header Names (cho proxy handler / comparison) ─────────

export const LOWERCASE_HEADER_NAMES = {
  AUTHORIZATION: 'authorization',
  COOKIE: 'cookie',
  SET_COOKIE: 'set-cookie',
  USER_AGENT: 'user-agent',
  CONTENT_TYPE: 'content-type',
  ACCEPT: 'accept',
  ORIGIN: 'origin',
  REFERER: 'referer',
} as const;