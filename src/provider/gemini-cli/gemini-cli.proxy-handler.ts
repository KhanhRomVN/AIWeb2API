/**
 * ------------------------------------------------------------------
 * Gemini CLI Proxy Handler
 * ------------------------------------------------------------------
 * Bắt authorization code từ Google OAuth2 redirect đến localhost.
 *
 * Khi browser navigate về http://localhost:11451/?code=AUTH_CODE&state=...,
 * request đó đi qua proxy → onRequest emit event với code.
 *
 * Event: GEMINI_CLI_EVENTS.AUTH_CODE  →  { code, state }
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ProxyHandler, proxyEvents } from '../../services/proxy.service';
import { createLogger } from '../../utils/logger';
import { GEMINI_CLI_EVENTS, OAUTH_CALLBACK_HOST } from './gemini-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiCliProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    try {
      const host: string = ctx.clientToProxyRequest.headers.host ?? '';
      const rawUrl: string = ctx.clientToProxyRequest.url ?? '';

      // Bắt redirect về localhost callback (port 11451)
      if (host.startsWith(OAUTH_CALLBACK_HOST)) {
        // rawUrl = /?code=4%2F0A...&scope=...&state=...
        const urlObj = new URL(rawUrl, `http://${host}`);
        const code = urlObj.searchParams.get('code');
        const state = urlObj.searchParams.get('state');

        if (code) {
          proxyEvents.emit(GEMINI_CLI_EVENTS.AUTH_CODE, {
            code,
            state: state ?? '',
          });
        }
      }
    } catch (e) {
      // ignore — không được throw từ proxy handler
    }
    callback();
  },
};
