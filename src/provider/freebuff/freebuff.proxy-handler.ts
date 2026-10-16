/**
 * ------------------------------------------------------------------
 * Freebuff Proxy Handler
 * ------------------------------------------------------------------
 * Capture cookies và session user info từ Freebuff.
 * ------------------------------------------------------------------
 */

import type { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';
import { createCookieCaptureHandler } from '../_shared/proxy/cookie-capture-handler';
import { createJsonResponseSniffer } from '../_shared/proxy/json-response-sniffer';
import {
  FREEBUFF_EVENTS,
  FREEBUFF_HOST,
  SESSION_TOKEN_KEY,
} from './freebuff.constant';

interface FreebuffSessionResponse {
  user?: { email?: string };
}

export const proxyHandler: ProxyHandler = {
  ...createCookieCaptureHandler({
    hosts: [FREEBUFF_HOST],
    cookieMarker: SESSION_TOKEN_KEY,
    event: FREEBUFF_EVENTS.LOGIN_TOKEN,
    mapPayload: (cookies) => ({ cookies }),
  }),

  ...createJsonResponseSniffer<FreebuffSessionResponse>({
    hosts: [FREEBUFF_HOST],
    urlIncludes: '/api/auth/session',
    label: 'FreebuffProxy',
    onJson: (json, ctx) => {
      const email = json?.user?.email;
      if (!email) return;

      proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_EMAIL, { email });

      const reqCookies: string | undefined =
        ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies) {
        proxyEvents.emit(FREEBUFF_EVENTS.LOGIN_TOKEN, {
          cookies: reqCookies,
          email,
        });
      }
    },
  }),
};
