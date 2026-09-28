/**
 * ------------------------------------------------------------------
 * Freebuff Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies và thông tin user từ Freebuff.
 * ------------------------------------------------------------------
 */

import { ProxyHandler, proxyEvents } from '../../services/proxy.service';
import { createLogger } from '../../utils/logger';
import {
  FREEBUFF_EVENTS,
  FREEBUFF_HOST,
  SESSION_TOKEN_KEY,
} from './freebuff.constant';

const logger = createLogger('FreebuffProxy');

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host: string | undefined = ctx.clientToProxyRequest.headers.host;

    if (host?.includes(FREEBUFF_HOST)) {
      const reqCookies: string | undefined =
        ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies?.includes(SESSION_TOKEN_KEY)) {
        proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_TOKEN, { cookies: reqCookies });
      }
    }

    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host: string | undefined = ctx.clientToProxyRequest.headers.host;
    const url: string = ctx.clientToProxyRequest.url;

    if (!host?.includes(FREEBUFF_HOST)) return;
    if (!url.includes('/api/auth/session')) return;

    try {
      const json = JSON.parse(body);
      if (!json?.user?.email) return;

      proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_EMAIL, {
        email: json.user.email,
      });

      const reqCookies: string | undefined =
        ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies) {
        proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_TOKEN, {
          cookies: reqCookies,
          email: json.user.email,
        });
      }
    } catch {
      // Body không phải JSON hợp lệ — bỏ qua
    }
  },
};
