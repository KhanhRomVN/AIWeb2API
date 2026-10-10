/**
 * ------------------------------------------------------------------
 * WorkBuddy Auth Helper
 * ------------------------------------------------------------------
 * Parse, serialize credential; build request headers; refresh token.
 *
 * Main exports:
 * - parseCredential()     : JSON string → WorkBuddyCredential
 * - serializeCredential() : WorkBuddyCredential → JSON string
 * - buildCommonHeaders()  : Shared headers (all API)
 * - buildChatHeaders()    : Chat-specific headers
 * - needsRefresh()        : Check if access token near expiry
 * - refreshToken()        : Call upstream to get new access token
 * - classifyError()       : Classify upstream HTTP error → kind
 * ------------------------------------------------------------------
 */

// ── External ──
import fetch from 'node-fetch';
import { createHash } from 'crypto';

// ── Types ──
import {
  WorkBuddyCredential,
  WorkBuddyApiEnvelope,
  WorkBuddyTokenRefreshResponse,
  WorkBuddyChatMeta,
  WorkBuddyUpstreamError,
  WorkBuddyErrKind,
} from './workbuddy.types';

// ── Constants ──
import {
  UPSTREAM_BASE_CN,
  UPSTREAM_BASE_GLOBAL,
  ORIGIN_CN,
  ORIGIN_GLOBAL,
  API_PATHS,
  HEADER_NAMES,
  CONTENT_TYPES,
  USER_AGENTS,
  CLIENT_VERSION,
  CLI_VERSION,
  CREDENTIAL_FIELDS,
  SESSION_DEAD_MARKERS,
  HARD_CREDIT_MARKERS,
  RATE_LIMIT_MARKERS,
  MODEL_BLOCKED_CODE,
  PROMPT_TOO_LONG_MARKERS,
  CONTENT_BLOCKED_MARKERS,
  ACCOUNT_FAULT_MARKERS,
  BAD_PARAMS_MARKER,
  INVALID_IMAGE_MARKERS,
  REFRESH_TOKEN_MAX_EXPIRY_SECONDS,
  REFRESH_TOKEN_TIMEOUT_MS,
  DEFAULT_REALM,
} from './workbuddy.constant';

// ─── Credential Helpers ───────────────────────────────────────────────

/**
 * Parse credential JSON string → WorkBuddyCredential.
 * Supports both JSON object and legacy bare token string.
 */
export function parseCredential(raw: string): WorkBuddyCredential {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        accessToken:
          parsed[CREDENTIAL_FIELDS.ACCESS_TOKEN] ||
          parsed.access_token ||
          parsed.token ||
          '',
        refreshToken: parsed[CREDENTIAL_FIELDS.REFRESH_TOKEN] || parsed.refresh_token || '',
        expiresAt: Number(parsed[CREDENTIAL_FIELDS.EXPIRES_AT] || 0),
        realm:
          parsed[CREDENTIAL_FIELDS.REALM] === 'cn' ? 'cn' : 'global',
        uid: parsed[CREDENTIAL_FIELDS.UID] || '',
        enterpriseId: parsed[CREDENTIAL_FIELDS.ENTERPRISE_ID] || undefined,
        deviceToken: parsed[CREDENTIAL_FIELDS.DEVICE_TOKEN] || undefined,
      };
    } catch {
      // fall through to bare token
    }
  }

  // Bare token fallback
  return {
    accessToken: trimmed,
    refreshToken: '',
    expiresAt: 0,
    realm: DEFAULT_REALM,
    uid: '',
  };
}

/**
 * Serialize WorkBuddyCredential → JSON string (để lưu database).
 */
export function serializeCredential(cred: WorkBuddyCredential): string {
  return JSON.stringify({
    [CREDENTIAL_FIELDS.ACCESS_TOKEN]: cred.accessToken,
    [CREDENTIAL_FIELDS.REFRESH_TOKEN]: cred.refreshToken,
    [CREDENTIAL_FIELDS.EXPIRES_AT]: cred.expiresAt,
    [CREDENTIAL_FIELDS.REALM]: cred.realm,
    [CREDENTIAL_FIELDS.UID]: cred.uid,
    ...(cred.enterpriseId ? { [CREDENTIAL_FIELDS.ENTERPRISE_ID]: cred.enterpriseId } : {}),
    ...(cred.deviceToken ? { [CREDENTIAL_FIELDS.DEVICE_TOKEN]: cred.deviceToken } : {}),
  });
}

// ─── Realm Helpers ────────────────────────────────────────────────────

