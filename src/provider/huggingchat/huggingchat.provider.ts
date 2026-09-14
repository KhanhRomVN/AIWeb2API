/**
 * ------------------------------------------------------------------
 * HuggingChat Provider
 * ------------------------------------------------------------------
 * Provider implementation cho HuggingChat (Hugging Face).
 * Hỗ trợ login qua browser, chat completion với streaming,
 * thinking mode, và lấy danh sách models từ API.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và capture cookies
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ API
 * - getUserProfile() : Lấy thông tin user profile
 * - Thinking mode    : Hỗ trợ <think> tags trong response
 *
 * Credential format:
 * - cookies          : Cookie string (chứa session cookies)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';

// ── HuggingChat Constants ──
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  HUGGINGCHAT_EVENTS,
  USER_AGENT,
  API_FIELDS,
  API_PATHS,
  CONTENT_TYPES,
  ESCAPE_SEQUENCES,
  FORM_CONFIG,
  HTTP_HEADER_NAMES,
  HTTP_HEADERS,
  LOGIN_CONFIG,
  PAYLOAD_DEFAULTS,
  STREAM_TYPES,
  THINK_TAGS,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
} from './huggingchat.constant';

// ── HuggingChat Types ──
import {
  HuggingChatConversationCreateRequest,
  HuggingChatConversationCreateResponse,
  HuggingChatConversationDetails,
  HuggingChatModelEntry,
  HuggingChatModelOutput,
  HuggingChatModelsResponse,
  HuggingChatSSEChunk,
  HuggingChatStreamPayload,
  HuggingChatUserInfo,
  HuggingChatUserResponse,
} from './huggingchat.types';

// ── HuggingChat Internal ──
import { proxyHandler } from './huggingchat.proxy-handler';
import { parseSSEStream } from './huggingchat.sse-parser';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('HuggingChatProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class HuggingChatProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ────────────────────────────────────────
  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
  };

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    let capturedEmail = '';

    const onLoginData = (email: string) => {
      capturedEmail = email;
    };

    proxyEvents.on(HUGGINGCHAT_EVENTS.LOGIN_DATA, onLoginData);

    try {
      return await loginService.captureCredentialsViaCDP({
        providerId: PROVIDER_ID,
        loginUrl: `${BASE_URL}${API_PATHS.CHAT_LOGIN}`,
        partition: `${LOGIN_CONFIG.PARTITION_PREFIX}${Date.now()}`,
        cookieEvent: HUGGINGCHAT_EVENTS.COOKIES,
        infoEvent: HUGGINGCHAT_EVENTS.LOGIN_DATA,
        extraEvents: [HUGGINGCHAT_EVENTS.LOGIN_DATA],
        validate: async (data: {
          cookies: string;
          headers?: Record<string, string>;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          let identityEmail = '';
          let apiEmail = '';

          try {
            const profile = await this.getUserProfile(data.cookies);
            if (profile.email) {
              apiEmail = profile.email;
            }
          } catch (e) {
            logger.warn('[HuggingChat] Chat API verify failed:', e);
          }

          if (capturedEmail) {
            identityEmail = capturedEmail;
          } else if (apiEmail) {
            identityEmail = apiEmail;
          }

          if (identityEmail) {
            return {
              isValid: true,
              cookies: data.cookies,
              email: identityEmail,
            };
          }
          logger.warn(
            '[HuggingChat] Login validation failed: could not determine email',
          );
          return { isValid: false };
        },
      });
    } finally {
      proxyEvents.off(HUGGINGCHAT_EVENTS.LOGIN_DATA, onLoginData);
    }
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(credential: string): Promise<HuggingChatUserInfo> {
    try {
      const response = await fetch(`${BASE_URL}${API_PATHS.CHAT_USER}`, {
        headers: {
          [HTTP_HEADER_NAMES.COOKIE]: credential,
          [HTTP_HEADER_NAMES.USER_AGENT]: HTTP_HEADERS.USER_AGENT_SHORT,
          [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
        },
      });

      if (response.ok) {
        const chatUser = (await response.json()) as HuggingChatUserResponse;
        if (!chatUser.email && !chatUser.username) {
          logger.warn(
            '[HuggingChat] Get Profile response missing email/username',
          );
        }
        return {
          email:
            chatUser.email ||
            (chatUser.username
              ? `${chatUser.username}${LOGIN_CONFIG.EMAIL_SUFFIX}`
              : null),
        };
      }
      logger.warn(
        `[HuggingChat] Get Profile returned status ${response.status}`,
      );
      return { email: null };
    } catch (e) {
      logger.error('[HuggingChat] Get Profile Error:', e);
      return { email: null };
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
    } = options;

    const cookieHeader = credential;
    const client = this.createClient(cookieHeader);

    try {
      let conversationId = options.conversationId;
      if (!conversationId) {
        const createBody: HuggingChatConversationCreateRequest = {
          model: model,
          preprompt: PAYLOAD_DEFAULTS.PREPROMPT,
        };
        const createRes = await client.post(
          API_PATHS.CHAT_CONVERSATION,
          createBody,
        );
        const createData =
          (await createRes.json()) as HuggingChatConversationCreateResponse;
        conversationId = createData[API_FIELDS.CONVERSATION_ID];
      }

      if (!conversationId) throw new Error('Failed to obtain conversation ID');

      const detailRes = await client.get(
        `${API_PATHS.CHAT_CONVERSATIONS}/${conversationId}`,
      );
      const detail = (await detailRes.json()) as HuggingChatConversationDetails;
      const details = detail[API_FIELDS.JSON] || detail;

      let parentMessageId = '';
      const detailsMessages = details[API_FIELDS.MESSAGES];
      const detailsRootId = details[API_FIELDS.ROOT_MESSAGE_ID];
      if (detailsMessages && detailsMessages.length > 0) {
        parentMessageId =
          detailsMessages[detailsMessages.length - 1][API_FIELDS.ID];
      } else if (detailsRootId) {
        parentMessageId = detailsRootId;
      } else {
        parentMessageId = crypto.randomUUID();
      }

      const lastMessage = messages[messages.length - 1];
      const boundary =
        FORM_CONFIG.BOUNDARY_PREFIX +
        crypto
          .randomBytes(FORM_CONFIG.BOUNDARY_RANDOM_BYTES)
          .toString('hex');

      const payload: HuggingChatStreamPayload = {
        inputs: lastMessage.content,
        id: parentMessageId,
        is_retry: PAYLOAD_DEFAULTS.IS_RETRY,
        is_continue: PAYLOAD_DEFAULTS.IS_CONTINUE,
        selectedMcpServerNames: [],
        selectedMcpServers: [],
      };

      const formData =
        `--${boundary}${FORM_CONFIG.CRLF}` +
        `Content-Disposition: form-data; name="${FORM_CONFIG.FIELD_NAME}"${FORM_CONFIG.CRLF}${FORM_CONFIG.CRLF}` +
        `${JSON.stringify(payload)}${FORM_CONFIG.CRLF}--${boundary}--${FORM_CONFIG.CRLF}`;
      const formBuffer = Buffer.from(formData, 'utf-8');

      const conversationUrl = `${BASE_URL}${API_PATHS.CHAT_CONVERSATION}/${conversationId}`;
      const response = await fetch(conversationUrl, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.COOKIE]: cookieHeader,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: `${CONTENT_TYPES.MULTIPART_PREFIX}${boundary}`,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
          [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
          [HTTP_HEADER_NAMES.REFERER]: conversationUrl,
        },
        body: formBuffer,
      });

      if (!response.body) throw new Error('No response body');

      const promptTokens = countMessagesTokens(messages);
      const completionTokensRef = { value: 0 };

      if (onMetadata)
        onMetadata({
          conversation_id: conversationId,
          total_token: promptTokens,
        });

      await parseSSEStream(response.body, {
        onContent,
        onThinking,
        onMetadata,
        promptTokens,
        completionTokensRef,
      });

      onDone();
    } catch (err: any) {
      logger.error('[HuggingChat] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<HuggingChatModelOutput[]> {
    try {
      const client = this.createClient(credential);
      const res = await client.get(API_PATHS.CHAT_MODELS);
      const data = (await res.json()) as
        | HuggingChatModelEntry[]
        | HuggingChatModelsResponse;
      const modelsList: HuggingChatModelEntry[] = Array.isArray(data)
        ? data
        : data[API_FIELDS.JSON] || data[API_FIELDS.MODELS] || [];

      return modelsList.map((model) => {
        let contextLength: number | null = null;
        const providers = model[API_FIELDS.PROVIDERS];
        if (providers && Array.isArray(providers)) {
          for (const provider of providers) {
            const ctx = provider[API_FIELDS.CONTEXT_LENGTH];
            if (ctx) {
              contextLength = ctx;
              break;
            }
          }
        }
        return {
          id: model[API_FIELDS.ID],
          name:
            model[API_FIELDS.DISPLAY_NAME] ||
            model[API_FIELDS.NAME] ||
            model[API_FIELDS.ID],
          is_thinking: false,
          max_context_length: contextLength,
        };
      });
    } catch (error) {
      logger.error('Error fetching models from HuggingChat API:', error);
      return [];
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private createClient(cookie: string) {
    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        [HTTP_HEADER_NAMES.COOKIE]: cookie,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
    });
  }
}

export default new HuggingChatProvider();