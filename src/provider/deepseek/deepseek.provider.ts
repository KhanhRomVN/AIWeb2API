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
 * Credential format:
 * - token               : Bearer access token (JWT)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as path from 'path';
import fetch, { Response as NodeFetchResponse } from 'node-fetch';

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
  UploadFileInput,
} from './deepseek.types';
import { DeepSeekHash, solvePoW } from './deepseek.pow';
import { proxyHandler } from './deepseek.proxy-handler';
import { parseSSEStream } from './deepseek.sse-parser';
import { deepseekUploadFile } from './deepseek.upload';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
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
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Profile ─────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const url = `${BASE_URL}${API_PATHS.USERS_CURRENT}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${credential}`,
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

    return await loginService.captureCredentialsViaCDP({
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
            return { isValid: true, cookies: token, email };
          }
          logger.warn(
            '[DeepSeek] Login validation failed: could not determine email',
          );
        }
        return { isValid: false };
      },
    });
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

    const baseHeaders = {
      [HTTP_HEADER_NAMES.COOKIE]: `${COOKIE_CONFIG.AUTH_TOKEN_NAME}=${credential}`,
      [HTTP_HEADER_NAMES.AUTHORIZATION]: credential,
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.LINUX_CHROME,
      [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES.X_APP_VERSION]: HTTP_HEADERS.X_APP_VERSION,
      [HTTP_HEADER_NAMES.X_CLIENT_VERSION]: HTTP_HEADERS.X_CLIENT_VERSION,
      [HTTP_HEADER_NAMES.X_CLIENT_PLATFORM]: HTTP_HEADERS.X_CLIENT_PLATFORM,
      [HTTP_HEADER_NAMES.X_CLIENT_LOCALE]: HTTP_HEADERS.X_CLIENT_LOCALE,
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
        const sessionRes = await client.post(API_PATHS.CHAT_SESSION_CREATE, {
          [API_FIELDS.CHARACTER_ID]: null,
        });
        if (!sessionRes.ok) {
          const errText = await sessionRes.text();
          throw new Error(
            `Failed to create chat session: ${sessionRes.status} - ${errText}`,
          );
        }
        const sessionData = (await sessionRes.json()) as DeepSeekApiEnvelope<{
          chat_session: { id: string };
          id: string;
        }>;
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
          const challengeJson = JSON.parse(
            rawText,
          ) as DeepSeekApiEnvelope<{ challenge: PoWChallenge }>;
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

      const requestPayload: ChatPayload = {
        chat_session_id: sessionId,
        parent_message_id: parentMessageId || null || undefined,
        model_type: MODEL_TYPES.DEFAULT,
        prompt: messages[messages.length - 1].content,
        ref_file_ids: options.ref_file_ids || [],
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
    const client = this.createClient(credential);
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
    return deepseekUploadFile(credential, file, () => this.getDsHash());
  }

  // ─── HTTP Client ────────────────────────────────────────────────────

  private createClient(credential: string) {
    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        [HTTP_HEADER_NAMES.COOKIE]: `${COOKIE_CONFIG.AUTH_TOKEN_NAME}=${credential}`,
        [HTTP_HEADER_NAMES.AUTHORIZATION]: credential,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.MACOS_SAFARI,
      },
    });
  }
}

export default new DeepSeekProvider();
