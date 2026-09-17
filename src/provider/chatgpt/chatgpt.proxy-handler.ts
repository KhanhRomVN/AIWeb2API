/**
 * ------------------------------------------------------------------
 * ChatGPT Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture access token và email từ ChatGPT web session.
 * Khi user login qua browser, `/backend-api/me` trả về thông tin user
 * và Authorization header của mọi request tới chatgpt.com mang Bearer AT.
 *
 * Main features:
 * - onRequest()       : Capture Authorization header
 * - onResponseBody()  : Capture email từ /backend-api/me
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { ChatGPTUserInfo } from './chatgpt.types';

// ── Constants ──
import {
  API_PATHS,
  CHATGPT_EVENTS,
  HTTP_HEADER_NAMES_LOWERCASE,
} from './chatgpt.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ChatGPTProxy');

const CHATGPT_HOST = 'chatgpt.com';
const BEARER_PREFIX = 'Bearer ';

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Kiểm tra Authorization header có phải bearer token của ChatGPT không.
 * Bearer AT thường là JWT bắt đầu bằng `eyJ`; loại trừ các token ngắn
 * (session cookie header) bằng cách check độ dài tối thiểu.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) return null;
  const token = authHeader.slice(BEARER_PREFIX.length).trim();
  if (token.length < 30) return null;
  return token;
}

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes(CHATGPT_HOST)) {
      const auth =
        ctx.clientToProxyRequest.headers[
          HTTP_HEADER_NAMES_LOWERCASE.AUTHORIZATION
        ];
      const token = extractBearerToken(auth);
      if (token) {
        proxyEvents.emit(CHATGPT_EVENTS.AUTH_HEADER, auth);
        proxyEvents.emit(CHATGPT_EVENTS.LOGIN_TOKEN, { cookies: token });
      }
    }
    callback();
  },

  onRequestData: (
    _ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url: string = ctx.clientToProxyRequest.url || '';

    if (
      !host ||
      !host.includes(CHATGPT_HOST) ||
      !url.includes(API_PATHS.ME)
    ) {
      return;
    }

    try {
      const json = JSON.parse(body) as ChatGPTUserInfo;
      if (json.email) {
        proxyEvents.emit(CHATGPT_EVENTS.LOGIN_EMAIL, { email: json.email });
      }
      proxyEvents.emit(CHATGPT_EVENTS.USER_INFO, json);
    } catch (e) {
      logger.warn('[ChatGPT Proxy] Failed to parse /me response:', e);
    }
  },
};