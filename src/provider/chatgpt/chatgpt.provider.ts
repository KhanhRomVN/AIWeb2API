/**
 * ------------------------------------------------------------------
 * ChatGPT Provider
 * ------------------------------------------------------------------
 * Provider implementation cho ChatGPT web backend (chatgpt.com).
 *
 * Phase 1 scope:
 * - login()         : Đăng nhập qua browser (capture Access Token)
 * - getUserProfile(): Lấy thông tin user từ /backend-api/me
 * - getModels()     : Liệt kê models từ /backend-api/models
 * - handleMessage() : Gửi tin nhắn qua /backend-api/conversation (SSE)
 *
 * Credential format (JSON string hoặc raw access token):
 * - secretKey / accessToken / token : ChatGPT access token (JWT)
 * - deviceId                        : OAI device id (sinh UUID nếu thiếu)
 *
 * Chưa port: turnstile solver VM, arkose, file upload, image generation.
 * Nếu upstream yêu cầu turnstile/arkose, provider sẽ throw lỗi rõ ràng.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { countMessagesTokens } from '../../utils/tokenizer';

// ── ChatGPT Imports ──
import {
  ChatGPTCredential,
  ChatGPTUserInfo,
  ChatRequirements,
  ConversationPayload,
  ConversationMessage,
  SentinelPrepareResponse,
  SentinelFinalizeResponse,
  ChatGPTSessionResponse,
} from './chatgpt.types';
import { proxyHandler } from './chatgpt.proxy-handler';
import { parseChatGPTSseStream } from './chatgpt.sse-parser';
import {
  buildLegacyRequirementsToken,
  buildProofToken,
  parsePowResources,
} from './chatgpt.pow';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  API_PATHS,
  CHATGPT_EVENTS,
  LOGIN_PARTITION_PREFIX,
  USER_AGENT,
  CLIENT_VERSION,
  CLIENT_BUILD_NUMBER,
  SEC_CH_UA,
  HTTP_HEADER_NAMES,
  HTTP_HEADER_NAMES_LOWERCASE,
  CONTENT_TYPES,
  REFERER_PATHS,
  DEFAULT_TIMEZONE,
  DEFAULT_TIMEZONE_OFFSET_MIN,
  CONVERSATION_MODE_PRIMARY_ASSISTANT,
  SSE_MESSAGE_STATUS,
  ROLE_VALUES,
  GOOGLE_LOGIN_PATH,
} from './chatgpt.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ChatGPTProvider');

/** TTL cache cho bootstrap data (script sources + data build). */
const BOOTSTRAP_TTL_MS = 10 * 60 * 1000;

interface BootstrapCache {
  scriptSources: string[];
  dataBuild: string;
  fetchedAt: number;
}

// ─── Provider Class ────────────────────────────────────────────────────

