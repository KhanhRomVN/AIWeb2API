/**
 * ------------------------------------------------------------------
 * Qwen Proxy Handler
 * ------------------------------------------------------------------
 * Capture token, headers, và email từ Qwen.
 * ------------------------------------------------------------------
 */

import type { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';
import { createLogger } from '../../utils/logger';
import { createCookieCaptureHandler } from '../_shared/proxy/cookie-capture-handler';
import { QWEN_EVENTS, HOSTS } from './qwen.constant';

const logger = createLogger('QwenProvider');

export const proxyHandler: ProxyHandler = {
  ...createCookieCaptureHandler({
    hosts: [HOSTS.CHAT_QWEN],
    cookieMarker: 'csrfToken',
    event: QWEN_EVENTS.COOKIES,
    extraHeaders: ['bx-ua', 'x-csrf-token', 'bx-umidtoken'],
    headersEvent: QWEN_EVENTS.HEADERS,
  }),
  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v2/auths/signin')
    ) {
      const bodyStr = chunk.toString();
      try {
        const json = JSON.parse(bodyStr);
        if (json.email) {
          (ctx as any).capturedQwenEmail = json.email;
          proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email: json.email });
        }
      } catch (e) {
        const emailMatch = bodyStr.match(
          /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
        );
        if (emailMatch && emailMatch[0]) {
          const email = `${emailMatch[1]}@${emailMatch[2]}`.replace(/\\/g, '');
          if (!email.includes('***')) {
            (ctx as any).capturedQwenEmail = email;
            proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email });
          }
        }
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v2/auths/signin')
    ) {
      try {
        const json = JSON.parse(body);
        const userData = json.data;
        if (userData) {
          const capturedEmail = (ctx as any).capturedQwenEmail;

          let email = capturedEmail || userData.email;
          if (email && email.includes('***') && capturedEmail) {
            email = capturedEmail;
          }
          if (email && !email.includes('***')) {
            proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email });
          }

          if (userData.token) {
            const eventPayload: any = { cookies: userData.token };
            if (email && !email.includes('***')) {
              eventPayload.email = email;
            }
            proxyEvents.emit(QWEN_EVENTS.LOGIN_TOKEN, eventPayload);
            delete (ctx as any).capturedQwenEmail;
          }
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Qwen Signin Response:', e);
      }
    }

    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v1/auths/')
    ) {
      try {
        const json = JSON.parse(body);
        const userData = json.data ?? json;

        if (userData && userData.token) {
          const capturedEmail = (ctx as any).capturedQwenEmail;
          let email = capturedEmail || userData.email;
          if (email && email.includes('***') && capturedEmail) {
            email = capturedEmail;
          }

          const eventPayload: any = { cookies: userData.token };
          if (email && !email.includes('***')) {
            eventPayload.email = email;
            proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email });
          }
          proxyEvents.emit(QWEN_EVENTS.LOGIN_TOKEN, eventPayload);
        } else if (
          userData &&
          userData.email &&
          !userData.email.includes('***')
        ) {
          proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email: userData.email });
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Qwen Auth Session Response:', e);
      }
    }
  },
};
