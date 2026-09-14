/**
 * ------------------------------------------------------------------
 * DeepSeek Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies, token, và user info từ DeepSeek.
 * Lắng nghe Authorization header, login email, login token,
 * và user info từ API.
 *
 * Main features:
 * - onRequest()       : Capture Authorization header
 * - onRequestData()   : Capture login email từ request body
 * - onResponseBody()  : Capture login token và user info từ response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  DeepSeekApiEnvelope,
  DeepSeekUserInfo,
} from './deepseek.types';

// ── Constants ──
import {
  DEEPSEEK_EVENTS,
  API_PATHS,
  DEEPSEEK_HOST,
  GOOGLE_ACCOUNTS_HOST,
  GOOGLE_OAUTH_ID_PATH,
  GOOGLE_OAUTH_EMAIL_REGEX,
  HTTP_HEADER_NAMES_LOWERCASE,
  REGEX_PATTERNS,
  MASKED_EMAIL_INDICATOR,
  API_FIELDS,
  SUCCESS_CODE,
} from './deepseek.constant';

// ─── Types ──────────────────────────────────────────────────────────────

/** Request body gửi lên /users/login (một số trường hợp bọc trong `request` string). */
interface LoginRequestBody {
  request?: string;
  email?: string;
}

/** Payload gửi qua proxyEvents khi capture được token. */
interface LoginTokenPayload {
  cookies: string;
  email?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes(DEEPSEEK_HOST)) {
      const auth =
        ctx.clientToProxyRequest.headers[
          HTTP_HEADER_NAMES_LOWERCASE.AUTHORIZATION
        ];

      if (auth) {
        proxyEvents.emit(DEEPSEEK_EVENTS.AUTH_HEADER, auth);
      }
    }
    callback();
  },

  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes(DEEPSEEK_HOST) &&
      url.includes(API_PATHS.USERS_LOGIN)
    ) {
      const bodyStr = chunk.toString();
      try {
        const outerJson = JSON.parse(bodyStr) as LoginRequestBody;
        let foundEmail: string | null = null;
        const requestStr = outerJson[API_FIELDS.REQUEST];
        if (requestStr) {
          const innerJson = JSON.parse(requestStr) as LoginRequestBody;
          if (innerJson[API_FIELDS.EMAIL]) {
            foundEmail = innerJson[API_FIELDS.EMAIL] ?? null;
          }
        } else if (outerJson[API_FIELDS.EMAIL]) {
          foundEmail = outerJson[API_FIELDS.EMAIL] ?? null;
        }

        if (foundEmail) {
          (ctx as any).capturedUnmaskedEmail = foundEmail;
          proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, { email: foundEmail });
        }
      } catch {
        const emailMatch = bodyStr.match(REGEX_PATTERNS.EMAIL_IN_BODY);
        if (emailMatch && emailMatch[0]) {
          const email = `${emailMatch[1]}@${emailMatch[2]}`.replace(/\\/g, '');
          if (!email.includes(MASKED_EMAIL_INDICATOR)) {
            (ctx as any).capturedUnmaskedEmail = email;
            proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, { email });
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
      host.includes(DEEPSEEK_HOST) &&
      url.includes(API_PATHS.USERS_LOGIN)
    ) {
      try {
        const json = JSON.parse(body) as DeepSeekApiEnvelope<{
          user?: DeepSeekUserInfo;
        }> & { response?: string };
        let userData: DeepSeekUserInfo | undefined;

        if (
          json[API_FIELDS.RESPONSE] &&
          typeof json[API_FIELDS.RESPONSE] === 'string'
        ) {
          const innerResponse = JSON.parse(
            json[API_FIELDS.RESPONSE] as string,
          ) as DeepSeekApiEnvelope<{ user?: DeepSeekUserInfo }>;
          userData =
            innerResponse?.[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
              API_FIELDS.USER
            ];
        } else if (
          json[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[API_FIELDS.USER]
        ) {
          userData =
            json[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[API_FIELDS.USER];
        } else if (
          json[API_FIELDS.CODE] === SUCCESS_CODE &&
          json[API_FIELDS.DATA]
        ) {
          userData = json[API_FIELDS.DATA] as unknown as DeepSeekUserInfo;
        }

        if (userData && userData[API_FIELDS.TOKEN]) {
          const eventPayload: LoginTokenPayload = {
            cookies: userData[API_FIELDS.TOKEN],
          };
          const capturedEmail = (ctx as any).capturedUnmaskedEmail as
            | string
            | undefined;
          let bestEmail = capturedEmail || userData[API_FIELDS.EMAIL];

          if (
            bestEmail?.includes(MASKED_EMAIL_INDICATOR) &&
            capturedEmail
          ) {
            bestEmail = capturedEmail;
          }

          if (bestEmail) {
            eventPayload.email = bestEmail;
            proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, {
              email: bestEmail,
            });
          }
          proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_TOKEN, eventPayload);
          delete (ctx as any).capturedUnmaskedEmail;
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse DeepSeek Login Response:', {
          error: e,
          body: body.slice(0, 500),
          url: url,
        });
      }
    }

    if (
      host &&
      host.includes(GOOGLE_ACCOUNTS_HOST) &&
      url.includes(GOOGLE_OAUTH_ID_PATH)
    ) {
      const emailMatch = body.match(GOOGLE_OAUTH_EMAIL_REGEX);
      if (
        emailMatch &&
        emailMatch[1] &&
        !emailMatch[1].includes(MASKED_EMAIL_INDICATOR)
      ) {
        (ctx as any).capturedUnmaskedEmail = emailMatch[1];
        proxyEvents.emit(DEEPSEEK_EVENTS.GOOGLE_EMAIL, {
          email: emailMatch[1],
        });
      }
    }

    if (
      host &&
      host.includes(DEEPSEEK_HOST) &&
      url.includes(API_PATHS.USERS_CURRENT)
    ) {
      try {
        const userInfo = JSON.parse(body) as DeepSeekApiEnvelope<
          DeepSeekUserInfo & { biz_data?: DeepSeekUserInfo }
        >;
        if (
          userInfo[API_FIELDS.CODE] === SUCCESS_CODE &&
          userInfo[API_FIELDS.DATA]
        ) {
          proxyEvents.emit(
            DEEPSEEK_EVENTS.USER_INFO,
            userInfo[API_FIELDS.DATA],
          );
          const bizData = userInfo[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA];
          if (bizData) {
            if (bizData[API_FIELDS.TOKEN]) {
              const eventPayload: LoginTokenPayload = {
                cookies: bizData[API_FIELDS.TOKEN],
              };
              const capturedEmail = (ctx as any).capturedUnmaskedEmail as
                | string
                | undefined;
              let bestEmail = capturedEmail || bizData[API_FIELDS.EMAIL];
              if (
                bestEmail?.includes(MASKED_EMAIL_INDICATOR) &&
                capturedEmail
              ) {
                bestEmail = capturedEmail;
              }
              if (bestEmail) {
                eventPayload.email = bestEmail;
              }
              proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_TOKEN, eventPayload);
            }
            if (bizData[API_FIELDS.EMAIL]) {
              proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, {
                email: bizData[API_FIELDS.EMAIL],
              });
            }
          }
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse DeepSeek User Info:', {
          error: e,
          body: body.slice(0, 500),
          url: url,
        });
      }
    }
  },
};