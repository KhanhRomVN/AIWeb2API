/**
 * ------------------------------------------------------------------
 * Mistral Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Mistral AI API.
 * Hỗ trợ login qua browser và chat completion với streaming.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getUserProfile() : Lấy thông tin user profile
 *
 * Credential format:
 * - cookies          : Cookie string (chứa session cookies)
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

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Mistral Imports ──
import { proxyHandler } from './mistral.proxy-handler';
import { parseSSEStream } from './mistral.sse-parser';
import { MistralChatPayload, MistralUserProfile } from './mistral.types';
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
  CHAT_BASE_URL,
  AUTH_LOGIN_URL,
  MISTRAL_EVENTS,
  API_PATHS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  USER_AGENTS,
  CHAT_MODES,
  MESSAGE_INPUT_TYPES,
  DEFAULT_FEATURES,
  LOGIN_PARTITION_PREFIX,
  DEFAULT_TIMEZONE,
  DEFAULT_STABLE_ID,
  API_FIELDS,
} from './mistral.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('MistralProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class MistralProvider implements Provider {
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
  };

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl: AUTH_LOGIN_URL,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: MISTRAL_EVENTS.COOKIES,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies && data.cookies.length > 0) {
          const profile = await this.getUserProfile(data.cookies);
          if (profile.email) {
            return {
              isValid: true,
              email: profile.email,
              cookies: data.cookies,
            };
          }
          logger.warn(
            '[Mistral] Login validation failed: could not determine email',
          );
        }
        return { isValid: false };
      },
    });
  }

  // ─── Profile ──────────────────────���─────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const response = await fetch(`${BASE_URL}${API_PATHS.USERS_ME}`, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.COOKIE]: credential,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.PROFILE,
          [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
        },
      });

      if (response.status === 200) {
        const json = (await response.json()) as MistralUserProfile;
        if (!json[API_FIELDS.EMAIL]) {
          logger.warn('[Mistral] Get Profile response missing email field');
        }
        return {
          email: json[API_FIELDS.EMAIL] || null,
          name: json[API_FIELDS.NAME] || json[API_FIELDS.FULL_NAME],
          id: json[API_FIELDS.ID],
        };
      }
      logger.warn(`[Mistral] Get Profile returned status ${response.status}`);
      return { email: null };
    } catch (e) {
      logger.error('[Mistral] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      onContent,
      onMetadata,
      onDone,
      onError,
      conversationId,
    } = options;

    try {
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content;

      if (!conversationId) {
        await this.streamMistral(
          credential,
          conversationId!,
          CHAT_MODES.START,
          null,
          onContent,
          onDone,
          onError,
        );
      } else {
        await this.streamMistral(
          credential,
          conversationId!,
          CHAT_MODES.APPEND,
          content,
          onContent,
          onDone,
          onError,
        );
      }
    } catch (error) {
      logger.error('Error sending Mistral message', error);
      onError(error);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Stream Helper ──────────────────────────────────────────────────

  private async streamMistral(
    credential: string,
    chatId: string,
    mode: 'start' | 'append',
    content: string | null,
    onContent: (c: string) => void,
    onDone: () => void,
    onError: (e: Error) => void,
  ) {
    const payload: MistralChatPayload = {
      chatId: chatId,
      mode: mode,
      disabledFeatures: [],
      clientPromptData: {
        currentDate: new Date().toISOString().split('T')[0],
        userTimezone: DEFAULT_TIMEZONE,
      },
      stableAnonymousIdentifier: DEFAULT_STABLE_ID,
      shouldAwaitStreamBackgroundTasks: true,
      shouldUseMessagePatch: true,
      shouldUsePersistentStream: true,
    };

    if (mode === CHAT_MODES.APPEND && content) {
      payload.messageInput = [
        { type: MESSAGE_INPUT_TYPES.TEXT, text: content },
      ];
      payload.messageFiles = [];
      payload.messageId = crypto.randomUUID();
      payload.features = DEFAULT_FEATURES;
      payload.libraries = [];
      payload.integrations = [];
    }

    const response = await fetch(`${CHAT_BASE_URL}${API_PATHS.CHAT}`, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.STREAM,
        [HTTP_HEADER_NAMES.COOKIE]: credential,
        [HTTP_HEADER_NAMES.ORIGIN]: CHAT_BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${CHAT_BASE_URL}${REFERER_PATHS.CHAT_PREFIX}${chatId}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok)
      throw new Error(`Mistral Stream Error ${response.status}`);

    if (response.body) {
      await parseSSEStream(response.body as NodeJS.ReadableStream, {
        onContent,
      });
      onDone();
    } else {
      onDone();
    }
  }
}

export default new MistralProvider();