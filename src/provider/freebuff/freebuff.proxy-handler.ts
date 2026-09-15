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
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes(FREEBUFF_HOST)) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes(SESSION_TOKEN_KEY)) {
        logger.debug('[FreebuffProxy] Captured session cookie from request');
        proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_TOKEN, { cookies: reqCookies });
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes(FREEBUFF_HOST) &&
      url.includes('/api/auth/session')
    ) {
      try {
        const json = JSON.parse(body);
        if (json?.user?.email) {
          proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_EMAIL, {
            email: json.user.email,
          });

          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (reqCookies) {
            proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_TOKEN, {
              cookies: reqCookies,
              email: json.user.email,
            });
          }
        }
      } catch (e) {
        logger.debug(
          '[FreebuffProxy] Failed to parse session response body:',
          e,
        );
      }
    }
  },
};
