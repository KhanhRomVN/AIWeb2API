/**
 * ------------------------------------------------------------------
 * Claude Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies và login info từ Claude AI.
 * Lắng nghe Authorization header, login email, và login token.
 *
 * Main features:
 * - onRequest()       : Capture Authorization header
 * - onRequestData()   : Capture login email từ request body
 * - onResponseBody()  : Capture login token từ response body
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { ClaudeLoginTokenPayload } from './claude.types';

// ── Constants ──
import {
  CLAUDE_EVENTS,
  CLAUDE_HOST,
  AUTH_PATH_PREFIX,
  API_FIELDS,
  HTTP_HEADER_NAMES_LOWERCASE,
} from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes(CLAUDE_HOST)) {
      const auth =
        ctx.clientToProxyRequest.headers[
          HTTP_HEADER_NAMES_LOWERCASE.AUTHORIZATION
        ];

      if (auth) {
        proxyEvents.emit(CLAUDE_EVENTS.AUTH_HEADER, auth);
      }
    }
    callback();
  },

  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes(CLAUDE_HOST) && url.includes(AUTH_PATH_PREFIX)) {
      const bodyStr = chunk.toString();
      try {
        const json = JSON.parse(bodyStr) as Record<string, unknown>;
        const email = json[API_FIELDS.EMAIL] as string | undefined;
        if (email) {
          proxyEvents.emit(CLAUDE_EVENTS.LOGIN_EMAIL, { email });
        }
      } catch (e) {
        logger.warn('[Proxy] Failed to parse Claude auth request body:', e);
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes(CLAUDE_HOST) && url.includes(AUTH_PATH_PREFIX)) {
      try {
        const json = JSON.parse(body) as Record<string, unknown>;
        const token = json[API_FIELDS.TOKEN] as string | undefined;
        if (token) {
          const payload: ClaudeLoginTokenPayload = { cookies: token };
          proxyEvents.emit(CLAUDE_EVENTS.LOGIN_TOKEN, payload);
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Claude Login Response:', e);
      }
    }
  },
};
