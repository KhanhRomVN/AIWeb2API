/**
 * ------------------------------------------------------------------
 * Codex CLI Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture tokens và user info từ Codex CLI.
 * Lắng nghe access token từ OAuth token endpoint và email từ usage API.
 *
 * Main features:
 * - onResponseBody() : Capture access/refresh token từ auth.openai.com
 * - onResponseBody() : Capture user email từ chatgpt.com/backend-api
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
  AUTH_CONFIG,
  CODEX_CLI_EVENTS,
  HOSTS,
  TOKEN_FIELDS,
} from './codex-cli.constant';

// ── Types ──
import { CodexTokenResponse, CodexUsageResponse } from './codex-cli.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CodexCLIProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes(HOSTS.AUTH_OPENAI) &&
      url.includes(API_PATHS.OAUTH_TOKEN)
    ) {
      try {
        const json = JSON.parse(body) as CodexTokenResponse;
        if (json.access_token) {
          proxyEvents.emit(CODEX_CLI_EVENTS.TOKENS, {
            cookies: JSON.stringify({
              [TOKEN_FIELDS.ACCESS_TOKEN]: json.access_token,
              [TOKEN_FIELDS.REFRESH_TOKEN]: json.refresh_token || '',
              [TOKEN_FIELDS.EXPIRES_IN]:
                json.expires_in || AUTH_CONFIG.DEFAULT_EXPIRES_IN,
            }),
          });
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Codex CLI token response:', e);
      }
    }

    if (
      host &&
      host.includes(HOSTS.CHATGPT) &&
      url.includes(API_PATHS.WHAM_USAGE)
    ) {
      try {
        const json = JSON.parse(body) as CodexUsageResponse;
        if (json.email) proxyEvents.emit(CODEX_CLI_EVENTS.USER_INFO, json);
      } catch (e) {
        logger.error('[Proxy] Failed to parse Codex CLI usage response:', e);
      }
    }
  },
};