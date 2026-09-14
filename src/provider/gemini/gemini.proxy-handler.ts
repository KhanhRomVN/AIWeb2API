/**
 * ------------------------------------------------------------------
 * Gemini Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies, email, và XSRF token từ Gemini.
 * Lắng nghe authenticated cookies, SAPISID, auth user, và email.
 *
 * Main features:
 * - onRequest()       : Capture cookies, SAPISID, auth user
 * - onResponseBody()  : Capture email từ Google APIs và XSRF token
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
  GEMINI_EVENTS,
  GEMINI_HOST,
  GOOGLE_APIS_HOST,
  GOOGLE_ACCOUNTS_HOST,
  BATCH_EXECUTE_PATH,
  OAUTH2_PATH,
  USERINFO_PATH,
  SIGNIN_OAUTH_PATH,
  COOKIE_NAMES,
  XSRF_MARKER,
  EMAIL_MARKER,
  MASKED_EMAIL_INDICATOR,
  REGEX_PATTERNS,
} from './gemini.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes(GEMINI_HOST)) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies) {
        const hasSID = reqCookies.includes(COOKIE_NAMES.SID);
        const hasSecure1PSID = reqCookies.includes(COOKIE_NAMES.SECURE_1PSID);
        if (hasSID && hasSecure1PSID) {
          proxyEvents.emit(GEMINI_EVENTS.COOKIES, { cookies: reqCookies });

          const sapisidMatch = reqCookies.match(
            REGEX_PATTERNS.SAPISID_IN_COOKIE,
          );
          if (sapisidMatch) {
            proxyEvents.emit(GEMINI_EVENTS.SAPISID, {
              sapisid: sapisidMatch[1],
            });
          }
        }
      }

      const authUserMatch = url.match(REGEX_PATTERNS.AUTH_USER_IN_URL);
      if (authUserMatch) {
        proxyEvents.emit(GEMINI_EVENTS.AUTH_USER, {
          authUser: authUserMatch[1],
        });
      }
    }

    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    const emailMatch =
      body.match(REGEX_PATTERNS.EMAIL_IN_BODY) ||
      body.match(REGEX_PATTERNS.USER_EMAIL_JSON);

    if (
      host &&
      host.includes(GOOGLE_APIS_HOST) &&
      url.includes(OAUTH2_PATH) &&
      url.includes(USERINFO_PATH)
    ) {
      if (emailMatch && emailMatch[1]) {
        proxyEvents.emit(GEMINI_EVENTS.EMAIL, { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes(GOOGLE_ACCOUNTS_HOST) &&
      (url.includes(SIGNIN_OAUTH_PATH) || url.includes(USERINFO_PATH))
    ) {
      if (
        emailMatch &&
        emailMatch[1] &&
        !emailMatch[1].includes(MASKED_EMAIL_INDICATOR)
      ) {
        proxyEvents.emit(GEMINI_EVENTS.EMAIL, { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes(GEMINI_HOST) &&
      url.includes(BATCH_EXECUTE_PATH) &&
      body.includes(EMAIL_MARKER) &&
      body.includes('@')
    ) {
      if (emailMatch && emailMatch[1]) {
        proxyEvents.emit(GEMINI_EVENTS.EMAIL, { email: emailMatch[1] });
      }
    }

    if (host && host.includes(GEMINI_HOST) && body.includes(XSRF_MARKER)) {
      const xsrfMatch = body.match(REGEX_PATTERNS.XSRF_IN_BODY);
      if (xsrfMatch && xsrfMatch[1]) {
        proxyEvents.emit(GEMINI_EVENTS.XSRF, { xsrfToken: xsrfMatch[1] });
      }
    }
  },
};