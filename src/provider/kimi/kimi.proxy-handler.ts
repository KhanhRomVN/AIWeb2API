/**
 * ------------------------------------------------------------------
 * Kimi Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture token, refresh token, và user info từ Kimi.
 * Lắng nghe JWT token từ Authorization header, cookie, và API response.
 *
 * Main features:
 * - onRequest()       : Capture token từ header/cookie, extract email từ JWT
 * - onResponseBody()  : Capture token từ API response body
 * - onResponse()      : Capture Google OAuth redirect
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler, proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  KimiHeadersPayload,
  KimiLoginTokenPayload,
  KimiTokenResponse,
} from './kimi.types';

// ── Constants ──
import {
  KIMI_EVENTS,
  HOSTS,
  HTTP_HEADER_NAMES,
  HTTP_HEADER_NAMES_LOWERCASE,
  AUTH_PREFIXES,
  CREDENTIAL_KEYS,
  REGEX_PATTERNS,
  JWT_PAYLOAD_FIELDS,
  AUTH_FIELDS,
  URL_PATTERNS,
  ENCODINGS,
  ID_PREFIXES,
  JWT_SUB_PREFIX_LENGTH,
  DEFAULT_EMAIL,
} from './kimi.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KimiProxyHandler');

// ─── Helpers ────────────────────────────────────────────────────────────

function extractInfoFromJwt(token: string): {
  email?: string;
  name?: string;
  sub?: string;
} {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1], ENCODINGS.BASE64URL).toString(ENCODINGS.UTF8),
      );
      return {
        email: payload[JWT_PAYLOAD_FIELDS.EMAIL],
        name:
          payload[JWT_PAYLOAD_FIELDS.NAME] ||
          payload[JWT_PAYLOAD_FIELDS.NICKNAME],
        sub:
          payload[JWT_PAYLOAD_FIELDS.SUB] ||
          payload[JWT_PAYLOAD_FIELDS.ABSTRACT_USER_ID] ||
          payload[JWT_PAYLOAD_FIELDS.ID],
      };
    }
  } catch {
    logger.warn('[Proxy] Failed to extract JWT info');
  }
  return {};
}

// ─── Proxy Handler ────────────────────────────────────────────────────

export const kimiProxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest?.headers?.host || '';
    const url = ctx.clientToProxyRequest?.url || '';

    if (
      host.includes(HOSTS.KIMI_AI) ||
      host.includes(HOSTS.KIMI_COM) ||
      host.includes(HOSTS.MOONSHOT_CN) ||
      host.includes(HOSTS.AUTH_KIMI)
    ) {
      const headers = ctx.clientToProxyRequest.headers;
      const auth =
        headers[HTTP_HEADER_NAMES_LOWERCASE.AUTHORIZATION] ||
        headers[HTTP_HEADER_NAMES.AUTHORIZATION];
      const cookie =
        headers[HTTP_HEADER_NAMES_LOWERCASE.COOKIE] ||
        headers[HTTP_HEADER_NAMES.COOKIE] ||
        '';

      let capturedToken = '';
      let capturedRefreshToken = '';

      if (
        auth &&
        typeof auth === 'string' &&
        auth.startsWith(AUTH_PREFIXES.BEARER)
      ) {
        capturedToken = auth.slice(AUTH_PREFIXES.BEARER.length).trim();
      }

      if (!capturedToken && cookie.includes(`${CREDENTIAL_KEYS.KIMI_AUTH}=`)) {
        const match = cookie.match(REGEX_PATTERNS.KIMI_AUTH);
        if (match && match[1]) capturedToken = match[1];
      }

      if (!capturedToken && cookie.includes(`${CREDENTIAL_KEYS.TOKEN}=`)) {
        const match = cookie.match(REGEX_PATTERNS.TOKEN);
        if (match && match[1] && match[1].startsWith(AUTH_PREFIXES.JWT))
          capturedToken = match[1];
      }

      if (cookie.includes(`${CREDENTIAL_KEYS.KIMI_REFRESH}=`)) {
        const match = cookie.match(REGEX_PATTERNS.KIMI_REFRESH);
        if (match && match[1]) capturedRefreshToken = match[1];
      } else if (cookie.includes(`${CREDENTIAL_KEYS.REFRESH_TOKEN}=`)) {
        const match = cookie.match(REGEX_PATTERNS.REFRESH_TOKEN);
        if (match && match[1]) capturedRefreshToken = match[1];
      }

      const deviceId = headers[HTTP_HEADER_NAMES.X_MSH_DEVICE_ID];
      const sessionId = headers[HTTP_HEADER_NAMES.X_MSH_SESSION_ID];
      const trafficId = headers[HTTP_HEADER_NAMES.X_TRAFFIC_ID];
      const userAgent =
        headers[HTTP_HEADER_NAMES_LOWERCASE.USER_AGENT] ||
        headers[HTTP_HEADER_NAMES.USER_AGENT];

      const headerPayload: KimiHeadersPayload = {};
      if (deviceId)
        headerPayload[HTTP_HEADER_NAMES.X_MSH_DEVICE_ID] = String(deviceId);
      if (sessionId)
        headerPayload[HTTP_HEADER_NAMES.X_MSH_SESSION_ID] = String(sessionId);
      if (trafficId)
        headerPayload[HTTP_HEADER_NAMES.X_TRAFFIC_ID] = String(trafficId);
      if (userAgent)
        headerPayload[HTTP_HEADER_NAMES.USER_AGENT] = String(userAgent);
      if (cookie) headerPayload[HTTP_HEADER_NAMES.COOKIE] = String(cookie);

      proxyEvents.emit(KIMI_EVENTS.HEADERS, headerPayload);

      if (capturedToken && capturedToken.startsWith(AUTH_PREFIXES.JWT)) {
        const jwtInfo = extractInfoFromJwt(capturedToken);
        const email =
          jwtInfo.email ||
          jwtInfo.name ||
          (jwtInfo.sub
            ? `${ID_PREFIXES.USER}${jwtInfo.sub.slice(0, JWT_SUB_PREFIX_LENGTH)}`
            : DEFAULT_EMAIL);

        proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email });

        const tokenPayload: KimiLoginTokenPayload = {
          [AUTH_FIELDS.TOKEN]: capturedToken,
          cookies: capturedToken,
          [AUTH_FIELDS.EMAIL]: email,
          headers: headerPayload,
        };
        if (capturedRefreshToken) {
          tokenPayload[AUTH_FIELDS.REFRESH_TOKEN] = capturedRefreshToken;
          tokenPayload.cookies = `${CREDENTIAL_KEYS.KIMI_AUTH}=${capturedToken}; ${CREDENTIAL_KEYS.REFRESH_TOKEN}=${capturedRefreshToken}`;
        }
        proxyEvents.emit(KIMI_EVENTS.LOGIN_TOKEN, tokenPayload);
      }
    }

    if (
      url.includes(URL_PATTERNS.GOOGLE_CALLBACK) &&
      url.includes(URL_PATTERNS.ID_TOKEN_PARAM)
    ) {
      const match = url.match(REGEX_PATTERNS.ID_TOKEN_NO_HASH);
      if (match && match[1]) {
        const idToken = decodeURIComponent(match[1]);
        const jwtInfo = extractInfoFromJwt(idToken);
        if (jwtInfo.email) {
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email: jwtInfo.email });
        }
      }
    }

    callback();
  },

  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    callback(null, chunk);
  },

  onResponse: (ctx: any, callback: () => void) => {
    const location = ctx.serverToProxyResponse?.headers?.location || '';
    if (location && location.includes(URL_PATTERNS.ID_TOKEN_PARAM)) {
      const match = location.match(REGEX_PATTERNS.ID_TOKEN);
      if (match && match[1]) {
        const idToken = decodeURIComponent(match[1]);
        const jwtInfo = extractInfoFromJwt(idToken);
        if (jwtInfo.email) {
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email: jwtInfo.email });
        }
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest?.headers?.host || '';
    const url = ctx.clientToProxyRequest?.url || '';

    if (
      host.includes(HOSTS.KIMI_AI) ||
      host.includes(HOSTS.KIMI_COM) ||
      host.includes(HOSTS.MOONSHOT_CN) ||
      host.includes(HOSTS.AUTH_KIMI)
    ) {
      try {
        const json = JSON.parse(body) as KimiTokenResponse;

        const token =
          json[AUTH_FIELDS.ACCESS_TOKEN] ||
          json[AUTH_FIELDS.ACCESS_TOKEN_SNAKE] ||
          json[AUTH_FIELDS.TOKEN] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.TOKEN] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.ACCESS_TOKEN_SNAKE] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.ACCESS_TOKEN];
        const refreshToken =
          json[AUTH_FIELDS.REFRESH_TOKEN] ||
          json[AUTH_FIELDS.REFRESH_TOKEN_SNAKE] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.REFRESH_TOKEN] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.REFRESH_TOKEN_SNAKE] ||
          json[AUTH_FIELDS.REFRESH_TOKEN];
        if (
          token &&
          typeof token === 'string' &&
          token.startsWith(AUTH_PREFIXES.JWT)
        ) {
          const jwtInfo = extractInfoFromJwt(token);
          const email =
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.EMAIL] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NICKNAME] ||
            json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.EMAIL] ||
            json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.NAME] ||
            jwtInfo.email ||
            jwtInfo.name ||
            DEFAULT_EMAIL;

          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email });
          const tokenPayload: KimiLoginTokenPayload = {
            [AUTH_FIELDS.TOKEN]: token,
            cookies: `${CREDENTIAL_KEYS.KIMI_AUTH}=${token}${refreshToken ? `; ${CREDENTIAL_KEYS.REFRESH_TOKEN}=${refreshToken}` : ''}`,
            [AUTH_FIELDS.EMAIL]: email,
          };
          if (refreshToken) {
            tokenPayload[AUTH_FIELDS.REFRESH_TOKEN] = refreshToken;
          }
          proxyEvents.emit(KIMI_EVENTS.LOGIN_TOKEN, tokenPayload);
        }

        if (
          json[AUTH_FIELDS.USER] &&
          (json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NICKNAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.EMAIL])
        ) {
          const name =
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NICKNAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.EMAIL];
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email: name });
        }

        if (json[AUTH_FIELDS.EMAIL] && json[AUTH_FIELDS.THIRD_PARTY]) {
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, {
            email: json[AUTH_FIELDS.EMAIL],
          });
        }
      } catch {
        logger.warn('[Proxy] Kimi response body is not JSON');
      }
    }
  },
};

export default kimiProxyHandler;