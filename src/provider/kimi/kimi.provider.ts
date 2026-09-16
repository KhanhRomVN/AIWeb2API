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
 * - refreshToken()   : Tự động refresh token khi hết hạn
 * - getModels()            : Lấy danh sách models
 * - getUserProfile()       : Lấy thông tin user profile
 * - Fallback handling      : Tự động fallback khi K3 overload
 *
 * Credential format (JSON string):
 * - accessToken         : JWT access token
 * - refreshToken        : Refresh token (optional, cho auto-refresh)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
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
  KimiChatBlock,
  KimiCredential,
  KimiHeadersPayload,
  KimiLoginResult,
  KimiTokenResponse,
  KimiUserResponse,
  KimiAvailableModel,
  KimiAvailableModelsResponse,
} from './kimi.types';
import {
  KIMI_BASE_URL,
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
  GET_AVAILABLE_MODELS_URL,
  GET_SUBSCRIPTION_STATS_URL,
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
  DEFAULT_EMAIL,
  DEFAULT_TIMEZONE,
  LOGIN_PARTITION_PREFIX,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  FILE_PROCESS_STATUS,
} from './kimi.constant';
import { parseKimiSSE } from './kimi.sse-parser';
import { kimiProxyHandler } from './kimi.proxy-handler';
import { kimiUploadFile } from './kimi.upload';

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

  // ─── Credential Helpers ─────────────────────────────────────────────

  /**
   * Serialize KimiCredential thành JSON string để lưu vào DB.
   * Chỉ include các field có giá trị (loại bỏ undefined/empty).
   */
  private credentialToJson(cred: KimiCredential): string {
    const obj: Record<string, string> = {
      accessToken: cred.accessToken,
    };
    if (cred.refreshToken) obj.refreshToken = cred.refreshToken;
    return JSON.stringify(obj);
  }

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
        };
      } catch {
        logger.warn(
          '[Kimi] Credential is not valid JSON, falling through to raw token parsing',
        );
      }
    }

    // raw JWT
    if (credential.startsWith(AUTH_PREFIXES.JWT)) {
      return { accessToken: credential };
    }

    // cookie string — extract kimi-auth token
    const match =
      credential.match(REGEX_PATTERNS.KIMI_AUTH) ||
      credential.match(REGEX_PATTERNS.ACCESS_TOKEN) ||
      credential.match(REGEX_PATTERNS.TOKEN);
    const accessToken = match ? match[1] : credential;

    const refreshMatch =
      credential.match(REGEX_PATTERNS.KIMI_REFRESH) ||
      credential.match(REGEX_PATTERNS.REFRESH_TOKEN);
    const refreshToken = refreshMatch ? refreshMatch[1] : '';

    return { accessToken, refreshToken };
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
        [HTTP_HEADER_NAMES.CONNECT_PROTOCOL_VERSION]: '1',
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
        ...MSH_HEADERS,
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

          if (accountId) {
            try {
              updateAccountCredential(accountId, this.credentialToJson(cred));
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

  async refreshCredential(
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

  // Provider interface: refreshToken(refreshToken: string) — wraps refreshCredential
  async refreshToken(refreshToken: string): Promise<string | null> {
    const cred: KimiCredential = { accessToken: refreshToken, refreshToken };
    return this.refreshCredential(cred);
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
        [HTTP_HEADER_NAMES.CONNECT_PROTOCOL_VERSION]: '1',
        [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
        [HTTP_HEADER_NAMES.USER_AGENT]:
          extraHeaders?.[HTTP_HEADER_NAMES.USER_AGENT] || USER_AGENT,
        ...MSH_HEADERS,
        [HTTP_HEADER_NAMES.R_TIMEZONE]: DEFAULT_TIMEZONE,
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
          const identifier =
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NICKNAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.NAME] ||
            json[AUTH_FIELDS.USER]?.[AUTH_FIELDS.ID] ||
            null;

          return { email: identifier };
        }
        logger.warn('[Kimi] Get Profile response missing user data');
      } else {
        logger.warn(`[Kimi] Get Profile returned status ${res.status}`);
        const errText = await res.text().catch(() => '');
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
          if (!data.cookies) {
            logger.warn('[Kimi] Login validate: no cookies received');
            return { isValid: false };
          }

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
            if (match) {
              token = match[1];
            }
          }

          if (!token || !token.startsWith(AUTH_PREFIXES.JWT)) {
            logger.warn(
              '[Kimi] Login validation failed: invalid token format',
              {
                tokenPrefix: token?.slice(0, 20) || '(empty)',
              },
            );
            return { isValid: false };
          }

          const refreshToken =
            (data as any)[AUTH_FIELDS.REFRESH_TOKEN] ||
            (data as any)[AUTH_FIELDS.REFRESH_TOKEN_SNAKE] ||
            '';

          if (!refreshToken) {
            logger.warn(
              '[Kimi] Login warning: missing refresh token — token auto-refresh will not work',
            );
          }

          const profile = await this.getUserProfile(token, capturedHeaders);
          if (!profile.email) {
            logger.warn(
              '[Kimi] Login validation failed: could not fetch user profile',
            );
            return { isValid: false };
          }

          const userIdentifier = profile.email || data.email || DEFAULT_EMAIL;
          const credObj: Record<string, string> = { accessToken: token };
          if (refreshToken) credObj.refreshToken = refreshToken;

          return {
            isValid: true,
            email: userIdentifier,
            cookies: JSON.stringify(credObj),
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
      ref_file_ids,
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

    // Map model ID → scenario + reasoning effort
    // Kimi always sends thinking: true in the request body.
    // Thinking is controlled via reasoning_effort:
    //   - REASONING_EFFORT_NONE  → thinking effectively disabled
    //   - REASONING_EFFORT_LOW   → thinking on (light)
    //   - REASONING_EFFORT_HIGH  → thinking on (default for K3/K2.8)
    // The `thinking` option from the caller toggles between NONE and the model default.
    let scenario: string = SCENARIOS.CHAT;
    let kimiModelId: string | undefined;
    let defaultReasoningEffort: string = REASONING_EFFORTS.LOW;

    if (cleanModel === 'k3-agent-swarm' || cleanModel === 'k3-swarm') {
      scenario = SCENARIOS.OK_COMPUTER_SWARM;
      defaultReasoningEffort = REASONING_EFFORTS.HIGH;
    } else if (
      cleanModel === 'k3-agent' ||
      cleanModel === 'k3' ||
      cleanModel === 'k28-agent-preview' ||
      cleanModel === 'k28'
    ) {
      scenario = SCENARIOS.OK_COMPUTER;
      defaultReasoningEffort = REASONING_EFFORTS.HIGH;
    } else {
      // k2d6-chat, instant, and any unknown → SCENARIO_CHAT
      scenario = SCENARIOS.CHAT;
      kimiModelId = KIMI_CHAT_MODELS.K2D6_CHAT;
      defaultReasoningEffort = REASONING_EFFORTS.LOW;
    }

    // thinking: true is always sent; reasoning_effort controls whether thinking is active.
    // thinking=false (caller) → REASONING_EFFORT_NONE (disable thinking)
    // thinking=true (caller)  → use model's default reasoning effort
    const reasoningEffort =
      thinking === true ? defaultReasoningEffort : REASONING_EFFORTS.NONE;

    const lastMsg = messages[messages.length - 1];
    const promptText =
      typeof lastMsg?.[CHAT_REQUEST_FIELDS.CONTENT] === 'string'
        ? lastMsg[CHAT_REQUEST_FIELDS.CONTENT]
        : JSON.stringify(lastMsg?.[CHAT_REQUEST_FIELDS.CONTENT] || '');

    // Build blocks: bắt đầu với text block
    const messageBlocks: KimiChatBlock[] = [
      {
        [CHAT_REQUEST_FIELDS.TEXT]: {
          [CHAT_REQUEST_FIELDS.CONTENT]: promptText,
        },
      },
    ];

    // Thêm file blocks từ ref_file_ids (kết quả upload)
    if (ref_file_ids && ref_file_ids.length > 0) {
      for (const fileRef of ref_file_ids) {
        const fileId = typeof fileRef === 'string' ? fileRef : fileRef.file_id;
        if (fileId) {
          messageBlocks.push({
            [CHAT_REQUEST_FIELDS.FILE]: {
              id: fileId,
              status: FILE_PROCESS_STATUS.SUCCESS,
            },
          });
        }
      }
    }

    const payload: KimiChatRequest = {
      [CHAT_REQUEST_FIELDS.SCENARIO]: scenario,
      [CHAT_REQUEST_FIELDS.TOOLS]: [
        {
          [CHAT_REQUEST_FIELDS.TYPE]: TOOL_TYPES.SEARCH,
          [CHAT_REQUEST_FIELDS.SEARCH]: {},
        },
        {
          [CHAT_REQUEST_FIELDS.TYPE]: TOOL_TYPES.CRON_JOB,
        },
      ],
      [CHAT_REQUEST_FIELDS.OPTIONS]: {
        [CHAT_REQUEST_FIELDS.THINKING]: true,
        [CHAT_REQUEST_FIELDS.ENABLE_PLUGIN]: search,
        [CHAT_REQUEST_FIELDS.REASONING_EFFORT]: reasoningEffort,
      },
      [CHAT_REQUEST_FIELDS.MESSAGE]: {
        [CHAT_REQUEST_FIELDS.ROLE]: 'user',
        [CHAT_REQUEST_FIELDS.BLOCKS]: messageBlocks,
      },
    };

    if (kimiModelId) {
      payload[CHAT_REQUEST_FIELDS.OPTIONS]![CHAT_REQUEST_FIELDS.MODEL] =
        kimiModelId;
    }

    if (conversationId && !conversationId.startsWith(ID_PREFIXES.TEMP_CHAT)) {
      payload[CHAT_REQUEST_FIELDS.CHAT_ID] = conversationId;
    }

    const bodyWithEnvelope = this.encodeConnectFrame(payload);

    let activeToken = cred.accessToken;

    // Check if token is expiring soon (within 5 minutes by default)
    if (isJwtExpiringSoon(cred.accessToken, DEFAULT_REFRESH_THRESHOLD_SEC)) {
      const refreshed = await this.refreshCredential(cred, options.accountId);
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
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
      [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
      [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
      ...MSH_HEADERS,
      [HTTP_HEADER_NAMES.R_TIMEZONE]: DEFAULT_TIMEZONE,
    };

    try {
      let response = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: bodyWithEnvelope,
        timeout: 120000,
      } as any);

      if (response.status === 401) {
        const refreshed = await this.refreshCredential(cred, options.accountId);
        if (refreshed) {
          activeToken = refreshed;
          headers[HTTP_HEADER_NAMES.AUTHORIZATION] =
            `${AUTH_PREFIXES.BEARER}${activeToken}`;

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
        (scenario === SCENARIOS.OK_COMPUTER ||
          scenario === SCENARIOS.OK_COMPUTER_SWARM)
      ) {
        logger.warn(
          `[Kimi] ${scenario} overloaded (${result.error}). Falling back to SCENARIO_CHAT.`,
        );
        payload[CHAT_REQUEST_FIELDS.SCENARIO] = SCENARIOS.CHAT;
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
    try {
      const cred = this.parseCredential(credential);
      if (!cred.accessToken) return [];

      // Refresh token nếu sắp hết hạn
      if (isJwtExpiringSoon(cred.accessToken, DEFAULT_REFRESH_THRESHOLD_SEC)) {
        await this.refreshCredential(cred, accountId);
      }

      const buildHeaders = (token: string): Record<string, string> => ({
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${token}`,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.CONNECT_PROTOCOL_VERSION]: '1',
        [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        ...MSH_HEADERS,
        [HTTP_HEADER_NAMES.R_TIMEZONE]: DEFAULT_TIMEZONE,
      });

      let res = await fetch(GET_AVAILABLE_MODELS_URL, {
        method: 'POST',
        headers: buildHeaders(cred.accessToken),
        body: JSON.stringify({}),
        timeout: 8000,
      } as any);

      // Retry một lần sau khi refresh nếu 401
      if (res.status === 401) {
        const refreshed = await this.refreshCredential(cred, accountId);
        if (refreshed) {
          res = await fetch(GET_AVAILABLE_MODELS_URL, {
            method: 'POST',
            headers: buildHeaders(refreshed),
            body: JSON.stringify({}),
            timeout: 8000,
          } as any);
        }
      }

      if (!res.ok) {
        logger.warn(`[Kimi] GetAvailableModels returned ${res.status}`);
        return [];
      }

      const json = (await res.json()) as KimiAvailableModelsResponse;
      const apiModels = json.availableModels;
      if (!apiModels || apiModels.length === 0) {
        logger.warn('[Kimi] GetAvailableModels returned empty array');
        return [];
      }

      return apiModels.map((m: KimiAvailableModel) => {
        const id = m.id || m.key || '';

        // Model có thinking nếu reasoningEffortOptions có ít nhất 1 option khác NONE
        const hasThinking = (m.reasoningEffortOptions || []).some(
          (o) =>
            o.effort === REASONING_EFFORTS.HIGH ||
            o.effort === 'REASONING_EFFORT_MAX' ||
            o.effort === REASONING_EFFORTS.LOW,
        );

        // Model instant (SCENARIO_CHAT / k2d6) không có agent context, không phải thinking
        const isInstant = m.scenario === SCENARIOS.CHAT;

        // Tất cả model Kimi đều support search và image upload (từ API test)
        return {
          id,
          name: m.displayName ? `Kimi ${m.displayName}` : id,
          description: m.description || undefined,
          is_thinking: !isInstant && hasThinking,
          max_context_length: 262144,
          is_search: true,
          is_image_upload: true,
          is_video_upload: false,
          is_audio_upload: false,
          is_file_upload: false,
          is_larger_content_paste_upload: false,
          is_image_generator: false,
          is_video_generator: false,
          is_deep_research: false,
        };
      });
    } catch (e) {
      logger.warn('[Kimi] getModels error:', e);
      return [];
    }
  }

  // ─── Upload File ────────────────────────────────────────────────────

  async uploadFile(
    credential: string,
    file: Express.Multer.File,
  ): Promise<{ id: string; url?: string }> {
    const cred = this.parseCredential(credential);
    if (!cred.accessToken) {
      throw new Error('[Kimi] uploadFile: missing accessToken');
    }

    // Refresh token nếu sắp hết hạn
    if (isJwtExpiringSoon(cred.accessToken, DEFAULT_REFRESH_THRESHOLD_SEC)) {
      await this.refreshCredential(cred);
    }

    return kimiUploadFile(cred.accessToken, file);
  }

  // ─── Get Usage ──────────────────────────────────────────────────────

  /**
   * Lấy usage quota từ Kimi API (GetSubscriptionStats).
   * - usage       : amountUsedRatio * 100 (percent đã dùng)
   * - resetUsageAt: expireTime của subscription (ISO string)
   */
  async getUsage(
    credential: string,
  ): Promise<{ usage: number; resetUsageAt: string | null }> {
    const cred = this.parseCredential(credential);
    if (!cred.accessToken) {
      throw new Error('[Kimi] getUsage: missing accessToken');
    }

    const headers: Record<string, string> = {
      [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${cred.accessToken}`,
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES.CONNECT_PROTOCOL_VERSION]: '1',
      [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
      [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
      ...MSH_HEADERS,
      [HTTP_HEADER_NAMES.R_TIMEZONE]: DEFAULT_TIMEZONE,
    };

    const res = await fetch(GET_SUBSCRIPTION_STATS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      timeout: 8000,
    } as any);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error(
        `[Kimi] getUsage: request failed | status=${res.status} | body=${errText.slice(0, 300)}`,
      );
      throw new Error(
        `[Kimi] GetSubscriptionStats returned ${res.status}: ${errText.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as {
      subscriptionBalance?: {
        amountUsedRatio?: number;
        expireTime?: string;
      };
    };

    const balance = json.subscriptionBalance;
    const usagePercent =
      balance?.amountUsedRatio != null
        ? Math.round(balance.amountUsedRatio * 100 * 100) / 100 // 2 decimal places
        : 0;
    const resetUsageAt = balance?.expireTime ?? null;

    return { usage: usagePercent, resetUsageAt };
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
