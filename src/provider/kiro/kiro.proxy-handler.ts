/**
 * ------------------------------------------------------------------
 * Kiro Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture device code flow responses (optional).
 * Device code flow chủ yếu chạy qua direct API calls, không cần proxy.
 *
 * Main features:
 * - onRequest()       : Capture access token từ Authorization header
 * - onResponseBody()  : Capture device codes và tokens (optional)
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
  API_FIELDS,
  HOSTS,
  HTTP_HEADERS,
  KIRO_EVENTS,
} from './kiro.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KiroProxyHandler');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && (host.includes(HOSTS.KIRO) || host.includes(HOSTS.AWS))) {
      const authHeader = ctx.clientToProxyRequest.headers.authorization;
      if (authHeader && authHeader.startsWith(HTTP_HEADERS.BEARER_PREFIX)) {
        const token = authHeader.replace(HTTP_HEADERS.BEARER_PREFIX, '');
        proxyEvents.emit(KIRO_EVENTS.ACCESS_TOKEN, token);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // Capture responses từ Kiro và AWS OIDC endpoints
    if (
      host &&
      (host.includes(HOSTS.KIRO) ||
        host.includes('oidc') ||
        host.includes(HOSTS.AWS))
    ) {
      try {
        const json = JSON.parse(body) as Record<string, unknown>;

        // Capture device code response
        if (
          json[API_FIELDS.DEVICE_CODE_SNAKE] &&
          json[API_FIELDS.USER_CODE_SNAKE]
        ) {
          proxyEvents.emit(KIRO_EVENTS.DEVICE_CODE, json);
        }

        // Capture access tokens từ OAuth response
        const accessToken =
          json[API_FIELDS.ACCESS_TOKEN] || json[API_FIELDS.ACCESS_TOKEN_SNAKE];
        if (accessToken) {
          proxyEvents.emit(KIRO_EVENTS.ACCESS_TOKEN, accessToken);

          const refreshToken =
            json[API_FIELDS.REFRESH_TOKEN] ||
            json[API_FIELDS.REFRESH_TOKEN_SNAKE];
          if (refreshToken) {
            proxyEvents.emit(KIRO_EVENTS.REFRESH_TOKEN, refreshToken);
          }
        }

        // Capture email
        const user = json[API_FIELDS.USER] as { email?: string } | undefined;
        const email =
          json[API_FIELDS.EMAIL] ||
          user?.email ||
          json[API_FIELDS.USER_EMAIL];
        if (email) {
          proxyEvents.emit(KIRO_EVENTS.LOGIN_EMAIL, email);
        }
      } catch (e) {
        // Not JSON - skip
      }
    }
  },
};