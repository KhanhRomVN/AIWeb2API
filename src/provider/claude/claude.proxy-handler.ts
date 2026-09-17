/**
 * ------------------------------------------------------------------
 * Claude Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies và organizationId từ Claude AI.
 *
 * Vì mỗi request có `ctx` object mới, cookie (capture ở request chat)
 * và orgId (capture ở request bootstrap) không cùng tồn tại trong 1 ctx.
 * Giải pháp: dùng Map toàn cục theo host để giữ state xuyên request.
 *
 * Nguồn capture:
 * - Cookie header trên mọi request tới claude.ai (thay vì Authorization,
 *   vì Claude.ai dùng session cookie HttpOnly chứ không dùng Bearer token).
 * - organizationId: trích từ URL bootstrap (`/edge-api/bootstrap/{org}/...`)
 *   hoặc từ response body của bootstrap (`account.memberships[0].organization.uuid`).
 *
 * Main features:
 * - onRequest()       : Capture Cookie header + orgId từ URL, lưu vào Map
 * - onResponseBody()  : Capture orgId + email từ bootstrap response, emit event
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  ClaudeBootstrapResponse,
  ClaudeLoginTokenPayload,
} from './claude.types';

// ── Constants ──
import {
  CLAUDE_EVENTS,
  CLAUDE_HOST,
  CLAUDE_BOOTSTRAP_PATH_PREFIX,
  API_FIELDS,
  HTTP_HEADER_NAMES_LOWERCASE,
} from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeProxy');

/** Regex trích orgId từ URL bootstrap: /edge-api/bootstrap/{uuid}/app_start */
const BOOTSTRAP_ORG_REGEX =
  /\/edge-api\/bootstrap\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Map lưu state xuyên request trong 1 login session.
 * Key: host. Value: `{ cookie, organizationId, email, lastEmittedAt }`.
 * Chỉ giữ cookie mới nhất và orgId mới nhất — emit event mỗi khi có
 * trường mới xuất hiện, để login flow bắt được cả 2 field.
 */
const sessionState = new Map<
  string,
  {
    cookie?: string;
    organizationId?: string;
    email?: string;
  }
>();

// ─── Helpers ────────────────────────────────────────────────────────────

/** Lấy orgId từ URL bootstrap; trả null nếu không match. */
function extractOrgIdFromUrl(url: string): string | null {
  const match = url.match(BOOTSTRAP_ORG_REGEX);
  return match ? match[1] : null;
}

/**
 * Extract cookie từ header `cookie` khi header chứa `sessionKey` (đã login)
 * HOẶC `cf_clearance` (Cloudflare challenge đã pass — cần cho mọi request
 * qua edge Cloudflare, kể cả trước khi user login xong).
 *
 * Trước đây chỉ check `sessionKey` → cookie `cf_clearance` bị bỏ trong giai
 * đoạn user chưa login xong, khiến request sau login luôn 403.
 * Trả null nếu header không có cookie nào hữu ích.
 */
function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  if (!/sessionKey=/.test(cookieHeader) && !/cf_clearance=/.test(cookieHeader)) {
    return null;
  }
  return cookieHeader;
}

/**
 * Emit event LOGIN_TOKEN với state hiện tại (cookie + orgId + email).
 * Chỉ emit khi có ít nhất cookie hoặc orgId, để login flow check validation.
 */
function emitLoginToken(host: string): void {
  const state = sessionState.get(host);
  if (!state) return;
  if (!state.cookie && !state.organizationId) return;

  const payload: ClaudeLoginTokenPayload = {
    cookies: state.cookie || '',
    organizationId: state.organizationId,
    email: state.email,
  };
  proxyEvents.emit(CLAUDE_EVENTS.LOGIN_TOKEN, payload);

  if (state.email) {
    proxyEvents.emit(CLAUDE_EVENTS.LOGIN_EMAIL, { email: state.email });
  }
}

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes(CLAUDE_HOST)) {
      const state = sessionState.get(host) || {};
      let changed = false;

      // 1. Capture Cookie header khi có sessionKey hoặc cf_clearance.
      // Luôn update khi cookie header dài hơn state cũ — cookie
      // `cf_clearance` / `__cf_bm` có thể bị Cloudflare refresh qua
      // /cdn-cgi/challenge-platform/... và state phải phản ánh bản mới nhất.
      const cookieHeader =
        ctx.clientToProxyRequest.headers[HTTP_HEADER_NAMES_LOWERCASE.COOKIE];
      const sessionCookie = extractSessionCookie(cookieHeader);
      if (
        sessionCookie &&
        (sessionCookie !== state.cookie ||
          sessionCookie.length > (state.cookie?.length || 0))
      ) {
        state.cookie = sessionCookie;
        changed = true;
      }

      // 2. Capture orgId nếu request đang gọi bootstrap endpoint
      const url: string = ctx.clientToProxyRequest.url || '';
      const orgIdFromUrl = extractOrgIdFromUrl(url);
      if (orgIdFromUrl && orgIdFromUrl !== state.organizationId) {
        state.organizationId = orgIdFromUrl;
        changed = true;
      }

      if (changed) {
        sessionState.set(host, state);
        emitLoginToken(host);
      }
    }
    callback();
  },

  onRequestData: (
    _ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    // verify_google body chỉ chứa `code` OAuth — không cần parse.
    // Email sẽ lấy từ bootstrap response.
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url: string = ctx.clientToProxyRequest.url || '';

    if (
      !host ||
      !host.includes(CLAUDE_HOST) ||
      !url.includes(CLAUDE_BOOTSTRAP_PATH_PREFIX)
    ) {
      return;
    }

    try {
      const json = JSON.parse(body) as ClaudeBootstrapResponse;
      const account = json[API_FIELDS.ACCOUNT];
      const membership = account?.memberships?.[0];
      const orgId =
        membership?.organization?.uuid || extractOrgIdFromUrl(url) || undefined;
      const email = account?.[API_FIELDS.EMAIL_ADDRESS] || undefined;

      const state = sessionState.get(host) || {};
      let changed = false;

      if (orgId && orgId !== state.organizationId) {
        state.organizationId = orgId;
        changed = true;
      }
      if (email && email !== state.email) {
        state.email = email;
        changed = true;
      }

      if (changed) {
        sessionState.set(host, state);
        emitLoginToken(host);
      }
    } catch (e) {
      logger.warn('[Proxy] Failed to parse Claude bootstrap response:', e);
    }
  },
};

/**
 * Xóa state của 1 host khi login session kết thúc.
 * Login flow nên gọi hàm này để tránh leak state giữa các session.
 */
export function clearClaudeSessionState(host: string = CLAUDE_HOST): void {
  sessionState.delete(host);
}