/**
 * Trả về upstream chat base URL theo realm.
 */
export function chatBaseUrl(realm: 'cn' | 'global'): string {
  return realm === 'global' ? UPSTREAM_BASE_GLOBAL : UPSTREAM_BASE_CN;
}

/**
 * Trả về Origin/Referer theo realm.
 */
export function originFor(realm: 'cn' | 'global'): string {
  return realm === 'global' ? ORIGIN_GLOBAL : ORIGIN_CN;
}

/**
 * Trả về User-Agent theo realm.
 * CN:     "WorkBuddy/<ver> WorkBuddy/<ver> CLI/<cliVer>"
 * global: "WorkBuddy/<ver> WorkBuddy AI/<ver> CLI/<cliVer>"
 */
export function userAgentFor(realm: 'cn' | 'global'): string {
  return realm === 'global' ? USER_AGENTS.GLOBAL : USER_AGENTS.CN;
}

/**
 * Accept-Language theo realm.
 */
export function acceptLanguageFor(realm: 'cn' | 'global'): string {
  return realm === 'global' ? 'en-US' : 'zh-CN';
}

// ─── Stable Account ID ────────────────────────────────────────────────

/**
 * Derive X-Machine-ID hoặc X-Session-ID ổn định cho một account.
 * purpose = 'machine' | 'session'
 * Cross-restart stable, per-account unique.
 */
export function deriveAccountStableId(uid: string, purpose: 'machine' | 'session'): string {
  const hash = createHash('sha256')
    .update(`wb2a:${purpose}:${uid}`)
    .digest('hex');
  return hash.slice(0, 36); // 36 hex chars
}

// ─── Header Builders ──────────────────────────────────────────────────

/**
 * Dựng header chung cho mọi request đến upstream.
 */
