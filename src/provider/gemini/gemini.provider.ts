/**
 * ------------------------------------------------------------------
 * Gemini Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Google Gemini Web API.
 * Hỗ trợ login qua browser, chat completion với nhiều mode
 * (flash, thinking, pro, auto), và tự động lấy XSRF token.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và capture cookies
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getUserProfile() : Lấy thông tin user profile từ HTML
 * - XSRF retry       : Tự động retry với XSRF token từ error response
 * - Model mapping    : Hỗ trợ các mode: FAST, THINKING, PRO, AUTO
 *
 * Credential format (JSON string):
 * - cookies          : Cookie string (chứa SID, __Secure-1PSID)
 * - sapisid          : SAPISID token
 * - xsrfToken        : XSRF token
 * - authUser         : Auth user ID
 * - email (optional) : Email address
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

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { countMessagesTokens } from '../../utils/tokenizer';

// ── Gemini Imports ──
import { GeminiCredential, GeminiModelConfig } from './gemini.types';
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
  USER_AGENT,
  GEMINI_EVENTS,
  GEMINI_AUTH_METHODS,
  MODEL_MAP,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REGEX_PATTERNS,
  DEFAULT_LOGIN_PATH,
  LOGIN_PARTITION_PREFIX,
  COOKIE_NAMES,
  GEMINI_DEFAULT_MODE,
  GEMINI_DEFAULT_THINK,
  MAX_RETRY_ATTEMPTS,
  XSRF_WAIT_MS,
  ERROR_SLICE_LENGTH,
} from './gemini.constant';
import { proxyHandler } from './gemini.proxy-handler';
import { parseSSEStream } from './gemini.sse-parser';
import {
  makeSapisidHash,
  getAccountPrefix,
  buildRequestBody,
  getStreamGenerateUrl,
} from './gemini.helpers';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class GeminiProvider implements Provider {
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

  // ─── Profile ─────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const cred = this.parseCredential(credential);
      const prefix = getAccountPrefix(cred.authUser);
      const url = `${BASE_URL}${prefix}${DEFAULT_LOGIN_PATH}`;
      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
      };
      if (cred.cookies) {
        headers[HTTP_HEADER_NAMES.COOKIE] = cred.cookies;
      }
      if (cred.sapisid) {
        headers[HTTP_HEADER_NAMES.AUTHORIZATION] = makeSapisidHash(
          cred.sapisid,
        );
      }
      if (cred.authUser) {
        headers[HTTP_HEADER_NAMES.X_GOOG_AUTH_USER] = cred.authUser;
      }

      const response = await fetch(url, { method: 'GET', headers });

      if (response.ok) {
        const html = await response.text();
        const emailMatch =
          html.match(REGEX_PATTERNS.EMAIL_IN_HTML) ||
          html.match(REGEX_PATTERNS.USER_EMAIL_IN_HTML);
        if (emailMatch && emailMatch[1]) {
          return { email: emailMatch[1] };
        }
        logger.warn('[Gemini] Get Profile response missing email in HTML');
      } else {
        logger.warn(`[Gemini] Get Profile returned status ${response.status}`);
      }

      if (cred.email) {
        return { email: cred.email };
      }

      return { email: null };
    } catch (e) {
      logger.error('[Gemini] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { method?: 'google' | 'basic' }) {
    const method = options?.method || GEMINI_AUTH_METHODS.GOOGLE;
    const loginUrl = `${BASE_URL}${DEFAULT_LOGIN_PATH}`;

    let validating = false;
    const captured = { xsrfToken: '', authUser: '' };
    const onXsrf = (data: { xsrfToken?: string } | undefined) => {
      if (data?.xsrfToken) captured.xsrfToken = data.xsrfToken;
    };
    const onAuthUser = (data: { authUser?: string } | undefined) => {
      if (data?.authUser) captured.authUser = data.authUser;
    };
    proxyEvents.on(GEMINI_EVENTS.XSRF, onXsrf);
    proxyEvents.on(GEMINI_EVENTS.AUTH_USER, onAuthUser);

    return await loginService
      .captureCredentialsViaCDP({
        providerId: PROVIDER_ID,
        loginUrl,
        partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
        cookieEvent: GEMINI_EVENTS.COOKIES,
        infoEvent: GEMINI_EVENTS.EMAIL,
        extraEvents: [
          GEMINI_EVENTS.SAPISID,
          GEMINI_EVENTS.AUTH_USER,
          GEMINI_EVENTS.XSRF,
        ],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          if (validating) return { isValid: false };
          validating = true;

          try {
            const cookie = data.cookies;
            let email = data.email;

            const sapisidMatch = cookie.match(
              REGEX_PATTERNS.SAPISID_IN_COOKIE,
            );
            const sapisid = sapisidMatch ? sapisidMatch[1] : '';

            if (!email) {
              try {
                const credStr = JSON.stringify({ cookies: cookie, sapisid });
                const profile = await this.getUserProfile(credStr);
                email = profile.email || undefined;
              } catch (e) {
                logger.warn(
                  '[Gemini] Login profile fetch failed, proceeding without email:',
                  e,
                );
              }
            }

            if (!captured.xsrfToken) {
              await new Promise((r) => setTimeout(r, XSRF_WAIT_MS));
            }

            const hasSID =
              cookie.includes(COOKIE_NAMES.SID) &&
              cookie.includes(COOKIE_NAMES.SECURE_1PSID);
            if (hasSID) {
              const credential = JSON.stringify({
                cookies: cookie,
                sapisid,
                xsrfToken: captured.xsrfToken,
                authUser: captured.authUser,
                email: email || '',
              });
              return {
                isValid: true,
                cookies: credential,
                email: email || null,
              };
            }

            logger.warn(
              '[Gemini] Login validation failed: missing SID cookies',
            );
            return { isValid: false };
          } finally {
            validating = false;
          }
        },
      })
      .finally(() => {
        proxyEvents.off(GEMINI_EVENTS.XSRF, onXsrf);
        proxyEvents.off(GEMINI_EVENTS.AUTH_USER, onAuthUser);
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
      onMetadata,
      onDone,
      onError,
      onRaw,
    } = options;

    const cred = this.parseCredential(credential);
    const modelConfig = this.resolveModel(model);

    try {
      const promptParts: string[] = [];
      for (const msg of messages) {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? (msg.content as any[])
                  .filter(
                    (c: any) => c.type === 'text' || c.type === 'input_text',
                  )
                  .map((c: any) => c.text || '')
                  .join(' ')
              : '';

        if (msg.role === 'system') {
          promptParts.push(`[System Instructions:] ${content}`);
        } else if (msg.role === 'assistant') {
          promptParts.push(`[Assistant]: ${content}`);
        } else if (msg.role === 'user') {
          promptParts.push(content);
        }
      }
      const prompt = promptParts.filter(Boolean).join('\n\n');
      if (!prompt.trim()) {
        throw new Error('No messages to send');
      }

      const buildHeaders = (c: typeof cred): Record<string, string> => {
        const h: Record<string, string> = {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
          [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
          [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${getAccountPrefix(c.authUser)}${DEFAULT_LOGIN_PATH}`,
          [HTTP_HEADER_NAMES.X_SAME_DOMAIN]: '1',
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        };
        if (c.authUser) h[HTTP_HEADER_NAMES.X_GOOG_AUTH_USER] = c.authUser;
        if (c.cookies) h[HTTP_HEADER_NAMES.COOKIE] = c.cookies;
        if (c.sapisid)
          h[HTTP_HEADER_NAMES.AUTHORIZATION] = makeSapisidHash(c.sapisid);
        return h;
      };

      let currentCred = cred;
      let attempt = 0;

      while (attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;
        const url = getStreamGenerateUrl(currentCred.authUser);
        const body = buildRequestBody(
          prompt,
          modelConfig.mode,
          modelConfig.think,
          currentCred.xsrfToken,
        );
        const headers = buildHeaders(currentCred);
        const response = await fetch(url, { method: 'POST', headers, body });

        if (!response.ok) {
          const errorText = await response.text();

          const xsrfFromError = errorText.match(
            REGEX_PATTERNS.XSRF_IN_ERROR,
          )?.[1];
          if (xsrfFromError && attempt === 1) {
            logger.warn('[Gemini] XSRF token missing, retrying with new token');
            currentCred = { ...currentCred, xsrfToken: xsrfFromError };
            continue;
          }

          throw new Error(
            `Gemini API returned ${response.status}: ${errorText.slice(0, ERROR_SLICE_LENGTH)}`,
          );
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const promptTokens = countMessagesTokens(messages);

        await parseSSEStream(response.body as NodeJS.ReadableStream, {
          onContent,
          onMetadata,
          onRaw,
          promptTokens,
        });

        onDone();
        return;
      }
    } catch (err: any) {
      logger.error('[Gemini] handleMessage error:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Utility Methods ─────────────────────────────────────────────────

  private parseCredential(credential: string): GeminiCredential {
    try {
      const parsed = JSON.parse(credential);
      return {
        cookies: parsed.cookies || parsed.cookie || credential,
        sapisid: parsed.sapisid || '',
        authUser: parsed.authUser || parsed.auth_user || '',
        xsrfToken: parsed.xsrfToken || parsed.xsrf_token || '',
        email: parsed.email || '',
      };
    } catch {
      logger.warn(
        '[Gemini] Credential is not valid JSON, treating as raw cookie string',
      );
      const sapisidMatch = credential.match(REGEX_PATTERNS.SAPISID_IN_COOKIE);
      return {
        cookies: credential,
        sapisid: sapisidMatch ? sapisidMatch[1] : '',
      };
    }
  }

  private resolveModel(modelName: string): GeminiModelConfig {
    let name = modelName.trim().toLowerCase();
    let thinkOverride: number | null = null;

    const thinkMatch = name.match(REGEX_PATTERNS.THINK_OVERRIDE);
    if (thinkMatch) {
      thinkOverride = parseInt(thinkMatch[1], 10);
      name = name.replace(/@think=\d+$/, '').trim();
    }

    const config = MODEL_MAP[name];
    if (!config) {
      logger.warn(
        `[Gemini] Unknown model "${modelName}", falling back to flash`,
      );
      return { mode: GEMINI_DEFAULT_MODE, think: GEMINI_DEFAULT_THINK };
    }

    return {
      mode: config.mode,
      think: thinkOverride !== null ? thinkOverride : config.think,
    };
  }

  async stopStream(_credential: string, _chatId: string, _messageId: string) {}
}

export default new GeminiProvider();