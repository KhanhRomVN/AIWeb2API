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
import { KIRO_EVENTS } from './kiro.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KiroProxyHandler');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && (host.includes('kiro.dev') || host.includes('amazonaws.com'))) {
      const authHeader = ctx.clientToProxyRequest.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        proxyEvents.emit(KIRO_EVENTS.ACCESS_TOKEN, token);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // Capture responses từ Kiro và AWS OIDC endpoints
    if (host && (host.includes('kiro.dev') || host.includes('oidc') || host.includes('amazonaws.com'))) {
      try {
        const json = JSON.parse(body);

        // Capture device code response
        if (json.device_code && json.user_code) {
          logger.info(`[Kiro] 🎯 Device code obtained: ${json.user_code}`);
          proxyEvents.emit(KIRO_EVENTS.DEVICE_CODE, json);
        }

        // Capture access tokens từ OAuth response
        if (json.accessToken || json.access_token) {
          const token = json.accessToken || json.access_token;
          logger.info(`[Kiro] 🎯 Captured access token`);
          proxyEvents.emit(KIRO_EVENTS.ACCESS_TOKEN, token);

          const refreshToken = json.refreshToken || json.refresh_token;
          if (refreshToken) {
            logger.info('[Kiro] 🎯 Captured refresh token');
            proxyEvents.emit(KIRO_EVENTS.REFRESH_TOKEN, refreshToken);
          }
        }

        // Capture email
        if (json.email || json.user?.email || json.userEmail) {
          const email = json.email || json.user?.email || json.userEmail;
          logger.info(`[Kiro] 📧 Captured email: ${email}`);
          proxyEvents.emit(KIRO_EVENTS.LOGIN_EMAIL, email);
        }
      } catch (e) {
        // Not JSON - skip
      }
    }
  },
};