export function buildCommonHeaders(
  cred: WorkBuddyCredential,
): Record<string, string> {
  const origin = originFor(cred.realm);
  const headers: Record<string, string> = {
    [HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
    [HEADER_NAMES.X_REQUESTED_WITH]: 'XMLHttpRequest',
    [HEADER_NAMES.ORIGIN]: origin,
    [HEADER_NAMES.REFERER]: `${origin}/`,
    [HEADER_NAMES.USER_AGENT]: userAgentFor(cred.realm),
    [HEADER_NAMES.X_CODEBUDDY_REQUEST]: '1',
    [HEADER_NAMES.ACCEPT_LANGUAGE]: acceptLanguageFor(cred.realm),
  };

  // Machine-ID / Session-ID (per-account stable)
  if (cred.uid) {
    headers[HEADER_NAMES.X_MACHINE_ID] = deriveAccountStableId(cred.uid, 'machine');
    headers[HEADER_NAMES.X_SESSION_ID] = deriveAccountStableId(cred.uid, 'session');
  }

  return headers;
}

/**
 * Dựng header cho chat request.
 * Xây trên buildCommonHeaders() + chat-specific fields.
 */
export function buildChatHeaders(
  cred: WorkBuddyCredential,
  meta: WorkBuddyChatMeta,
  clientIp?: string,
): Record<string, string> {
  const headers = buildCommonHeaders(cred);

  // Chat endpoint accepts event-stream
  headers[HEADER_NAMES.ACCEPT] = `${CONTENT_TYPES.JSON}, ${CONTENT_TYPES.EVENT_STREAM}`;

  // Authorization
  if (cred.accessToken) {
    headers[HEADER_NAMES.AUTHORIZATION] = `Bearer ${cred.accessToken}`;
  } else {
    headers[HEADER_NAMES.X_NO_AUTHORIZATION] = '1';
  }

  // User ID
  if (cred.uid) {
    headers[HEADER_NAMES.X_USER_ID] = cred.uid;
  } else {
    headers[HEADER_NAMES.X_NO_USER_ID] = '1';
  }

  // Enterprise / Domain (per realm)
  if (cred.realm === 'cn') {
    if (cred.enterpriseId) {
      headers[HEADER_NAMES.X_ENTERPRISE_ID] = cred.enterpriseId;
    } else {
      headers[HEADER_NAMES.X_NO_ENTERPRISE_ID] = '1';
    }
    // CN realm: không có domain field nữa, dùng X-No-Department-Info
    headers[HEADER_NAMES.X_NO_DEPARTMENT_INFO] = '1';
  } else {
    // global realm: no enterprise, declare workbuddy.ai domain
    headers[HEADER_NAMES.X_NO_ENTERPRISE_ID] = '1';
    headers[HEADER_NAMES.X_DOMAIN] = 'www.workbuddy.ai';
  }

  // Device token (anti-fraud)
  if (cred.deviceToken) {
    headers[HEADER_NAMES.X_DEVICE_TOKEN] = cred.deviceToken;
  }

  // Conversation headers
  if (meta.conversationId) {
    headers['X-Conversation-ID'] = meta.conversationId;
  }
  headers['X-Conversation-Request-ID'] = meta.conversationRequestId;
  headers['X-Root-Request-ID'] = meta.conversationRequestId;
  if (meta.traceId) {
    headers['X-Trace-ID'] = meta.traceId;
  }

  // Client IP passthrough (optional)
  if (clientIp) {
    headers['X-Forwarded-For'] = clientIp;
    headers['X-Real-IP'] = clientIp;
  }

  return headers;
}

/**
 * Dựng header cho billing / refresh request.
 */
export function buildBillingHeaders(
  cred: WorkBuddyCredential,
): Record<string, string> {
  const origin = originFor(cred.realm);
  return {
    [HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
    [HEADER_NAMES.ORIGIN]: origin,
    [HEADER_NAMES.REFERER]: `${origin}/`,
    [HEADER_NAMES.USER_AGENT]: USER_AGENTS.BILLING,
    [HEADER_NAMES.X_CODEBUDDY_REQUEST]: '1',
    [HEADER_NAMES.AUTHORIZATION]: `Bearer ${cred.accessToken}`,
    [HEADER_NAMES.X_USER_ID]: cred.uid || '',
    [HEADER_NAMES.ACCEPT_LANGUAGE]: acceptLanguageFor(cred.realm),
    ...(cred.uid ? {
      [HEADER_NAMES.X_MACHINE_ID]: deriveAccountStableId(cred.uid, 'machine'),
      [HEADER_NAMES.X_SESSION_ID]: deriveAccountStableId(cred.uid, 'session'),
    } : {}),
  };
}

/**
 * Dựng header cho refresh token request.
 */
export function buildRefreshHeaders(
  cred: WorkBuddyCredential,
): Record<string, string> {
  return {
    [HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
    [HEADER_NAMES.ORIGIN]: originFor(cred.realm),
    [HEADER_NAMES.REFERER]: `${originFor(cred.realm)}/`,
    [HEADER_NAMES.USER_AGENT]: userAgentFor(cred.realm),
    [HEADER_NAMES.X_CODEBUDDY_REQUEST]: '1',
    [HEADER_NAMES.AUTHORIZATION]: `Bearer ${cred.accessToken}`,
    [HEADER_NAMES.X_USER_ID]: cred.uid || '',
    ...(cred.refreshToken ? { [HEADER_NAMES.X_REFRESH_TOKEN]: cred.refreshToken } : {}),
    ...(cred.uid ? {
      [HEADER_NAMES.X_MACHINE_ID]: deriveAccountStableId(cred.uid, 'machine'),
      [HEADER_NAMES.X_SESSION_ID]: deriveAccountStableId(cred.uid, 'session'),
    } : {}),
  };
}

// ─── Token Refresh ────────────────────────────────────────────────────

/**
 * Kiểm tra token có sắp hết hạn (trong vòng withinSeconds) không.
 * expiresAt = 0 → coi như đã hết hạn (cần refresh).
 */
export function needsRefresh(
  cred: WorkBuddyCredential,
  withinSeconds = 300,
): boolean {
  if (!cred.expiresAt) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return cred.expiresAt - nowSeconds < withinSeconds;
}

/**
 * Gọi upstream để refresh access token.
 * Cập nhật credential và trả về credential mới (dùng serializeCredential() để lưu).
 *
 * Hai-phase concurrency-safe (simplified cho TS single-thread):
 * 1. Gọi upstream với refresh token hiện tại
 * 2. Cập nhật credential fields
 *
 * @returns credential mới nếu thành công, null nếu thất bại (cần re-login)
 */
export async function refreshToken(
  cred: WorkBuddyCredential,
): Promise<WorkBuddyCredential | null> {
  if (!cred.refreshToken) {
    return null;
  }

  const base = chatBaseUrl(cred.realm);
  const url = `${base}${API_PATHS.AUTH_TOKEN_REFRESH}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TOKEN_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal as any,
      headers: buildRefreshHeaders(cred),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const envelope = (await res.json()) as WorkBuddyApiEnvelope<WorkBuddyTokenRefreshResponse>;

    // WorkBuddy trả token trực tiếp trong data (không qua biz_data)
    const tok = envelope.data as WorkBuddyTokenRefreshResponse | undefined;
    if (!tok?.accessToken) {
      return null;
    }

    const updated: WorkBuddyCredential = {
      ...cred,
      accessToken: tok.accessToken,
    };

    if (tok.refreshToken) {
      updated.refreshToken = tok.refreshToken;
    }

    // Validate expiresIn (ignore > 10 years = dirty data)
    if (tok.expiresIn > 0 && tok.expiresIn < REFRESH_TOKEN_MAX_EXPIRY_SECONDS) {
      updated.expiresAt = Math.floor(Date.now() / 1000) + tok.expiresIn;
    }

    return updated;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// ─── Error Classification ─────────────────────────────────────────────

/**
 * Classify upstream HTTP error response → WorkBuddyUpstreamError.
 * Logic mirror từ workbuddy2api/internal/upstream/client.go → Classify().
 */
export function classifyError(
  status: number,
  body: string,
): WorkBuddyUpstreamError {
  const bodyLower = body.toLowerCase();

  const result = (kind: WorkBuddyErrKind): WorkBuddyUpstreamError => ({
    kind,
    status,
    message: body.slice(0, 500),
  });

  // 401: session dead
  if (status === 401) {
    for (const m of SESSION_DEAD_MARKERS) {
      if (body.includes(m)) return result('session_dead');
    }
    return result('session_dead');
  }

  // 402: hard credit
  if (status === 402) return result('hard_credit');

  // 403: WAF block (non-JSON body) or account fault
  if (status === 403) {
    // Nếu body có dấu hiệu JSON biz envelope → account fault, không phải WAF
    if (body.includes('"code"') && body.includes('"msg"')) {
      for (const m of ACCOUNT_FAULT_MARKERS) {
        if (bodyLower.includes(m.toLowerCase())) return result('account_fault');
      }
    }
    return result('waf_block');
  }

  // 404: not found (short cooldown)
  if (status === 404) {
    // Nhưng nếu có prompt too long marker → prompt_too_long
    for (const m of PROMPT_TOO_LONG_MARKERS) {
      if (body.includes(m)) return result('prompt_too_long');
    }
    return result('not_found');
  }

  // 400: bad request – nhiều sub-cases
  if (status === 400) {
    // Prompt too long (11115)
    for (const m of PROMPT_TOO_LONG_MARKERS) {
      if (body.includes(m)) return result('prompt_too_long');
    }

    // Content blocked by security policy
    for (const m of CONTENT_BLOCKED_MARKERS) {
      if (bodyLower.includes(m.toLowerCase())) return result('content_blocked');
    }

    // Invalid image
    for (const m of INVALID_IMAGE_MARKERS) {
      if (bodyLower.includes(m.toLowerCase())) return result('image_invalid');
    }
    // code 11135 = invalid image
    if (body.includes('"code":11135') || body.includes('"code": 11135')) {
      return result('image_invalid');
    }

    // Bad params (request body malformed)
    if (bodyLower.includes(BAD_PARAMS_MARKER.toLowerCase())) {
      return result('bad_params');
    }

    // Model blocked (11102)
    if (
      body.includes(`"code":${MODEL_BLOCKED_CODE}`) ||
      body.includes(`"code": ${MODEL_BLOCKED_CODE}`)
    ) {
      return result('model_blocked');
    }

    return result('client');
  }

  // 429: rate limit
  if (status === 429) return result('soft_rate');

  // 5xx: server error
  if (status >= 500) return result('server');

  // Soft rate markers in body (any status)
  for (const m of RATE_LIMIT_MARKERS) {
    if (bodyLower.includes(m.toLowerCase())) return result('soft_rate');
  }

  // Hard credit in body (any status)
  for (const m of HARD_CREDIT_MARKERS) {
    if (bodyLower.includes(m.toLowerCase())) return result('hard_credit');
  }

  // Account fault
  for (const m of ACCOUNT_FAULT_MARKERS) {
    if (bodyLower.includes(m.toLowerCase())) return result('account_fault');
  }

  // Session dead in body
  for (const m of SESSION_DEAD_MARKERS) {
    if (body.includes(m)) return result('session_dead');
  }

  return result('client');
}

/**
 * Parse Retry-After header value → milliseconds.
 * Returns 0 if not present or invalid.
 */
export function parseRetryAfterMs(headerValue: string | null | undefined): number {
  if (!headerValue) return 0;
  const seconds = parseFloat(headerValue);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.floor(seconds * 1000);
  }
  return 0;
}
