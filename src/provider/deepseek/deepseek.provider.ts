/**
 * ------------------------------------------------------------------
 * DeepSeek Provider
 * ------------------------------------------------------------------
 * Provider implementation cho DeepSeek AI API.
 * Hỗ trợ login, chat completion với thinking mode, search,
 * PoW (Proof of Work) challenge, file upload, và auto-continue
 * cho response bị truncate.
 *
 * Main features:
 * - login()                : Đăng nhập qua browser (basic/google)
 * - handleMessage()        : Gửi tin nhắn với streaming response
 * - continueIncompleteResponse() : Tiếp tục response bị truncate
 * - uploadFile()           : Upload file lên DeepSeek
 * - getUserProfile()           : Lấy thông tin user profile
 *
 * Credential format (JSON string hoặc raw token):
 * - secretKey          : DeepSeek bearer token (không phải JWT)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as path from 'path';
import fetch, { Response as NodeFetchResponse } from 'node-fetch';
import { randomUUID } from 'crypto';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';
import { countMessagesTokens } from '../../utils/tokenizer';

// ── DeepSeek Imports ──
import {
  PoWChallenge,
  ChatPayload,
  ContinuePayload,
  DeepSeekApiEnvelope,
  DeepSeekChatMessage,
  DeepSeekUserInfo,
  DeepSeekCredential,
  CheckDeviceResponse,
  RenewResult,
  UploadFileInput,
} from './deepseek.types';
import { DeepSeekHash, solvePoW } from './deepseek.pow';
import { proxyHandler } from './deepseek.proxy-handler';
import { parseSSEStream } from './deepseek.sse-parser';
import { deepseekUploadFile } from './deepseek.upload';
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
  DEEPSEEK_EVENTS,
  MAX_CONTINUATIONS,
  GOOGLE_OAUTH_LOGIN_URL,
  DEEPSEEK_AUTH_METHODS,
  API_PATHS,
  USER_AGENTS,
  HTTP_HEADERS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  REGEX_PATTERNS,
  API_FIELDS,
  ROLE_VALUES,
  MASKED_EMAIL_INDICATOR,
  MASKED_EMAIL_CHAR,
  SUCCESS_CODE,
  COOKIE_CONFIG,
  MODEL_TYPES,
  SSE_FRAGMENT_TYPES,
  WASM_FILENAME,
  LOGIN_PARTITION_PREFIX,
  HISTORY_MESSAGES_COUNT,
  AUTH_RENEW_CONFIG,
  DEEPSEEK_ERROR_CODES,
} from './deepseek.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class DeepSeekProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;
  private wasmPath: string = '';
  private dsHash: DeepSeekHash | null = null;

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
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Credential Helpers ─────────────────────────────────────────────

  /**
   * Parse credential string thành `{ token, deviceId }`.
   * Hỗ trợ cả credential JSON mới (`{secretKey, deviceId}`) lẫn raw token cũ.
   * Nếu credential cũ không có `deviceId` → trả `deviceId: null`.
   */
  private parseCredential(credential: string): DeepSeekCredential {
    // Try parsing as JSON first
    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);
        const token =
          parsed.secretKey ||
          parsed.secret_key ||
          parsed.accessToken ||
          parsed.access_token ||
          parsed.token;
        const deviceId = parsed.deviceId || parsed.device_id || null;
        if (token) {
          return { token, deviceId };
        }
      } catch (e) {
        logger.warn(
          '[DeepSeek] Credential is not valid JSON, treating as raw token:',
          e,
        );
      }
    }

    // Fallback: treat as raw token
    return { token: credential, deviceId: null };
  }

  /**
   * Lấy `device_id` từ credential; nếu chưa có thì sinh UUID v4 mới.
   * KHÔNG persist ở đây — caller chịu trách nhiệm lưu credential mới.
   *
   * Lý do: web client DeepSeek lưu device_id trong
   * `localStorage["deepseek-device-id:chat"]` và dùng cặp
   * `(token, device_id)` để server quyết định rotate token. Nếu sinh mới
   * mỗi request → server từ chối rotate → token chết.
   */
  private resolveDeviceId(credential: DeepSeekCredential): string {
    if (credential.deviceId) return credential.deviceId;
    return randomUUID(); // UUID v4 — khớp hành vi web client
  }

  /**
   * Gọi `/api/v0/users/auth_token/check_device` để kiểm tra & rotate token.
   *
   * @returns
   * - `{ token, rotated: true, newCredential }` nếu server cấp token mới.
   * - `{ token: <token cũ>, rotated: false, newCredential }` nếu không rotate
   *   (token vẫn còn hạn, `newCredential` chuẩn hóa lại để lưu `deviceId`).
   * - `null` nếu token đã chết hoàn toàn (cần login lại) hoặc request lỗi.
   */
  async renewTokenIfPossible(
    credential: DeepSeekCredential,
  ): Promise<RenewResult | null> {
    const deviceId = this.resolveDeviceId(credential);

    try {
      const url = `${BASE_URL}${API_PATHS.USERS_AUTH_TOKEN_CHECK_DEVICE}`;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        AUTH_RENEW_CONFIG.REQUEST_TIMEOUT_MS,
      );

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal as any,
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${credential.token}`,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          [HTTP_HEADER_NAMES.X_DEVICE_ID]: deviceId,
          [HTTP_HEADER_NAMES.X_DEVICE_MODEL]: '',
          [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.LINUX_CHROME,
          [HTTP_HEADER_NAMES.X_CLIENT_VERSION]: HTTP_HEADERS.X_CLIENT_VERSION,
          [HTTP_HEADER_NAMES.X_CLIENT_PLATFORM]: HTTP_HEADERS.X_CLIENT_PLATFORM,
          [HTTP_HEADER_NAMES.X_CLIENT_LOCALE]: HTTP_HEADERS.X_CLIENT_LOCALE,
          [HTTP_HEADER_NAMES.X_CLIENT_BUNDLE_ID]:
            HTTP_HEADERS.X_CLIENT_BUNDLE_ID,
          [HTTP_HEADER_NAMES.X_CLIENT_TIMEZONE_OFFSET]:
            HTTP_HEADERS.X_CLIENT_TIMEZONE_OFFSET,
        },
        body: JSON.stringify({ device_id: deviceId, device_model: '' }),
      });

      clearTimeout(timeout);

      // Token đã chết hoàn toàn — không thể renew
      if (res.status === 401 || res.status === 403) {
        logger.warn('[DeepSeek] check_device rejected token (auth dead)');
        return null;
      }

      if (!res.ok) {
        logger.warn(`[DeepSeek] check_device HTTP ${res.status}`);
        return null;
      }

      const json =
        (await res.json()) as DeepSeekApiEnvelope<CheckDeviceResponse>;

      if (json?.code !== SUCCESS_CODE) {
        logger.warn(
          `[DeepSeek] check_device biz error code=${json?.code} msg=${json?.msg}`,
        );
        return null;
      }

      const rotate = json?.data?.biz_data?.rotate ?? null;

      // Không rotate → token cũ vẫn dùng được
      if (!rotate) {
        return {
          token: credential.token,
          rotated: false,
          newCredential: JSON.stringify({
            secretKey: credential.token,
            deviceId,
          }),
        };
      }

      // Rotate → token mới (string hoặc object { token })
      const newToken =
        typeof rotate === 'string'
          ? rotate
          : (rotate as { token?: string })?.token;

      if (!newToken) {
        logger.warn('[DeepSeek] rotate payload shape unexpected:', rotate);
        return null;
      }

      const newCredential = JSON.stringify({ secretKey: newToken, deviceId });
      logger.info('[DeepSeek] Token rotated successfully');
      return { token: newToken, rotated: true, newCredential };
    } catch (e: any) {
      logger.warn('[DeepSeek] check_device request failed:', e?.message || e);
      return null;
    }
  }

  // ─── Profile ─────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const { token } = this.parseCredential(credential);

    try {
      const url = `${BASE_URL}${API_PATHS.USERS_CURRENT}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${token}`,
          [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.MACOS_SAFARI,
        },
      });

      if (response.status === 200 || response.ok) {
        const json =
          (await response.json()) as DeepSeekApiEnvelope<DeepSeekUserInfo>;
        const data = json[API_FIELDS.DATA];
        if (json[API_FIELDS.CODE] === SUCCESS_CODE && data) {
          return {
            email: data[API_FIELDS.EMAIL] || null,
            name: data[API_FIELDS.NAME],
            id: data[API_FIELDS.ID],
          };
        }
        logger.warn('[DeepSeek] Get Profile response missing data field');
      }
      logger.warn(`[DeepSeek] Get Profile returned status ${response.status}`);
      return { email: null };
    } catch (e) {
      logger.error('[DeepSeek] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { deepseekMethod?: 'basic' | 'google' }) {
    const method = options?.deepseekMethod || DEEPSEEK_AUTH_METHODS.BASIC;
    const loginUrl =
      method === DEEPSEEK_AUTH_METHODS.GOOGLE
        ? GOOGLE_OAUTH_LOGIN_URL
        : `${BASE_URL}/login`;

    const result = await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: DEEPSEEK_EVENTS.LOGIN_TOKEN,
      infoEvent: DEEPSEEK_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          const token = data.cookies;
          let email = data.email;

          // If email is masked (contains ***), fetch real email from profile
          if (
            !email ||
            email.includes(MASKED_EMAIL_INDICATOR) ||
            email.includes(MASKED_EMAIL_CHAR)
          ) {
            const profile = await this.getUserProfile(token);
            email = profile.email || email; // Fallback to masked email if profile fetch fails
          }

          if (email) {
            // Sinh device_id 1 lần, dùng cố định cho các lần check_device sau
            const deviceId = randomUUID();
            const jsonCredential = JSON.stringify({
              secretKey: token,
              deviceId,
            });
            return { isValid: true, cookies: jsonCredential, email };
          }
          logger.warn(
            '[DeepSeek] Login validation failed: could not determine email',
          );
        }
        return { isValid: false };
      },
    });
    return result;
  }

  // ─── Initialization ─────────────────────────────────────────────────

  constructor() {
    this.initWasm();
  }

  private async initWasm() {
    const execDir = path.dirname(process.execPath);
    const possiblePaths = [
      path.resolve(__dirname, WASM_FILENAME),
      path.join(execDir, 'resources', WASM_FILENAME),
      path.join(execDir, WASM_FILENAME),
      path.join(process.cwd(), 'resources', WASM_FILENAME),
      path.join(process.cwd(), WASM_FILENAME),
      path.join(process.cwd(), 'backend', 'src', 'provider', WASM_FILENAME),
      ...(typeof (process as any).resourcesPath !== 'undefined'
        ? [
            path.join(
              (process as any).resourcesPath,
              'resources',
              WASM_FILENAME,
            ),
            path.join(
              (process as any).resourcesPath,
              'app.asar.unpacked',
              'resources',
              WASM_FILENAME,
            ),
          ]
        : []),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.wasmPath = p;
        break;
      }
    }

    if (!this.wasmPath) {
      logger.error(
        `DeepSeek WASM not found. Tried paths: ${JSON.stringify(possiblePaths, null, 2)}`,
      );
    }
  }

  async getDsHash(): Promise<DeepSeekHash> {
    if (this.dsHash) return this.dsHash;
    if (!this.wasmPath) await this.initWasm();
    if (!this.wasmPath || !fs.existsSync(this.wasmPath)) {
      throw new Error('DeepSeek WASM file not found');
    }
    this.dsHash = new DeepSeekHash(this.wasmPath);
    await this.dsHash.init();
    return this.dsHash;
  }

  // ─── Continue Incomplete Response ──────────────────────────────────

  private async continueIncompleteResponse(
    client: HttpClient,
    sessionId: string,
    responseMessageId: number,
  ): Promise<NodeFetchResponse> {
    const continuePayload: ContinuePayload = {
      chat_session_id: sessionId,
      message_id: responseMessageId,
      fallback_to_resume: true,
    };

    const response = await client.post(
      API_PATHS.CHAT_CONTINUE,
      continuePayload,
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `DeepSeek /chat/continue returned ${response.status}: ${errText}`,
      );
    }

    return response;
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
    } = options;
    const parsedCred = this.parseCredential(credential);
    let token = parsedCred.token;

    const baseHeaders = {
      [HTTP_HEADER_NAMES.COOKIE]: `${COOKIE_CONFIG.AUTH_TOKEN_NAME}=${token}`,
      [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${token}`,
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.LINUX_CHROME,
      [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES.X_APP_VERSION]: HTTP_HEADERS.X_APP_VERSION,
      [HTTP_HEADER_NAMES.X_CLIENT_VERSION]: HTTP_HEADERS.X_CLIENT_VERSION,
      [HTTP_HEADER_NAMES.X_CLIENT_PLATFORM]: HTTP_HEADERS.X_CLIENT_PLATFORM,
      [HTTP_HEADER_NAMES.X_CLIENT_LOCALE]: HTTP_HEADERS.X_CLIENT_LOCALE,
      [HTTP_HEADER_NAMES.X_CLIENT_BUNDLE_ID]: HTTP_HEADERS.X_CLIENT_BUNDLE_ID,
      [HTTP_HEADER_NAMES.X_CLIENT_TIMEZONE_OFFSET]:
        HTTP_HEADERS.X_CLIENT_TIMEZONE_OFFSET,
    };

    const client = new HttpClient({
      baseURL: BASE_URL,
      headers: baseHeaders,
    });

    let sessionId: string | undefined = options.conversationId;

    const isUUID = (str?: string) =>
      str ? REGEX_PATTERNS.UUID.test(str) : false;

    if (sessionId && !isUUID(sessionId)) {
      logger.warn(
        `[DeepSeek] Provided conversationId '${sessionId}' is not a valid UUID. Resetting.`,
      );
      sessionId = undefined;
    }

    let currentModel = model;

    try {
      let needsNewSession = !sessionId;

      if (sessionId && messages.length > 1) {
        const lastMsgId = await this.getLastMessageId(client, sessionId);
        if (lastMsgId === null) {
          needsNewSession = true;
        }
      } else {
        needsNewSession = true;
      }

      if (needsNewSession) {
        // Tạo UUID ngẫu nhiên để dùng trong Referer header
        const newSessionUUID = randomUUID();

        // Tạo client với Referer header chứa UUID mới
        const sessionClient = new HttpClient({
          baseURL: BASE_URL,
          headers: {
            ...baseHeaders,
            [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_SESSION_PREFIX}${newSessionUUID}`,
          },
        });

        const sessionRes = await sessionClient.post(
          API_PATHS.CHAT_SESSION_CREATE,
          {
            [API_FIELDS.CHARACTER_ID]: null,
          },
        );

        let sessionData = (await sessionRes.json()) as DeepSeekApiEnvelope<{
          chat_session: { id: string };
          id: string;
        }>;

        // Reactive token renew: nếu server trả 40003 (auth failed) → thử
        // gọi check_device một lần. Nếu rotate thành công → retry session create.
        if (
          Number(sessionData?.[API_FIELDS.CODE]) ===
          DEEPSEEK_ERROR_CODES.AUTHORIZATION_FAILED
        ) {
          logger.warn(
            '[DeepSeek] 40003 detected on session create, attempting token renew...',
          );

          const renewed = await this.renewTokenIfPossible(parsedCred);
          if (!renewed) {
            throw new Error(
              'DeepSeek token expired and cannot be renewed. Re-login required.',
            );
          }

          // Persist credential mới (nếu caller cung cấp hook)
          if (options.onCredentialRotated) {
            try {
              await options.onCredentialRotated(renewed.newCredential);
            } catch (persistErr: any) {
              logger.warn(
                '[DeepSeek] onCredentialRotated callback failed:',
                persistErr?.message || persistErr,
              );
            }
          }

          token = renewed.token;

          // Tạo lại client với token mới
          const retryClient = new HttpClient({
            baseURL: BASE_URL,
            headers: {
              ...baseHeaders,
              [HTTP_HEADER_NAMES.COOKIE]: `${COOKIE_CONFIG.AUTH_TOKEN_NAME}=${token}`,
              [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${token}`,
              [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_SESSION_PREFIX}${newSessionUUID}`,
            },
          });

          const retryRes = await retryClient.post(
            API_PATHS.CHAT_SESSION_CREATE,
            {
              [API_FIELDS.CHARACTER_ID]: null,
            },
          );

          sessionData =
            (await retryRes.json()) as typeof sessionData;

          if (
            Number(sessionData?.[API_FIELDS.CODE]) ===
            DEEPSEEK_ERROR_CODES.AUTHORIZATION_FAILED
          ) {
            throw new Error(
              `DeepSeek auth still failing after renew (code: ${sessionData?.[API_FIELDS.CODE]}). Re-login required.`,
            );
          }
        }

        // Check for API error code (40003 = authorization failed, etc.)
        if (sessionData?.[API_FIELDS.CODE] !== SUCCESS_CODE) {
          const errorMsg = sessionData?.[API_FIELDS.MSG] || 'Unknown error';
          const errorCode = sessionData?.[API_FIELDS.CODE] || 'unknown';
          throw new Error(
            `Failed to create chat session (code: ${errorCode}): ${errorMsg}`,
          );
        }

        if (!sessionRes.ok) {
          throw new Error(
            `Failed to create chat session: HTTP ${sessionRes.status}`,
          );
        }

        // Lấy session ID thực từ response body
        sessionId =
          sessionData?.[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
            API_FIELDS.CHAT_SESSION
          ]?.[API_FIELDS.ID] ||
          sessionData?.[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
            API_FIELDS.ID
          ];

        if (!sessionId) {
          throw new Error(
            `Session ID missing from response: ${JSON.stringify(sessionData)}`,
          );
        }
      }

      if (!sessionId) throw new Error('Failed to obtain session ID');
      currentModel = model;

      if (onSessionCreated) onSessionCreated(sessionId);
      if (onMetadata) {
        onMetadata({ conversation_id: sessionId });
      }

      let parentMessageId: string | null | undefined = undefined;
      if (options.parent_message_id) {
        parentMessageId = options.parent_message_id;
      } else if (options.conversationId) {
        parentMessageId = await this.getLastMessageId(client, sessionId);
      }

      // ── PoW Challenge ──────────────────────────────────────────────────
      const challengeClient = new HttpClient({
        baseURL: BASE_URL,
        headers: {
          ...baseHeaders,
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_SESSION_PREFIX}${sessionId}`,
        },
      });

      const challengeRes = await challengeClient.post(
        API_PATHS.CHAT_CREATE_POW_CHALLENGE,
        { target_path: API_PATHS.CHAT_COMPLETION },
      );
      let powResponseBase64 = '';
      if (challengeRes.ok) {
        try {
          const rawText = await challengeRes.text();
          const challengeJson = JSON.parse(rawText) as DeepSeekApiEnvelope<{
            challenge: PoWChallenge;
          }>;
          const challengeData: PoWChallenge | undefined =
            challengeJson?.[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
              API_FIELDS.CHALLENGE
            ];
          if (challengeData) {
            const dsHash = await this.getDsHash();
            const powAnswer = await solvePoW(dsHash, challengeData);
            powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
              'base64',
            );
          }
        } catch (e) {
          logger.warn(
            `[DeepSeek] Failed to parse PoW challenge response | session=${sessionId}`,
          );
        }
      }

      // Determine model_type based on conversation state:
      // - First message (no parent): model_type = null
      // - Subsequent messages: model_type = "default"
      const isFirstMessage = !parentMessageId;

      const requestPayload: ChatPayload = {
        chat_session_id: sessionId,
        parent_message_id: parentMessageId || null || undefined,
        model_type: isFirstMessage ? null : MODEL_TYPES.DEFAULT,
        prompt: messages[messages.length - 1].content,
        ref_file_ids: (options.ref_file_ids || []).map((item) =>
          typeof item === 'string' ? item : item.file_id,
        ),
        thinking_enabled:
          options.thinking ?? !!MODELS.find((m) => m.id === model)?.is_thinking,
        search_enabled: options.search || false,
        action: null,
        preempt: false,
      };

      const completionClient = new HttpClient({
        baseURL: BASE_URL,
        headers: {
          ...baseHeaders,
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_SESSION_PREFIX}${sessionId}`,
          [HTTP_HEADER_NAMES.X_DS_POW_RESPONSE]: powResponseBase64,
        },
      });

      const response = await completionClient.post(
        API_PATHS.CHAT_COMPLETION,
        requestPayload,
      );

      // If response is JSON instead of SSE, log the error
      if (response.headers.get('content-type')?.includes('application/json')) {
        const jsonResponse = await response.text();
        logger.error(
          '[DeepSeek] Received JSON instead of SSE stream:',
          jsonResponse,
        );
        throw new Error(`DeepSeek returned JSON error: ${jsonResponse}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API returned ${response.status}: ${errorText}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const promptTokens = countMessagesTokens(messages);
      const completionTokensRef = { value: 0 };
      const currentModeRef: { value: 'THINK' | 'RESPONSE' } = {
        value: SSE_FRAGMENT_TYPES.RESPONSE,
      };

      const continueClient = new HttpClient({
        baseURL: BASE_URL,
        headers: {
          ...baseHeaders,
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_SESSION_PREFIX}${sessionId}`,
        },
      });

      let { incomplete, responseMessageId, accumulatedContent } =
        await parseSSEStream(response.body as NodeJS.ReadableStream, {
          onContent,
          onThinking,
          onMetadata,
          onRaw,
          sessionId,
          promptTokens,
          completionTokensRef,
          currentModeRef,
        });

      let continuationCount = 0;

      while (
        incomplete &&
        responseMessageId !== null &&
        continuationCount < MAX_CONTINUATIONS
      ) {
        continuationCount++;

        if (onMetadata) {
          onMetadata({
            continuing: true,
            continuation_count: continuationCount,
          });
        }

        let continueResponse: NodeFetchResponse;
        try {
          continueResponse = await this.continueIncompleteResponse(
            continueClient,
            sessionId,
            responseMessageId,
          );
        } catch (continueErr: any) {
          logger.error(
            `[DeepSeek] /chat/continue failed: ${continueErr.message}`,
          );
          break;
        }

        if (!continueResponse.body) {
          logger.warn('[DeepSeek] /chat/continue returned no body, stopping');
          break;
        }

        const continueResult = await parseSSEStream(
          continueResponse.body as unknown as NodeJS.ReadableStream,
          {
            onContent,
            onThinking,
            onMetadata,
            onRaw,
            sessionId,
            promptTokens,
            completionTokensRef,
            currentModeRef,
            priorContentLength: accumulatedContent.length,
          },
        );

        accumulatedContent += continueResult.accumulatedContent;
        incomplete = continueResult.incomplete;
        if (continueResult.responseMessageId !== null) {
          responseMessageId = continueResult.responseMessageId;
        }
      }

      if (continuationCount >= MAX_CONTINUATIONS && incomplete) {
        logger.warn(
          `[DeepSeek] Max continuations reached | session=${sessionId}`,
        );
      }

      if (continuationCount > 0 && onMetadata) {
        onMetadata({
          continuing: false,
          continuation_complete: true,
          total_continuations: continuationCount,
        });
      }

      onDone();
    } catch (err: any) {
      logger.error('[DeepSeek] handleMessage error:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        status: err.status,
        sessionId: sessionId || 'unknown',
        model: currentModel || 'unknown',
      });
      onError(err);
    }
  }

  // ─── History ─────────────────────────────────────────────────────────

  private async getLastMessageId(
    client: HttpClient,
    sessionId: string,
  ): Promise<string | null> {
    try {
      const res = await client.get(
        `${API_PATHS.CHAT_HISTORY_MESSAGES}?chat_session_id=${sessionId}&count=${HISTORY_MESSAGES_COUNT}`,
      );
      if (res.ok) {
        const data = (await res.json()) as DeepSeekApiEnvelope<{
          chat_messages: DeepSeekChatMessage[];
        }>;
        const messages: DeepSeekChatMessage[] =
          data?.[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
            API_FIELDS.CHAT_MESSAGES
          ] || [];
        const lastAssistant = [...messages]
          .reverse()
          .find(
            (m) =>
              m[API_FIELDS.ROLE] &&
              m[API_FIELDS.ROLE].toUpperCase() === ROLE_VALUES.ASSISTANT,
          );
        return lastAssistant?.[API_FIELDS.MESSAGE_ID] || null;
      }
      logger.warn(
        `[DeepSeek] Failed to fetch history messages: HTTP ${res.status}`,
      );
    } catch (e) {
      logger.warn('[DeepSeek] Failed to fetch last message ID:', e);
    }
    return null;
  }

  // ─── Stop Stream ────────────────────────────────────────────────────

  async stopStream(credential: string, chatId: string, messageId: string) {
    const { token } = this.parseCredential(credential);
    const client = this.createClient(token);
    await client.post(API_PATHS.CHAT_STOP_GENERATION, {
      chat_session_id: chatId,
      current_message_id: messageId,
    });
  }

  // ─── File Upload ────────────────────────────────────────────────────

  async uploadFile(
    credential: string,
    file: UploadFileInput,
  ): Promise<{ id: string; token_usage: number }> {
    const { token } = this.parseCredential(credential);
    return deepseekUploadFile(token, file, () => this.getDsHash());
  }

  // ─── HTTP Client ────────────────────────────────────────────────────

  private createClient(token: string) {
    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        [HTTP_HEADER_NAMES.COOKIE]: `${COOKIE_CONFIG.AUTH_TOKEN_NAME}=${token}`,
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${token}`,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.MACOS_SAFARI,
      },
    });
  }
}

export default new DeepSeekProvider();
