/**
 * ------------------------------------------------------------------
 * Kimi Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Kimi AI (Moonshot).
 * Hỗ trợ login qua browser, chat completion với gRPC-Web Connect,
 * thinking mode, search, và auto-refresh token.
 *
 * Main features:
 * - login()                : Đăng nhập qua browser
 * - handleMessage()        : Gửi tin nhắn với streaming response
 * - refreshAccessToken()   : Tự động refresh token khi hết hạn
 * - getModels()            : Lấy danh sách models
 * - getUserProfile()       : Lấy thông tin user profile
 * - Fallback handling      : Tự động fallback khi K3 overload
 *
 * Credential format (JSON string):
 * - accessToken         : JWT access token
 * - refreshToken        : Refresh token
 * - cookies             : Cookie string (kimi-auth=${token})
 * - deviceId            : Device ID
 * - sessionId           : Session ID
 * - trafficId (optional): Traffic ID
 * - userAgent (optional): User agent string
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Repositories ──
import { updateAccountCredential } from '../../repositories/account.repository';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import {
  isJwtExpiringSoon,
  coordinateTokenRefresh,
  DEFAULT_REFRESH_THRESHOLD_SEC,
} from '../../utils/jwt-helper';

// ── Kimi Imports ──
import {
  KimiChatRequest,
  KimiCredential,
  KimiHeadersPayload,
  KimiLoginResult,
  KimiTokenResponse,
  KimiUserResponse,
} from './kimi.types';
import {
  KIMI_BASE_URL,
  KIMI_MODELS,
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  KIMI_EVENTS,
  USER_AGENT,
  MSH_HEADERS,
  AUTH_REFRESH_URL,
  CHAT_URL,
  GET_USER_URL,
  LIST_THIRD_ACCOUNTS_URL,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  AUTH_PREFIXES,
  CREDENTIAL_KEYS,
  REGEX_PATTERNS,
  AUTH_FIELDS,
  CHAT_REQUEST_FIELDS,
  SCENARIOS,
  KIMI_CHAT_MODELS,
  REASONING_EFFORTS,
  TOOL_TYPES,
  FRAME_PROTOCOL,
  ID_PREFIXES,
  ID_RANDOM_BYTES,
  DEFAULT_EMAIL,
  DEFAULT_TIMEZONE,
  LOGIN_PARTITION_PREFIX,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
} from './kimi.constant';
import { parseKimiSSE } from './kimi.sse-parser';
import { kimiProxyHandler } from './kimi.proxy-handler';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KimiProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class KimiProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = kimiProxyHandler;

  // ─── Provider Configuration ────────────────────────────────────────
  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
  };

  // ─── Credential Parser ─────────────────────────────────────────────

  private parseCredential(credential: string): KimiCredential {
    if (!credential) return { accessToken: '' };

    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential) as KimiCredential &
          Record<string, unknown>;
        const accessToken =
          parsed[AUTH_FIELDS.ACCESS_TOKEN] ||
          parsed[AUTH_FIELDS.ACCESS_TOKEN_SNAKE] ||
          parsed[AUTH_FIELDS.TOKEN] ||
          '';
        return {
          accessToken: accessToken as string,
          refreshToken:
            (parsed[AUTH_FIELDS.REFRESH_TOKEN] as string) ||
            (parsed[AUTH_FIELDS.REFRESH_TOKEN_SNAKE] as string) ||
            '',
          cookies:
            (parsed.cookies as string) ||
            (accessToken
              ? `${CREDENTIAL_KEYS.KIMI_AUTH}=${accessToken}`
              : ''),
          deviceId:
            (parsed.deviceId as string) ||
            (parsed.device_id as string) ||
            `${ID_PREFIXES.DEVICE}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
          sessionId:
            (parsed.sessionId as string) ||
            (parsed.session_id as string) ||
            `${ID_PREFIXES.SESSION}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
          trafficId:
            (parsed.trafficId as string) ||
            (parsed.traffic_id as string) ||
            '',
          userAgent: (parsed.userAgent as string) || USER_AGENT,
        };
      } catch {
        logger.warn(
          '[Kimi] Credential is not valid JSON, falling through to raw token parsing',
        );
      }
    }

    if (credential.startsWith(AUTH_PREFIXES.JWT)) {
      return {
        accessToken: credential,
        cookies: `${CREDENTIAL_KEYS.KIMI_AUTH}=${credential}`,
        deviceId: `${ID_PREFIXES.DEVICE}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
        sessionId: `${ID_PREFIXES.SESSION}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
      };
    }

    const match =
      credential.match(REGEX_PATTERNS.KIMI_AUTH) ||
      credential.match(REGEX_PATTERNS.ACCESS_TOKEN) ||
      credential.match(REGEX_PATTERNS.TOKEN);
    const accessToken = match ? match[1] : credential;

    const refreshMatch =
      credential.match(REGEX_PATTERNS.KIMI_REFRESH) ||
      credential.match(REGEX_PATTERNS.REFRESH_TOKEN);
    const refreshToken = refreshMatch ? refreshMatch[1] : '';

    return {
      accessToken,
      refreshToken,
      cookies: credential,
      deviceId: `${ID_PREFIXES.DEVICE}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
      sessionId: `${ID_PREFIXES.SESSION}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
    };
  }

  // ─── Refresh Token ──────────────────────────────────────────────────

  private async performTokenRefresh(
    cred: KimiCredential,
    accountId?: string,
  ): Promise<string | null> {
    const tokenToUse = cred.refreshToken || cred.accessToken;
    if (!tokenToUse) return null;

    try {
      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.USER_AGENT]: cred.userAgent || USER_AGENT,
        [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
      };

      const res = await fetch(AUTH_REFRESH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          [AUTH_FIELDS.REFRESH_TOKEN]: tokenToUse,
        }),
        timeout: 10000,
      } as any);

      if (res.ok) {
        const json = (await res.json()) as KimiTokenResponse;
        const newAccessToken =
          json[AUTH_FIELDS.ACCESS_TOKEN] ||
          json[AUTH_FIELDS.ACCESS_TOKEN_SNAKE] ||
          json[AUTH_FIELDS.TOKEN] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.TOKEN] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.ACCESS_TOKEN];
        const newRefreshToken =
          json[AUTH_FIELDS.REFRESH_TOKEN] ||
          json[AUTH_FIELDS.REFRESH_TOKEN_SNAKE] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.REFRESH_TOKEN] ||
          json[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.REFRESH_TOKEN_SNAKE] ||
          cred.refreshToken;

        if (newAccessToken && typeof newAccessToken === 'string') {
          cred.accessToken = newAccessToken;
          if (newRefreshToken) cred.refreshToken = newRefreshToken;
          cred.cookies = `${CREDENTIAL_KEYS.KIMI_AUTH}=${newAccessToken}${cred.refreshToken ? `; ${CREDENTIAL_KEYS.REFRESH_TOKEN}=${cred.refreshToken}` : ''}`;

          if (accountId) {
            try {
              updateAccountCredential(accountId, cred.cookies);
            } catch (e) {
              logger.warn('[Kimi] Failed to persist refreshed credential:', e);
            }
          }
          return newAccessToken;
        }
      } else {
        const errText = await res.text();
        logger.warn(
          `[Kimi] Refresh token returned status ${res.status}: ${errText.slice(0, 300)}`,
        );
      }
    } catch (e: any) {
      logger.warn('[Kimi] Token refresh failed:', e.message);
    }
    return null;
  }

  async refreshAccessToken(
    cred: KimiCredential,
    accountId?: string,
  ): Promise<string | null> {
    const tokenToUse = cred.refreshToken || cred.accessToken;
    if (!tokenToUse) return null;

    // Use coordinated refresh to prevent duplicate refresh operations
    return coordinateTokenRefresh('kimi', tokenToUse, () =>
      this.performTokenRefresh(cred, accountId),
    );
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(
    token: string,
    extraHeaders?: Record<string, string>,
  ): Promise<{ email: string | null }> {
    try {
      let rawToken = token;
      if (token.startsWith('{')) {
        try {
          const parsed = JSON.parse(token) as KimiTokenResponse;
          rawToken =
            parsed[AUTH_FIELDS.ACCESS_TOKEN] ||
            parsed[AUTH_FIELDS.ACCESS_TOKEN_SNAKE] ||
            parsed[AUTH_FIELDS.TOKEN] ||
            token;
        } catch {
          // ignore
        }
      }
      if (rawToken.includes(`${CREDENTIAL_KEYS.KIMI_AUTH}=`)) {
        const match = rawToken.match(REGEX_PATTERNS.KIMI_AUTH);
        if (match) rawToken = match[1];
      }

      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${rawToken}`,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
        [HTTP_HEADER_NAMES.USER_AGENT]:
          extraHeaders?.[HTTP_HEADER_NAMES.USER_AGENT] || USER_AGENT,
        ...MSH_HEADERS,
      };

      if (extraHeaders?.[HTTP_HEADER_NAMES.X_MSH_DEVICE_ID])
        headers[HTTP_HEADER_NAMES.X_MSH_DEVICE_ID] =
          extraHeaders[HTTP_HEADER_NAMES.X_MSH_DEVICE_ID];
      if (extraHeaders?.[HTTP_HEADER_NAMES.X_MSH_SESSION_ID])
        headers[HTTP_HEADER_NAMES.X_MSH_SESSION_ID] =
          extraHeaders[HTTP_HEADER_NAMES.X_MSH_SESSION_ID];
      if (extraHeaders?.[HTTP_HEADER_NAMES.X_TRAFFIC_ID])
        headers[HTTP_HEADER_NAMES.X_TRAFFIC_ID] =
          extraHeaders[HTTP_HEADER_NAMES.X_TRAFFIC_ID];
      if (extraHeaders?.[HTTP_HEADER_NAMES.COOKIE])
        headers[HTTP_HEADER_NAMES.COOKIE] =
          extraHeaders[HTTP_HEADER_NAMES.COOKIE];

      const res = await fetch(GET_USER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        timeout: 5000,
      } as any);

      if (res.ok) {
        const json = (await res.json()) as KimiUserResponse;
        if (
          json[AUTH_FIELDS.USER] &&
          (json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.ID] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NICKNAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NAME])
        ) {
          let email: string | null = null;

          try {
            const thirdRes = await fetch(LIST_THIRD_ACCOUNTS_URL, {
              method: 'POST',
              headers,
              body: JSON.stringify({}),
              timeout: 3000,
            } as any);
            if (thirdRes.ok) {
              const thirdJson = (await thirdRes.json()) as KimiTokenResponse;
              if (thirdJson[AUTH_FIELDS.EMAIL]) {
                email = thirdJson[AUTH_FIELDS.EMAIL] ?? null;
              }
            }
          } catch {
            // ignore
          }

          return { email };
        }
        logger.warn('[Kimi] Get Profile response missing user data');
      } else {
        logger.warn(`[Kimi] Get Profile returned status ${res.status}`);
      }
    } catch (e) {
      logger.error('[Kimi] Get Profile Error:', e);
    }
    return { email: null };
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { method?: string }): Promise<KimiLoginResult> {
    let capturedHeaders: KimiHeadersPayload = {};
    const onHeaders = (headers: KimiHeadersPayload) => {
      capturedHeaders = { ...capturedHeaders, ...headers };
    };

    proxyEvents.on(KIMI_EVENTS.HEADERS, onHeaders);

    try {
      const res = await loginService.captureCredentialsViaCDP({
        providerId: PROVIDER_ID,
        loginUrl: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
        partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
        cookieEvent: KIMI_EVENTS.LOGIN_TOKEN,
        infoEvent: KIMI_EVENTS.LOGIN_EMAIL,
        extraEvents: [KIMI_EVENTS.HEADERS],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          let token = data.cookies;
          if (token.startsWith('{')) {
            try {
              const parsed = JSON.parse(token) as KimiTokenResponse;
              token =
                parsed[AUTH_FIELDS.ACCESS_TOKEN] ||
                parsed[AUTH_FIELDS.ACCESS_TOKEN_SNAKE] ||
                parsed[AUTH_FIELDS.TOKEN] ||
                token;
            } catch {
              // ignore
            }
          }

          if (token.includes(`${CREDENTIAL_KEYS.KIMI_AUTH}=`)) {
            const match = token.match(REGEX_PATTERNS.KIMI_AUTH);
            if (match) token = match[1];
          }

          if (!token || !token.startsWith(AUTH_PREFIXES.JWT)) {
            logger.warn('[Kimi] Login validation failed: invalid token format');
            return { isValid: false };
          }

          const refreshToken =
            (data as any)[AUTH_FIELDS.REFRESH_TOKEN] ||
            (data as any)[AUTH_FIELDS.REFRESH_TOKEN_SNAKE] ||
            '';

          const profile = await this.getUserProfile(token, capturedHeaders);
          if (!profile.email) {
            logger.warn(
              '[Kimi] Login validation failed: could not fetch user profile',
            );
            return { isValid: false };
          }

          if (!refreshToken) {
            logger.warn(
              '[Kimi] Login validation failed: missing refresh token',
            );
            return { isValid: false };
          }

          const userIdentifier =
            profile.email || data.email || DEFAULT_EMAIL;

          const cookieString = `${CREDENTIAL_KEYS.KIMI_AUTH}=${token}${refreshToken ? `; ${CREDENTIAL_KEYS.REFRESH_TOKEN}=${refreshToken}` : ''}`;
          const credObj: KimiCredential = {
            accessToken: token,
            refreshToken,
            cookies: cookieString,
            deviceId:
              capturedHeaders[HTTP_HEADER_NAMES.X_MSH_DEVICE_ID] ||
              `${ID_PREFIXES.DEVICE}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
            sessionId:
              capturedHeaders[HTTP_HEADER_NAMES.X_MSH_SESSION_ID] ||
              `${ID_PREFIXES.SESSION}${crypto.randomBytes(ID_RANDOM_BYTES).toString('hex')}`,
            trafficId: capturedHeaders[HTTP_HEADER_NAMES.X_TRAFFIC_ID] || '',
            userAgent:
              capturedHeaders[HTTP_HEADER_NAMES.USER_AGENT] || USER_AGENT,
          };

          return {
            isValid: true,
            email: userIdentifier,
            cookies: cookieString,
            headers: capturedHeaders,
          };
        },
      });

      return {
        email: res.email || DEFAULT_EMAIL,
        cookies: res.cookies || '',
        headers: res.headers,
      };
    } finally {
      proxyEvents.off(KIMI_EVENTS.HEADERS, onHeaders);
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      conversationId,
      thinking = false,
      search = false,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
      onSessionCreated,
    } = options;

    const cred = this.parseCredential(credential);
    if (!cred.accessToken) {
      onError(new Error('Kimi token missing. Please login first.'));
      return;
    }

    let cleanModel = model.toLowerCase();
    if (cleanModel.includes('/')) {
      cleanModel = cleanModel.split('/').pop() || cleanModel;
    }

    let isThinkingModel = thinking === true;
    let scenario: string = SCENARIOS.K2D5;
    let kimiModelName: string = KIMI_CHAT_MODELS.K2D6_CHAT;

    if (cleanModel === 'instant' || cleanModel === 'k2d6') {
      scenario = SCENARIOS.K2D5;
      isThinkingModel = false;
      kimiModelName = KIMI_CHAT_MODELS.K2D6_CHAT;
    } else if (
      cleanModel === 'k2d6-thinking' ||
      cleanModel.includes('thinking')
    ) {
      scenario = SCENARIOS.K2D5;
      isThinkingModel = true;
      kimiModelName = KIMI_CHAT_MODELS.K2D6_CHAT;
    } else if (
      cleanModel === 'k3' ||
      cleanModel === 'k3-swarm' ||
      cleanModel.includes('agent') ||
      cleanModel.includes('swarm')
    ) {
      scenario = SCENARIOS.OK_COMPUTER;
      isThinkingModel = true;
    }

    const lastMsg = messages[messages.length - 1];
    const promptText =
      typeof lastMsg?.[CHAT_REQUEST_FIELDS.CONTENT] === 'string'
        ? lastMsg[CHAT_REQUEST_FIELDS.CONTENT]
        : JSON.stringify(lastMsg?.[CHAT_REQUEST_FIELDS.CONTENT] || '');

    const payload: KimiChatRequest = {
      [CHAT_REQUEST_FIELDS.SCENARIO]: scenario,
      [CHAT_REQUEST_FIELDS.OPTIONS]: {
        [CHAT_REQUEST_FIELDS.THINKING]: isThinkingModel,
        [CHAT_REQUEST_FIELDS.ENABLE_PLUGIN]: search,
        [CHAT_REQUEST_FIELDS.REASONING_EFFORT]: isThinkingModel
          ? REASONING_EFFORTS.HIGH
          : REASONING_EFFORTS.LOW,
      },
      [CHAT_REQUEST_FIELDS.MESSAGE]: {
        [CHAT_REQUEST_FIELDS.ROLE]: 'user',
        [CHAT_REQUEST_FIELDS.BLOCKS]: [
          {
            [CHAT_REQUEST_FIELDS.TEXT]: {
              [CHAT_REQUEST_FIELDS.CONTENT]: promptText,
            },
          },
        ],
      },
    };

    if (scenario === SCENARIOS.K2D5) {
      payload[CHAT_REQUEST_FIELDS.OPTIONS]![CHAT_REQUEST_FIELDS.MODEL] =
        kimiModelName;
    } else if (scenario === SCENARIOS.OK_COMPUTER) {
      payload[CHAT_REQUEST_FIELDS.KIMIPLUS_ID] = KIMI_CHAT_MODELS.OK_COMPUTER;
    }

    if (conversationId && !conversationId.startsWith(ID_PREFIXES.TEMP_CHAT)) {
      payload[CHAT_REQUEST_FIELDS.CHAT_ID] = conversationId;
    }

    if (search) {
      payload[CHAT_REQUEST_FIELDS.TOOLS] = [
        {
          [CHAT_REQUEST_FIELDS.TYPE]: TOOL_TYPES.SEARCH,
          [CHAT_REQUEST_FIELDS.SEARCH]: {},
        },
      ];
    }

    const bodyWithEnvelope = this.encodeConnectFrame(payload);

    let activeToken = cred.accessToken;

    // Check if token is expiring soon (within 5 minutes by default)
    if (isJwtExpiringSoon(cred.accessToken, DEFAULT_REFRESH_THRESHOLD_SEC)) {
      const refreshed = await this.refreshAccessToken(cred, options.accountId);
      if (refreshed) {
        activeToken = refreshed;
      } else {
        logger.warn(
          '[Kimi] Token refresh failed, proceeding with current token',
        );
      }
    }

    const headers: Record<string, string> = {
      [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${activeToken}`,
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.CONNECT_JSON,
      [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.CONNECT_JSON,
      [HTTP_HEADER_NAMES.CONNECT_PROTOCOL_VERSION]: '1',
      [HTTP_HEADER_NAMES.USER_AGENT]: cred.userAgent || USER_AGENT,
      [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
      [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
      ...MSH_HEADERS,
      [HTTP_HEADER_NAMES.R_TIMEZONE]: DEFAULT_TIMEZONE,
    };

    if (cred.sessionId)
      headers[HTTP_HEADER_NAMES.X_MSH_SESSION_ID] = cred.sessionId;
    if (cred.deviceId)
      headers[HTTP_HEADER_NAMES.X_MSH_DEVICE_ID] = cred.deviceId;
    if (cred.trafficId)
      headers[HTTP_HEADER_NAMES.X_TRAFFIC_ID] = cred.trafficId;
    if (cred.cookies) headers[HTTP_HEADER_NAMES.COOKIE] = cred.cookies;

    try {
      let response = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: bodyWithEnvelope,
        timeout: 120000,
      } as any);

      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken(
          cred,
          options.accountId,
        );
        if (refreshed) {
          activeToken = refreshed;
          headers[HTTP_HEADER_NAMES.AUTHORIZATION] = `${AUTH_PREFIXES.BEARER}${activeToken}`;
          if (cred.cookies)
            headers[HTTP_HEADER_NAMES.COOKIE] = cred.cookies;

          response = await fetch(CHAT_URL, {
            method: 'POST',
            headers,
            body: bodyWithEnvelope,
            timeout: 120000,
          } as any);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Kimi API Error ${response.status}: ${errorText.slice(0, 500)}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body from Kimi API');
      }

      let result = await parseKimiSSE(response.body as any, {
        onContent,
        onThinking,
        onMetadata,
        onRaw,
        conversationId,
      });

      // Fallback khi OK_COMPUTER overloaded
      if (
        !result.accumulatedContent &&
        result.error &&
        scenario === SCENARIOS.OK_COMPUTER
      ) {
        logger.warn(
          `[Kimi] OK_COMPUTER overloaded (${result.error}). Falling back to SCENARIO_K2D5.`,
        );
        payload[CHAT_REQUEST_FIELDS.SCENARIO] = SCENARIOS.K2D5;
        payload[CHAT_REQUEST_FIELDS.OPTIONS]![CHAT_REQUEST_FIELDS.MODEL] =
          KIMI_CHAT_MODELS.K2D6_CHAT;
        delete payload[CHAT_REQUEST_FIELDS.KIMIPLUS_ID];

        const fallbackBody = this.encodeConnectFrame(payload);

        const retryResponse = await fetch(CHAT_URL, {
          method: 'POST',
          headers,
          body: fallbackBody,
          timeout: 120000,
        } as any);

        if (retryResponse.ok && retryResponse.body) {
          result = await parseKimiSSE(retryResponse.body as any, {
            onContent,
            onThinking,
            onMetadata,
            onRaw,
            conversationId,
          });
        }
      }

      if (result.error && !result.accumulatedContent) {
        throw new Error(result.error);
      }

      if (result.conversationId && onSessionCreated) {
        onSessionCreated(result.conversationId);
      }

      onDone();
    } catch (err: any) {
      logger.error('[Kimi] handleMessage error:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string, accountId?: string): Promise<any[]> {
    return [
      {
        id: KIMI_MODELS.K3,
        name: 'Kimi K3 (Flagship)',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Chat & Agent, flagship all-rounder with deep reasoning',
      },
      {
        id: KIMI_MODELS.K3_SWARM,
        name: 'Kimi K3 Swarm',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description:
          'Massive search, batch processing, and multi-agent workflow',
      },
      {
        id: KIMI_MODELS.INSTANT,
        name: 'Kimi Instant',
        is_thinking: false,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Fast chat, quick replies for everyday tasks',
      },
      {
        id: KIMI_MODELS.K2D6_THINKING,
        name: 'Kimi K2.6 Thinking',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Deep reasoning for complex logic, math, and code',
      },
      {
        id: KIMI_MODELS.K2D6,
        name: 'Kimi K2.6 Instant',
        is_thinking: false,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Ultra-fast responses for everyday chat',
      },
      {
        id: KIMI_MODELS.K2D6_AGENT,
        name: 'Kimi K2.6 Agent',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Autonomous agent for deep research and documents',
      },
      {
        id: KIMI_MODELS.K2D6_AGENT_ULTRA,
        name: 'Kimi K2.6 Agent Swarm',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Multi-agent swarm for massive batch research',
      },
    ];
  }

  // ─── Frame Encoding ─────────────────────────────────────────────────

  /**
   * Đóng gói payload thành gRPC-Web Connect frame:
   * 5-byte header (1 byte flags + 4 bytes big-endian length) + JSON body.
   */
  private encodeConnectFrame(payload: KimiChatRequest): Buffer {
    const jsonBuf = Buffer.from(
      JSON.stringify(payload),
      FRAME_PROTOCOL.ENCODING,
    );
    const envelopeHeader = Buffer.alloc(FRAME_PROTOCOL.HEADER_SIZE);
    envelopeHeader.writeUInt8(
      FRAME_PROTOCOL.FLAG_BYTE_VALUE,
      FRAME_PROTOCOL.FLAG_BYTE_OFFSET,
    );
    envelopeHeader.writeUInt32BE(jsonBuf.length, FRAME_PROTOCOL.LENGTH_OFFSET);
    return Buffer.concat([envelopeHeader, jsonBuf]);
  }
}

export default new KimiProvider();