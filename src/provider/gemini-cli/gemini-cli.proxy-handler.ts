/**
 * ------------------------------------------------------------------
 * Gemini CLI Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture tokens, project ID, và user info từ Gemini CLI.
 * Lắng nghe OAuth token response, project ID từ loadCodeAssist API,
 * và user info từ Google userinfo API.
 *
 * Main features:
 * - onRequest()       : Capture cookies chứa token
 * - onResponseBody()  : Capture access token, project ID, email
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
  API_PATHS,
  COOKIE_NAMES,
  GEMINI_CLI_EVENTS,
  HOSTS,
} from './gemini-cli.constant';

// ── Types ──
import {
  GeminiLoadCodeAssistResponse,
  GeminiTokenResponse,
  GeminiUserInfoResponse,
} from './gemini-cli.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiCLIProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      (host.includes(HOSTS.GOOGLE_ACCOUNTS) || host.includes(HOSTS.CLOUDCODE_PA))
    ) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (
        reqCookies &&
        (reqCookies.includes(COOKIE_NAMES.ACCESS_TOKEN) ||
          reqCookies.includes(COOKIE_NAMES.REFRESH_TOKEN))
      ) {
        proxyEvents.emit(GEMINI_CLI_EVENTS.TOKENS, reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes(HOSTS.OAUTH2) &&
      url.includes(API_PATHS.OAUTH_TOKEN)
    ) {
      try {
        const json = JSON.parse(body) as GeminiTokenResponse;
        if (json.access_token)
          proxyEvents.emit(GEMINI_CLI_EVENTS.TOKENS, JSON.stringify(json));
      } catch (e) {
        logger.error('[Proxy] Failed to parse Gemini CLI token response:', e);
      }
    }

    if (
      host &&
      host.includes(HOSTS.CLOUDCODE_PA) &&
      url.includes(API_PATHS.LOAD_CODE_ASSIST)
    ) {
      try {
        const json = JSON.parse(body) as GeminiLoadCodeAssistResponse;
        const rawProject = json[API_FIELDS.PROJECT_ID];
        if (rawProject) {
          const projectId =
            typeof rawProject === 'string'
              ? rawProject
              : rawProject[API_FIELDS.PROJECT_ID_NESTED] || '';
          proxyEvents.emit(GEMINI_CLI_EVENTS.USER_INFO, { projectId });
        }
      } catch (e) {
        logger.error(
          '[Proxy] Failed to parse Gemini CLI loadCodeAssist response:',
          e,
        );
      }
    }

    if (
      host &&
      host.includes(HOSTS.WWW_GOOGLEAPIS) &&
      url.includes(API_PATHS.USERINFO)
    ) {
      try {
        const json = JSON.parse(body) as GeminiUserInfoResponse;
        if (json.email)
          proxyEvents.emit(GEMINI_CLI_EVENTS.USER_INFO, {
            email: json.email,
            name: json.name,
          });
      } catch (e) {
        logger.error(
          '[Proxy] Failed to parse Gemini CLI userinfo response:',
          e,
        );
      }
    }
  },
};