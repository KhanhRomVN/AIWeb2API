/**
 * ------------------------------------------------------------------
 * Groq Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Groq API.
 * Hỗ trợ login qua browser, chat completion với streaming,
 * và lấy danh sách models từ API.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và capture cookie
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ API
 * - getUserProfile() : Lấy email từ JWT trong cookie
 *
 * Credential format:
 * - cookies          : Cookie string (chứa stytch_session_jwt)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Groq Imports ──
import { proxyHandler } from './groq.proxy-handler';
import { parseSSEStream } from './groq.sse-parser';
import {
  GroqChatPayload,
  GroqJwtPayload,
  GroqModelInfo,
  GroqModelRaw,
} from './groq.types';
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
  API_CHAT_COMPLETIONS_URL,
  API_MODELS_URL,
  SESSION_COOKIE_NAME,
  PREFERENCES_ORG_KEY,
  BEARER_PREFIX,
  DEFAULT_LOGIN_PATH,
  LOGIN_PARTITION_PREFIX,
  JWT_SESSION_CLAIM,
  JWT_AUTH_FACTORS_KEY,
  JWT_EMAIL_FACTOR_KEY,
  JWT_EMAIL_ADDRESS_KEY,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  USER_AGENT,
  API_FIELDS,
  GROQ_EVENTS,
  REGEX_PATTERNS,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
} from './groq.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GroqProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class GroqProvider implements Provider {
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
    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl: `${BASE_URL}${DEFAULT_LOGIN_PATH}`,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: GROQ_EVENTS.COOKIES,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (!data.cookies) return { isValid: false };
        const email = this.extractEmailFromSessionCookie(data.cookies);
        if (!email) {
          logger.warn('[Groq] Login: no email found in session JWT');
        }
        return { isValid: true, cookies: JSON.stringify({ cookies: data.cookies }), email };
      },
    });
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const email = this.extractEmailFromSessionCookie(credential);
    if (!email) {
      logger.warn('[Groq] Get Profile: no email found in session JWT');
    }
    return { email };
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      temperature,
      onContent,
      onDone,
      onError,
    } = options;

    const payload: GroqChatPayload = {
      model: model,
      messages: messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      stream: true,
    };

    if (typeof temperature === 'number') {
      payload.temperature = temperature;
    }

    try {
      const response = await fetch(API_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.COOKIE]: credential,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Public API failed with cookies: ${response.status}`);
        throw new Error(`Groq API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      await parseSSEStream(response.body, {
        onContent,
      });

      onDone();
    } catch (err: any) {
      logger.error('Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<GroqModelInfo[]> {
    try {
      let token = '';
      const match = credential.match(REGEX_PATTERNS.SESSION_COOKIE);
      if (match && match[1]) {
        token = match[1];
      }

      if (!token && !credential.includes('=')) {
        token = credential;
      }

      if (!token) {
        logger.warn('No session token found in credentials for Groq');
        return [];
      }

      let organization = '';
      const preferencesMatch = credential.match(
        REGEX_PATTERNS.PREFERENCES_COOKIE,
      );
      if (preferencesMatch && preferencesMatch[1]) {
        try {
          const preferences = JSON.parse(
            decodeURIComponent(preferencesMatch[1]),
          );
          organization = preferences[PREFERENCES_ORG_KEY];
        } catch (e) {
          logger.warn('Failed to parse user-preferences from cookie', e);
        }
      }

      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${BEARER_PREFIX}${token}`,
        [HTTP_HEADER_NAMES.COOKIE]: credential,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
      };

      if (organization) {
        headers[HTTP_HEADER_NAMES.GROQ_ORGANIZATION] = organization;
      }

      const response = await fetch(API_MODELS_URL, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Groq Models API returned ${response.status}: ${errorText}`,
        );
        return [];
      }

      const json = (await response.json()) as { data?: GroqModelRaw[] };
      const modelsData = json[API_FIELDS.DATA] || [];

      if (!Array.isArray(modelsData)) {
        logger.warn('[Groq] Models API returned invalid format');
        return [];
      }

      return modelsData
        .filter((model) => model[API_FIELDS.ACTIVE] !== false)
        .map<GroqModelInfo>((model) => ({
          id: model[API_FIELDS.ID],
          name:
            model[API_FIELDS.METADATA]?.[API_FIELDS.DISPLAY_NAME] ||
            model[API_FIELDS.ID],
          description: model[API_FIELDS.METADATA]?.[API_FIELDS.MODEL_CARD],
          max_context_length: model[API_FIELDS.CONTEXT_WINDOW],
          is_thinking:
            model[API_FIELDS.FEATURES]?.[API_FIELDS.REASONING] === true,
        }));
    } catch (e: any) {
      logger.error('Error fetching Groq models:', e);
      return [];
    }
  }

  // ─── Utility Methods ────────────────────────────────────────────────

  /**
   * Giải mã JWT trong cookie `stytch_session_jwt` để lấy email.
   * Trả `null` nếu không tìm thấy cookie hoặc payload không đúng shape.
   */
  private extractEmailFromSessionCookie(cookie: string): string | null {
    try {
      const cookieList = cookie.split(';').map((c) => {
        const parts = c.trim().split('=');
        return { name: parts[0], value: parts.slice(1).join('=') };
      });

      const sessionJwt = cookieList.find(
        (c) => c.name === SESSION_COOKIE_NAME,
      )?.value;
      if (!sessionJwt) return null;

      const base64Url = sessionJwt.split('.')[1];
      const base64 = base64Url
        .replace(REGEX_PATTERNS.BASE64URL_DASH, '+')
        .replace(REGEX_PATTERNS.BASE64URL_UNDERSCORE, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      const payload = JSON.parse(jsonPayload) as GroqJwtPayload;
      const session = payload[JWT_SESSION_CLAIM];
      const email =
        session?.[JWT_AUTH_FACTORS_KEY]?.[0]?.[JWT_EMAIL_FACTOR_KEY]?.[
          JWT_EMAIL_ADDRESS_KEY
        ];
      return email || null;
    } catch (e) {
      logger.warn('[Groq] Failed to extract email from JWT:', e);
      return null;
    }
  }
}

export default new GroqProvider();