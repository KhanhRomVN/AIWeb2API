/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Cerebras Cloud API.
 * Hỗ trợ login qua browser, chat completion, rate limiting,
 * và tự động lấy danh sách models.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và lấy credential
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ API
 * - getUserProfile() : Lấy thông tin user profile
 * - rate limiting    : Tự động giới hạn request/token theo account
 *
 * Credential format:
 * - cookies          : Cookie string (chứa authjs.session-token)
 * - OR API key       : Plain string bắt đầu bằng 'csk-'
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Cerebras Types ──
import {
  CerebrasCompletionPayload,
  CerebrasUserInfo,
  CerebrasUserSessionResponse,
  CerebrasModelsResponse,
  CerebrasModelEntry,
  CerebrasModelOutput,
} from './cerebras-cloud.types';

// ── Cerebras Constants ──
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  API_BASE_URL,
  API_PATHS,
  CEREBRAS_EVENTS,
  USER_AGENT,
  HTTP_HEADERS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  PAYLOAD_DEFAULTS,
  MODELS_DEFAULTS,
  COOKIE_CONFIG,
  LOGIN_PARTITION_PREFIX,
} from './cerebras-cloud.constant';

// ── Cerebras Internal ──
import { proxyHandler } from './cerebras-cloud.proxy-handler';
import { parseSSEStream } from './cerebras-cloud.sse-parser';
import { usageTracker } from './cerebras-cloud.rate-limiter';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CerebrasCloudProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class CerebrasCloudProvider implements Provider {
  name = PROVIDER_ID;
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ────────────────────────────────────────
  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: CEREBRAS_EVENTS.COOKIES,
      infoEvent: CEREBRAS_EVENTS.USER_INFO,
      validate: async (data: {
        cookies: string;
        headers?: Record<string, string>;
        email?: string;
      }) => {
        if (!data.cookies) return { isValid: false };

        const hasSessionToken =
          data.cookies.includes(COOKIE_CONFIG.SESSION_TOKEN_NAME) ||
          data.cookies.includes(COOKIE_CONFIG.CALLBACK_URL_NAME);

        if (!hasSessionToken) {
          logger.warn(
            '[CerebrasCloud] Login validation failed: no session token found',
          );
          return { isValid: false };
        }

        let email = data.email;

        if (!email) {
          const profile = await this.getUserProfile(data.cookies);
          email = profile.email || undefined;
        }

        if (email) {
          return { isValid: true, cookies: data.cookies, email };
        }

        return { isValid: true, cookies: data.cookies };
      },
    });
  }

  // ─── Get Profile ────────────────────────────────────────────────────

  async getUserProfile(credential: string): Promise<CerebrasUserInfo> {
    try {
      const response = await fetch(`${BASE_URL}${API_PATHS.AUTH_SESSION}`, {
        method: 'GET',
        headers: this.buildBaseHeaders(credential, BASE_URL),
      });

      if (response.ok) {
        const json = (await response.json()) as CerebrasUserSessionResponse;
        if (json?.user) {
          return {
            email: json.user.email || null,
          };
        }
        logger.warn('[CerebrasCloud] Get Profile response missing user field');
      }
      return { email: null };
    } catch (e) {
      logger.error('[CerebrasCloud] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<CerebrasModelOutput[]> {
    try {
      const apiKey = this.extractApiKey(credential);

      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
        [HTTP_HEADER_NAMES.SEC_FETCH_SITE]:
          HTTP_HEADERS.SEC_FETCH_SITE_SAME_SITE,
        [HTTP_HEADER_NAMES.SEC_FETCH_MODE]: HTTP_HEADERS.SEC_FETCH_MODE_CORS,
        [HTTP_HEADER_NAMES.SEC_FETCH_DEST]: HTTP_HEADERS.SEC_FETCH_DEST_EMPTY,
        [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: HTTP_HEADERS.ACCEPT_LANGUAGE,
      };

      if (apiKey) {
        headers[HTTP_HEADER_NAMES.AUTHORIZATION] =
          `${HTTP_HEADERS.BEARER_PREFIX}${apiKey}`;
      } else {
        headers[HTTP_HEADER_NAMES.COOKIE] = credential;
      }

      const response = await fetch(`${API_BASE_URL}${API_PATHS.MODELS}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Cerebras Models API returned ${response.status}: ${errorText}`,
        );
        return [];
      }

      const json = (await response.json()) as CerebrasModelsResponse;
      const modelsData = json.data || json.models || [];

      if (!Array.isArray(modelsData)) {
        logger.warn('[CerebrasCloud] Models API returned invalid format');
        return [];
      }

      return modelsData.map((model: CerebrasModelEntry) => ({
        id: model.id,
        name: model.id,
        description: model.description || '',
        max_context_length:
          model.context_window ||
          model.max_tokens ||
          MODELS_DEFAULTS.MAX_CONTEXT_LENGTH,
        is_thinking: false,
      }));
    } catch (e) {
      logger.error('Error fetching Cerebras Cloud models:', e);
      return [];
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
    } = options;
    const selectedModel = model;
    const apiKey = this.extractApiKey(credential);
    const accountId = options.accountId || credential.slice(0, 32);

    const estimatedInputTokens = messages.reduce(
      (sum, m) => sum + Math.ceil((m.content?.length || 0) / 4),
      0,
    );
    const limitError = usageTracker.checkLimit(accountId, estimatedInputTokens);
    if (limitError) {
      logger.warn(`[CerebrasCloud] Rate limit blocked: ${limitError}`);
      onError(new Error(limitError));
      return;
    }

    usageTracker.recordRequest(accountId);

    const payload: CerebrasCompletionPayload = {
      messages: messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      model: selectedModel,
      stream: true,
      max_completion_tokens: PAYLOAD_DEFAULTS.MAX_COMPLETION_TOKENS,
      top_p: PAYLOAD_DEFAULTS.TOP_P,
      tools: [],
    };

    try {
      const headers = this.buildApiHeaders(credential, apiKey);

      const response = await fetch(
        `${API_BASE_URL}${API_PATHS.CHAT_COMPLETIONS}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cerebras API returned ${response.status}: ${errorText}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let totalTokensUsed = 0;
      const wrappedOnMetadata = (meta: Record<string, unknown>) => {
        const total = meta?.total_token;
        if (typeof total === 'number' && total > totalTokensUsed) {
          totalTokensUsed = total;
        }
        if (onMetadata) onMetadata(meta);
      };

      await parseSSEStream(response.body as NodeJS.ReadableStream, {
        onContent,
        onThinking,
        onMetadata: wrappedOnMetadata,
        onRaw,
      });

      if (totalTokensUsed > 0) {
        usageTracker.recordTokens(accountId, totalTokensUsed);
      }

      onDone();
    } catch (err) {
      logger.error('[CerebrasCloud] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private extractApiKey(credential: string): string | null {
    if (credential.trim().startsWith(COOKIE_CONFIG.API_KEY_PREFIX)) {
      return credential.trim();
    }

    if (!credential.includes('=') && !credential.includes(';')) {
      return credential.trim();
    }

    return null;
  }

  private buildApiHeaders(
    credential: string,
    apiKey: string | null,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
      [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES.SEC_CH_UA]: HTTP_HEADERS.SEC_CH_UA,
      [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: HTTP_HEADERS.SEC_CH_UA_MOBILE,
      [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: HTTP_HEADERS.SEC_CH_UA_PLATFORM,
      [HTTP_HEADER_NAMES.SEC_FETCH_SITE]: HTTP_HEADERS.SEC_FETCH_SITE_SAME_SITE,
      [HTTP_HEADER_NAMES.SEC_FETCH_MODE]: HTTP_HEADERS.SEC_FETCH_MODE_CORS,
      [HTTP_HEADER_NAMES.SEC_FETCH_DEST]: HTTP_HEADERS.SEC_FETCH_DEST_EMPTY,
      [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: HTTP_HEADERS.ACCEPT_LANGUAGE,
      [HTTP_HEADER_NAMES.X_STAINLESS_LANG]: HTTP_HEADERS.X_STAINLESS_LANG,
      [HTTP_HEADER_NAMES.X_STAINLESS_RUNTIME]: HTTP_HEADERS.X_STAINLESS_RUNTIME,
      [HTTP_HEADER_NAMES.X_STAINLESS_RUNTIME_VERSION]:
        HTTP_HEADERS.X_STAINLESS_RUNTIME_VERSION,
      [HTTP_HEADER_NAMES.X_STAINLESS_PACKAGE_VERSION]:
        HTTP_HEADERS.X_STAINLESS_PACKAGE_VERSION,
      [HTTP_HEADER_NAMES.X_STAINLESS_OS]: HTTP_HEADERS.X_STAINLESS_OS,
      [HTTP_HEADER_NAMES.X_STAINLESS_ARCH]: HTTP_HEADERS.X_STAINLESS_ARCH,
      [HTTP_HEADER_NAMES.X_STAINLESS_RETRY_COUNT]:
        HTTP_HEADERS.X_STAINLESS_RETRY_COUNT,
      [HTTP_HEADER_NAMES.X_STAINLESS_TIMEOUT]: HTTP_HEADERS.X_STAINLESS_TIMEOUT,
    };

    if (apiKey) {
      headers[HTTP_HEADER_NAMES.AUTHORIZATION] =
        `${HTTP_HEADERS.BEARER_PREFIX}${apiKey}`;
    } else {
      headers[HTTP_HEADER_NAMES.COOKIE] = credential;
    }

    return headers;
  }

  private buildBaseHeaders(
    credential: string,
    refererBase: string,
  ): Record<string, string> {
    return {
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_ANY,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
      [HTTP_HEADER_NAMES.ORIGIN]: refererBase,
      [HTTP_HEADER_NAMES.REFERER]: `${refererBase}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES.SEC_CH_UA]: HTTP_HEADERS.SEC_CH_UA,
      [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: HTTP_HEADERS.SEC_CH_UA_MOBILE,
      [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: HTTP_HEADERS.SEC_CH_UA_PLATFORM,
      [HTTP_HEADER_NAMES.SEC_FETCH_SITE]:
        HTTP_HEADERS.SEC_FETCH_SITE_SAME_ORIGIN,
      [HTTP_HEADER_NAMES.SEC_FETCH_MODE]: HTTP_HEADERS.SEC_FETCH_MODE_CORS,
      [HTTP_HEADER_NAMES.SEC_FETCH_DEST]: HTTP_HEADERS.SEC_FETCH_DEST_EMPTY,
      [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: HTTP_HEADERS.ACCEPT_LANGUAGE,
      [HTTP_HEADER_NAMES.COOKIE]: credential,
    };
  }
}

export default new CerebrasCloudProvider();
