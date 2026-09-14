/**
 * ------------------------------------------------------------------
 * Qwen CLI Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture tokens và user info từ Qwen CLI.
 * Lắng nghe access token từ OAuth token endpoint và email từ user API.
 *
 * Main features:
 * - onResponseBody() : Capture access/refresh token từ token endpoint
 * - onResponseBody() : Capture email từ user info API
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
  QWEN_CLI_EVENTS,
  CHAT_QWEN_HOST,
  OAUTH_PATHS,
  API_FIELDS,
  DEFAULT_EXPIRES_IN_PROXY,
} from './qwen-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenCLIProxy');

// ─── Proxy Handler ─────────────────────────────────────��──────────────

export const proxyHandler: ProxyHandler = {
  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes(CHAT_QWEN_HOST)) {
      if (url.includes(OAUTH_PATHS.TOKEN)) {
        try {
          const json = JSON.parse(body) as Record<string, unknown>;
          let tokenData: Record<string, unknown> = json;
          const rawResponse = json[API_FIELDS.RESPONSE];
          if (
            rawResponse &&
            typeof rawResponse === 'string' &&
            rawResponse.startsWith('{')
          ) {
            try {
              tokenData = JSON.parse(rawResponse) as Record<string, unknown>;
            } catch (e) {}
          }
          if (tokenData[API_FIELDS.ACCESS_TOKEN]) {
            proxyEvents.emit(QWEN_CLI_EVENTS.TOKENS, {
              cookies: JSON.stringify({
                accessToken: tokenData[API_FIELDS.ACCESS_TOKEN],
                refreshToken: tokenData[API_FIELDS.REFRESH_TOKEN] || '',
                expiresIn:
                  tokenData[API_FIELDS.EXPIRES_IN] ||
                  DEFAULT_EXPIRES_IN_PROXY,
              }),
            });
          }
        } catch (e) {
          logger.error('[Proxy] Failed to parse Qwen CLI token response:', e);
        }
      }
      if (url.includes(OAUTH_PATHS.USER) || url.includes(OAUTH_PATHS.AUTHS)) {
        try {
          const json = JSON.parse(body) as Record<string, unknown>;
          let data: Record<string, unknown> = json;
          const rawResponse = json[API_FIELDS.RESPONSE];
          if (
            rawResponse &&
            typeof rawResponse === 'string' &&
            rawResponse.startsWith('{')
          ) {
            try {
              data = JSON.parse(rawResponse) as Record<string, unknown>;
            } catch (e) {}
          }
          const nestedData = data[API_FIELDS.DATA] as
            | Record<string, unknown>
            | undefined;
          const email =
            (data[API_FIELDS.EMAIL] as string) ||
            (nestedData?.[API_FIELDS.EMAIL] as string);
          if (email) proxyEvents.emit(QWEN_CLI_EVENTS.USER_INFO, { email });
        } catch (e) {
          logger.error(
            '[Proxy] Failed to parse Qwen CLI user info response:',
            e,
          );
        }
      }
    }
  },
};