/**
 * ------------------------------------------------------------------
 * Claude Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Claude AI API.
 * Hỗ trợ login qua browser (basic/google), chat completion,
 * và lấy thông tin user profile.
 *
 * Main features:
 * - login()           : Đăng nhập qua browser
 * - handleMessage()   : Gửi tin nhắn với streaming response
 * - getUserProfile()      : Lấy thông tin user profile
 *
 * Credential format:
 * - cookies          : Cookie string (chứa session token)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';

// ── Claude Imports ──
import { proxyHandler } from './claude.proxy-handler';
import { parseSSEStream } from './claude.sse-parser';
import { ClaudeChatPayload, ClaudeUserProfile } from './claude.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CLAUDE_AUTH_METHODS,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  CLAUDE_EVENTS,
  USER_AGENT,
  GOOGLE_OAUTH_LOGIN_URL,
  API_PATHS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  API_FIELDS,
  DEFAULT_LOGIN_PATH,
  LOGIN_PARTITION_PREFIX,
  MAX_TOKENS,
  MASKED_EMAIL_INDICATOR,
  MASKED_EMAIL_CHAR,
} from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class ClaudeProvider implements Provider {
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
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Get Profile ────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const client = new HttpClient({
        baseURL: BASE_URL,
        headers: {
          [HTTP_HEADER_NAMES.COOKIE]: credential,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        },
      });
      const response = await client.get(API_PATHS.PROFILE);
      if (response.ok) {
        const data = (await response.json()) as ClaudeUserProfile;
        if (!data[API_FIELDS.EMAIL]) {
          logger.warn('[Claude] Get Profile response missing email field');
        }
        return {
          email: data[API_FIELDS.EMAIL] || null,
          name: data[API_FIELDS.NAME],
          id: data[API_FIELDS.ID],
        };
      }
      logger.warn(`[Claude] Get Profile returned status ${response.status}`);
      return { email: null };
    } catch (e) {
      logger.error('[Claude] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { method?: 'basic' | 'google' }) {
    const method = options?.method || CLAUDE_AUTH_METHODS.BASIC;
    const loginUrl =
      method === CLAUDE_AUTH_METHODS.GOOGLE
        ? GOOGLE_OAUTH_LOGIN_URL
        : `${BASE_URL}${DEFAULT_LOGIN_PATH}`;

    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: CLAUDE_EVENTS.LOGIN_TOKEN,
      infoEvent: CLAUDE_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          const token = data.cookies;
          let email = data.email;

          // Nếu email bị mask (chứa *** hoặc *), gọi profile để lấy email thật
          if (
            !email ||
            email.includes(MASKED_EMAIL_INDICATOR) ||
            email.includes(MASKED_EMAIL_CHAR)
          ) {
            const profile = await this.getUserProfile(token);
            email = profile.email || email;
          }

          if (email) {
            return { isValid: true, cookies: token, email };
          }
          logger.warn(
            '[Claude] Login validation failed: could not determine email',
          );
        }
        return { isValid: false };
      },
    });
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onRaw,
      onMetadata,
      onDone,
      onError,
      conversationId,
    } = options;

    const client = new HttpClient({
      baseURL: BASE_URL,
      headers: {
        [HTTP_HEADER_NAMES.COOKIE]: credential,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      },
    });

    try {
      const payload: ClaudeChatPayload = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: MAX_TOKENS,
      };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await client.post(API_PATHS.CHAT, payload);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      await parseSSEStream(response.body, {
        onContent,
        onThinking,
        onRaw,
      });

      onDone();
    } catch (err: any) {
      logger.error('[Claude] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }
}

export default new ClaudeProvider();