export class ChatGPTProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;

  private bootstrapCache: BootstrapCache | null = null;

  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Credential Helpers ─────────────────────────────────────────────

  /**
   * Parse credential string thành `{ accessToken, deviceId, cookie }`.
   * Hỗ trợ credential JSON `{ secretKey, deviceId, cookie }` hoặc raw access token.
   */
  private parseCredential(credential: string): ChatGPTCredential {
    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);
        const accessToken =
          parsed.secretKey ||
          parsed.secret_key ||
          parsed.accessToken ||
          parsed.access_token ||
          parsed.token;
        const deviceId = parsed.deviceId || parsed.device_id || null;
        const cookie = parsed.cookie || parsed.cookies || null;
        if (accessToken) {
          return { accessToken, deviceId, cookie };
        }
      } catch (e) {
        logger.warn(
          '[ChatGPT] Credential is not valid JSON, treating as raw token:',
          e,
        );
      }
    }
    return { accessToken: credential, deviceId: null, cookie: null };
  }

  /**
   * Lấy device_id từ credential hoặc sinh UUID v4 mới.
   * ChatGPT web client lưu device_id trong localStorage và header
   * `OAI-Device-Id`, dùng cố định cho mọi request.
   */
  private resolveDeviceId(credential: ChatGPTCredential): string {
    return credential.deviceId || randomUUID();
  }

  // ─── Header Builders ────────────────────────────────────────────────

  /** Header chung cho request tới backend-api (kèm Authorization + device). */
  private buildBaseHeaders(credential: ChatGPTCredential, deviceId: string) {
    const headers: Record<string, string> = {
      [HTTP_HEADER_NAMES.AUTHORIZATION]: `Bearer ${credential.accessToken}`,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
      [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]:
        'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7',
      [HTTP_HEADER_NAMES.CACHE_CONTROL]: 'no-cache',
      [HTTP_HEADER_NAMES.PRAGMA]: 'no-cache',
      [HTTP_HEADER_NAMES.SEC_CH_UA]: SEC_CH_UA,
      [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: '?0',
      [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: '"Windows"',
      [HTTP_HEADER_NAMES.OAI_DEVICE_ID]: deviceId,
      [HTTP_HEADER_NAMES.OAI_SESSION_ID]: randomUUID(),
      [HTTP_HEADER_NAMES.OAI_LANGUAGE]: 'zh-CN',
      [HTTP_HEADER_NAMES.OAI_CLIENT_VERSION]: CLIENT_VERSION,
      [HTTP_HEADER_NAMES.OAI_CLIENT_BUILD_NUMBER]: CLIENT_BUILD_NUMBER,
    };

    // Cookie session bắt buộc để qua Cloudflare (__cf_bm, __cfuvid) và để
    // server xác thực đúng session khi AT còn hạn hay vừa exchange.
    if (credential.cookie) {
      headers[HTTP_HEADER_NAMES.COOKIE] = credential.cookie;
    }

    return headers;
  }

  /**
   * Bổ sung header `X-OpenAI-Target-Path` / `X-OpenAI-Target-Route` mà
   * web client gửi kèm mỗi request — thiếu 2 header này có thể bị 403.
   */
  private withTargetHeaders(
    headers: Record<string, string>,
    path: string,
  ): Record<string, string> {
    return {
      ...headers,
      [HTTP_HEADER_NAMES.X_OPENAI_TARGET_PATH]: path,
      [HTTP_HEADER_NAMES.X_OPENAI_TARGET_ROUTE]: path,
    };
  }

  // ─── Auth Session Exchange ──────────────────────────────────────────

  /**
   * Đổi cookie session ChatGPT thành access token mới qua endpoint
   * `/api/auth/session` (NextAuth). Đây là cách chuẩn để refresh AT vì
   * ChatGPT web client tự gọi endpoint này khi cần token mới.
   *
   * @param cookie Chuỗi cookie session (đã có `__Secure-next-auth.session-token.*`).
   * @returns Access token (JWT) hoặc null nếu thất bại.
   */
  async exchangeCookiesForAccessToken(
    cookie: string,
  ): Promise<string | null> {
    if (!cookie) return null;

    try {
      const res = await fetch(`${BASE_URL}${API_PATHS.AUTH_SESSION}`, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.COOKIE]: cookie,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
          [HTTP_HEADER_NAMES.ACCEPT]: 'application/json',
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
        },
      });

      if (!res.ok) {
        logger.warn(
          `[ChatGPT] /api/auth/session returned HTTP ${res.status}`,
        );
        return null;
      }

      const json = (await res.json()) as ChatGPTSessionResponse;
      if (json?.error) {
        logger.warn(`[ChatGPT] /api/auth/session error: ${json.error}`);
        return null;
      }

      const token = json?.accessToken || null;
      if (!token) {
        logger.warn('[ChatGPT] /api/auth/session missing accessToken field');
      }
      return token;
    } catch (e) {
      const err = e as Error;
      logger.warn(
        `[ChatGPT] Failed to exchange cookies for access token: ${err.message}`,
      );
      return null;
    }
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────

  /**
   * Fetch trang chủ chatgpt.com để lấy script sources cho PoW.
   * Kết quả được cache 10 phút (script hiếm khi thay đổi).
   */
  private async bootstrap(forceRefresh = false): Promise<BootstrapCache> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.bootstrapCache &&
      now - this.bootstrapCache.fetchedAt < BOOTSTRAP_TTL_MS
    ) {
      return this.bootstrapCache;
    }

    try {
      const res = await fetch(`${BASE_URL}/`, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
          [HTTP_HEADER_NAMES.ACCEPT]:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: 'zh-CN,zh;q=0.9,en;q=0.8',
          [HTTP_HEADER_NAMES.SEC_FETCH_DEST]: 'document',
          [HTTP_HEADER_NAMES.SEC_FETCH_MODE]: 'navigate',
          [HTTP_HEADER_NAMES.SEC_FETCH_SITE]: 'none',
          [HTTP_HEADER_NAMES.SEC_FETCH_USER]: '?1',
          [HTTP_HEADER_NAMES.UPGRADE_INSECURE_REQUESTS]: '1',
        },
      });
      const html = await res.text();
      const parsed = parsePowResources(html);
      this.bootstrapCache = {
        scriptSources: parsed.scriptSources,
        dataBuild: parsed.dataBuild,
        fetchedAt: now,
      };
      return this.bootstrapCache;
    } catch (e) {
      const err = e as Error;
      logger.warn(`[ChatGPT] Bootstrap failed: ${err.message}`);
      // Fallback: dùng default script source, data-build rỗng.
      this.bootstrapCache = {
        scriptSources: [],
        dataBuild: '',
        fetchedAt: now,
      };
      return this.bootstrapCache;
    }
  }

  // ─── Chat Requirements (Sentinel) ───────────────────────────────────

  /**
   * Thực hiện 2 bước prepare + finalize để lấy sentinel token.
   *
   * Bước 1: POST /prepare với legacy requirements token (`gAAAAAC...`).
   * Bước 2: Nếu server yêu cầu proofofwork, giải PoW để lấy proof token;
   *         sau đó POST /finalize để lấy token thật.
   */
  private async getChatRequirements(
    headers: Record<string, string>,
    bootstrap: BootstrapCache,
  ): Promise<ChatRequirements> {
    const preparePath = API_PATHS.CHAT_REQUIREMENTS_PREPARE;
    const legacyToken = buildLegacyRequirementsToken(
      USER_AGENT,
      bootstrap.scriptSources,
      bootstrap.dataBuild,
    );

    const prepareRes = await fetch(`${BASE_URL}${preparePath}`, {
      method: 'POST',
      headers: this.withTargetHeaders(
        {
          ...headers,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        },
        preparePath,
      ),
      body: JSON.stringify({ p: legacyToken }),
    });

    if (!prepareRes.ok) {
      const text = await prepareRes.text();
      throw new Error(
        `chatgpt_requirements_prepare_failed: HTTP ${prepareRes.status} — ${text.slice(
          0,
          500,
        )}`,
      );
    }

    const prepareData = (await prepareRes.json()) as SentinelPrepareResponse;

    if (prepareData.arkose?.required) {
      throw new Error(
        'chatgpt_arkose_required: arkose token is not implemented in this provider',
      );
    }

    let proofToken = '';
    if (prepareData.proofofwork?.required) {
      proofToken = buildProofToken(
        prepareData.proofofwork.seed || '',
        prepareData.proofofwork.difficulty || '',
        USER_AGENT,
        bootstrap.scriptSources,
        bootstrap.dataBuild,
      );
    }

    if (prepareData.turnstile?.required) {
      throw new Error(
        'chatgpt_turnstile_required: turnstile solver is not implemented in this provider',
      );
    }

    const finalizePath = API_PATHS.CHAT_REQUIREMENTS_FINALIZE;
    const finalizeRes = await fetch(`${BASE_URL}${finalizePath}`, {
      method: 'POST',
      headers: this.withTargetHeaders(
        {
          ...headers,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        },
        finalizePath,
      ),
      body: JSON.stringify({
        prepare_token: prepareData.prepare_token || '',
        proof_token: proofToken,
        turnstile_token: '',
      }),
    });

    if (!finalizeRes.ok) {
      const text = await finalizeRes.text();
      throw new Error(
        `chatgpt_requirements_finalize_failed: HTTP ${finalizeRes.status} — ${text.slice(
          0,
          500,
        )}`,
      );
    }

    const finalizeData = (await finalizeRes.json()) as SentinelFinalizeResponse;
    const token = finalizeData.token || '';
    if (!token) {
      throw new Error(
        `chatgpt_requirements_missing_token: ${JSON.stringify(finalizeData).slice(
          0,
          500,
        )}`,
      );
    }

    return {
      token,
      proofToken,
      turnstileToken: '',
      soToken: finalizeData.so_token || '',
    };
  }

  // ─── Conversation Payload ───────────────────────────────────────────

  /**
   * Convert messages của application sang conversation format của ChatGPT web.
   * ChatGPT chỉ hỗ trợ text; các phần non-text bị bỏ qua ở Phase 1.
   */
  private buildConversationMessages(
    messages: SendMessageOptions['messages'],
  ): ConversationMessage[] {
    const output: ConversationMessage[] = [];
    for (const item of messages) {
      const role = item.role || 'user';
      const contentText =
        typeof item.content === 'string' ? item.content : '';
      output.push({
        id: randomUUID(),
        author: { role },
        content: {
          content_type: 'text',
          parts: [contentText],
        },
      });
    }
    return output;
  }

  /** Tạo payload cho POST /backend-api/conversation. */
  private buildConversationPayload(
    messages: SendMessageOptions['messages'],
    model: string,
  ): ConversationPayload {
    return {
      action: 'next',
      messages: this.buildConversationMessages(messages),
      model,
      parent_message_id: randomUUID(),
      conversation_mode: { kind: CONVERSATION_MODE_PRIMARY_ASSISTANT },
      conversation_origin: null,
      force_paragen: false,
      force_paragen_model_slug: '',
      force_rate_limit: false,
      force_use_sse: true,
      history_and_training_disabled: true,
      reset_rate_limits: false,
      suggestions: [],
      supported_encodings: [],
      system_hints: [],
      timezone: DEFAULT_TIMEZONE,
      timezone_offset_min: DEFAULT_TIMEZONE_OFFSET_MIN,
      variant_purpose: 'comparison_implicit',
      websocket_request_id: randomUUID(),
      client_contextual_info: {
        is_dark_mode: false,
        time_since_loaded: 120,
        page_height: 900,
        page_width: 1400,
        pixel_ratio: 2,
        screen_height: 1440,
        screen_width: 2560,
      },
    };
  }

  /**
   * Chuẩn hóa credential trước khi dùng. Nếu `secretKey` không phải JWT
   * (thường gặp với credential cũ lưu nhầm cookie string vào secretKey),
   * tự động exchange cookie để lấy AT thật.
   *
   * @returns Credential đã chuẩn hóa + JSON credential mới nếu có rotation.
   */
  private async resolveActiveCredential(
    credential: string,
  ): Promise<{ cred: ChatGPTCredential; newCredential?: string }> {
    const parsed = this.parseCredential(credential);

    const isJwt =
      parsed.accessToken.startsWith('eyJ') &&
      parsed.accessToken.split('.').length === 3;
    if (isJwt) {
      return { cred: parsed };
    }

    // secretKey không phải JWT → coi nó là cookie string, exchange lấy AT.
    logger.warn(
      '[ChatGPT] Credential accessToken is not a JWT — attempting cookie exchange',
    );
    const cookie = parsed.cookie || parsed.accessToken;
    const exchanged = await this.exchangeCookiesForAccessToken(cookie);
    if (!exchanged) {
      throw new Error(
        'chatgpt_invalid_credential: accessToken is not a JWT and cookie exchange failed',
      );
    }

    const newCred: ChatGPTCredential = {
      accessToken: exchanged,
      deviceId: parsed.deviceId,
      cookie,
    };
    return {
      cred: newCred,
      newCredential: JSON.stringify({
        secretKey: exchanged,
        deviceId: parsed.deviceId,
        cookie,
      }),
    };
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
      onSessionCreated,
      onCredentialRotated,
    } = options;

    try {
      const resolved = await this.resolveActiveCredential(credential);
      const parsedCred = resolved.cred;

      // Nếu credential vừa được phục hồi/rotate, persist lại qua caller.
      if (resolved.newCredential && onCredentialRotated) {
        try {
          await onCredentialRotated(resolved.newCredential);
        } catch (e: any) {
          logger.warn(
            '[ChatGPT] onCredentialRotated callback failed:',
            e?.message || e,
          );
        }
      }

      const deviceId = this.resolveDeviceId(parsedCred);
      const baseHeaders = this.buildBaseHeaders(parsedCred, deviceId);

      // 1. Bootstrap để lấy script sources cho PoW
      const bootstrap = await this.bootstrap();

      // 2. Lấy sentinel token
      const requirements = await this.getChatRequirements(baseHeaders, bootstrap);

      // 3. Gửi conversation
      const path = API_PATHS.CONVERSATION;
      const payload = this.buildConversationPayload(messages, model);

      const conversationHeaders = this.withTargetHeaders(
        {
          ...baseHeaders,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          [HTTP_HEADER_NAMES.ACCEPT]: 'text/event-stream',
          [HTTP_HEADER_NAMES.SENTINEL_CHAT_REQUIREMENTS]: requirements.token,
        },
        path,
      );

      if (requirements.proofToken) {
        conversationHeaders[HTTP_HEADER_NAMES.SENTINEL_PROOF_TOKEN] =
          requirements.proofToken;
      }
      if (requirements.turnstileToken) {
        conversationHeaders[HTTP_HEADER_NAMES.SENTINEL_TURNSTILE_TOKEN] =
          requirements.turnstileToken;
      }
      if (requirements.soToken) {
        conversationHeaders[HTTP_HEADER_NAMES.SENTINEL_SO_TOKEN] =
          requirements.soToken;
      }

      const promptTokens = countMessagesTokens(messages);

      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: conversationHeaders,
        body: JSON.stringify(payload),
      });

      if (response.status === 401 || response.status === 403) {
        const text = await response.text();
        const message = `chatgpt_auth_failed: HTTP ${response.status} — ${text.slice(0, 500)}`;
        const err = new Error(`Session expired or invalid. Please re-login to ChatGPT. (${message})`);
        (err as any).isAuthError = true;
        (err as any).statusCode = response.status;
        throw err;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `chatgpt_conversation_failed: HTTP ${response.status} — ${text.slice(
            0,
            500,
          )}`,
        );
      }
      if (!response.body) {
        throw new Error('chatgpt_conversation_no_body');
      }

      // 4. Parse SSE
      const result = await parseChatGPTSseStream(
        response.body as unknown as NodeJS.ReadableStream,
        {
          onContent,
          onThinking,
          onMetadata,
          onRaw,
        },
      );

      if (result.conversationId) {
        if (onSessionCreated) onSessionCreated(result.conversationId);
        if (onMetadata) {
          onMetadata({ conversation_id: result.conversationId });
        }
      }

      // Nếu upstream không trả status terminal, log để dễ debug.
      if (
        result.status &&
        result.status !== SSE_MESSAGE_STATUS.FINISHED_SUCCESSFULLY &&
        result.status !== SSE_MESSAGE_STATUS.FINISHED_PARTIAL_COMPLETION
      ) {
        logger.warn(
          `[ChatGPT] Stream finished with unexpected status: ${result.status}`,
        );
      }

      if (onMetadata) {
        onMetadata({
          total_token: promptTokens,
        });
      }

      onDone();
    } catch (err: any) {
      logger.error('[ChatGPT] handleMessage error:', {
        message: err?.message,
        stack: err?.stack,
        model: model || 'unknown',
      });
      onError(err);
    }
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const parsedCred = this.parseCredential(credential);
    const deviceId = this.resolveDeviceId(parsedCred);

    try {
      const path = API_PATHS.ME;
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'GET',
        headers: this.withTargetHeaders(
          this.buildBaseHeaders(parsedCred, deviceId),
          path,
        ),
      });

      if (!res.ok) {
        logger.warn(
          `[ChatGPT] Get Profile returned status ${res.status}`,
        );
        return { email: null };
      }

      const json = (await res.json()) as ChatGPTUserInfo;
      return {
        email: json.email || null,
        name: json.name,
        id: json.id,
      };
    } catch (e) {
      logger.error('[ChatGPT] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Models ─────────────────────────────────────────────────────────

  /**
   * Liệt kê models từ /backend-api/models. Throw error khi fail.
   */
  async getModels(credential: string): Promise<any[]> {
    const parsedCred = this.parseCredential(credential);
    const deviceId = this.resolveDeviceId(parsedCred);

    const path = `${API_PATHS.MODELS}?history_and_training_disabled=false`;
    const route = API_PATHS.MODELS;
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: this.withTargetHeaders(
        this.buildBaseHeaders(parsedCred, deviceId),
        route,
      ),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json() as any;
        detail = body?.detail || body?.error?.message || body?.message || JSON.stringify(body);
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(`ChatGPT API returned ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const json = (await res.json()) as { models?: any[] };
    const list = Array.isArray(json.models) ? json.models : [];
    return list
      .filter((item) => item && typeof item.slug === 'string')
      .map((item) => ({
        id: item.slug,
        name: item.title || item.slug,
      }));
  }

  // ─── Login ──────────────────────────────────────────────────────────

  /**
   * Mở browser tới trang login ChatGPT để user đăng nhập bằng Google.
   * Access token bắt qua Authorization header của request tới backend-api
   * (proxy handler), email lấy từ `/backend-api/me`.
   */
  async login(_options?: { chatgptMethod?: 'google' }) {
    const loginUrl = `${BASE_URL}${GOOGLE_LOGIN_PATH}`;

    const result = await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: CHATGPT_EVENTS.LOGIN_TOKEN,
      infoEvent: CHATGPT_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        const raw = data.cookies?.trim();
        if (!raw || raw.length < 30) {
          return { isValid: false };
        }

        // `data.cookies` có thể là AT (JWT) từ proxy event LOGIN_TOKEN,
        // hoặc cookie string từ CDP capture — phải phân biệt để xử lý đúng.
        const isJwt = raw.startsWith('eyJ') && raw.split('.').length === 3;

        let accessToken = '';
        let cookie = '';

        if (isJwt) {
          accessToken = raw;
        } else {
          // raw là cookie string → exchange qua /api/auth/session để lấy AT.
          cookie = raw;
          const exchanged = await this.exchangeCookiesForAccessToken(cookie);
          if (!exchanged) {
            logger.warn(
              '[ChatGPT] Login validation: cookie exchange returned no access token',
            );
            return { isValid: false };
          }
          accessToken = exchanged;
        }

        let email = data.email;
        if (!email) {
          const profile = await this.getUserProfile(
            JSON.stringify({ secretKey: accessToken, cookie }),
          );
          email = profile.email || undefined;
        }

        if (!email) {
          logger.warn(
            '[ChatGPT] Login validation failed: could not determine email',
          );
          return { isValid: false };
        }

        const deviceId = randomUUID();
        const jsonCredential = JSON.stringify({
          secretKey: accessToken,
          deviceId,
          cookie,
        });
        return { isValid: true, cookies: jsonCredential, email };
      },
    });
    return result;
  }

  // ─── Utility ────────────────────────────────────────────────────────

  /**
   * Xóa cache bootstrap. Gọi khi credential thay đổi hoặc khi cần
   * force refresh script sources (hiếm khi cần).
   */
  resetBootstrapCache(): void {
    this.bootstrapCache = null;
  }
}

export default new ChatGPTProvider();