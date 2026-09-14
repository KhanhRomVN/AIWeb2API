/**
 * ------------------------------------------------------------------
 * HuggingChat Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies và email từ HuggingChat.
 *
 * Main features:
 * - onRequest()       : Capture token cookie
 * - onResponseBody()  : Capture email từ login response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import {
  API_PATHS,
  COOKIE_NAMES,
  HOSTS,
  HUGGINGCHAT_EVENTS,
  REGEX_PATTERNS,
} from './huggingchat.constant';

// ── Types ──
import { HuggingChatUserResponse } from './huggingchat.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('HuggingChatProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes(HOSTS.HUGGINGFACE)) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes(COOKIE_NAMES.TOKEN)) {
        proxyEvents.emit(HUGGINGCHAT_EVENTS.COOKIES, reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes(HOSTS.HUGGINGFACE) &&
      url.includes(API_PATHS.CHAT_LOGIN)
    ) {
      try {
        const json = JSON.parse(body) as HuggingChatUserResponse;
        if (json.email)
          proxyEvents.emit(HUGGINGCHAT_EVENTS.LOGIN_DATA, json.email);
      } catch (e) {
        const emailMatch = body.match(REGEX_PATTERNS.EMAIL_IN_BODY);
        if (emailMatch && emailMatch[1]) {
          proxyEvents.emit(HUGGINGCHAT_EVENTS.LOGIN_DATA, emailMatch[1]);
        }
      }
    }
  },
};