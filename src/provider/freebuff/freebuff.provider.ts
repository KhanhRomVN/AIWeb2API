/**
 * ------------------------------------------------------------------
 * Freebuff Provider
 * ------------------------------------------------------------------
 * Provider xử lý tương tác với nền tảng Freebuff AI (freebuff.com)
 * Hỗ trợ các model: GLM-5.3, MiMo 2.5, DeepSeek v4, MiniMax m3, Solar Pro.
 * ------------------------------------------------------------------
 */

import fetch from 'node-fetch';
import { Provider, SendMessageOptions } from '../../types/index';
import { loginService } from '../../services/login.service';
import { createLogger } from '../../utils/logger';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_LOGIN_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  IS_MEMORY,
  STREAM_URL,
  SESSION_URL,
  FREEBUFF_HEADERS,
  FREEBUFF_EVENTS,
  MODELS,
} from './freebuff.constant';
import { FreebuffUserProfile, FreebuffRequestBody } from './freebuff.types';
import { parseFreebuffSSE } from './freebuff.sse-parser';
import { proxyHandler } from './freebuff.proxy-handler';

const logger = createLogger('FreebuffProvider');

export class FreebuffProvider implements Provider {
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
    models: MODELS,
  };

  private threadMap = new Map<string, string>(); // conversationId -> freebuffThreadId

  // ─── Extract Prompt ────────────────────────────────────────────────
  public extractPrompt(messages: any[]): string {
    if (!Array.isArray(messages) || messages.length === 0) return '';

    // Tìm tin nhắn user gần nhất
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;

      if (msg.role === 'user') {
        if (typeof msg.content === 'string' && msg.content.trim()) {
          return msg.content.trim();
        }
        if (Array.isArray(msg.content)) {
          const joined = msg.content
            .filter(
              (p: any) => p && (p.type === 'text' || typeof p === 'string'),
            )
            .map((p: any) => p.text || p)
            .join('\n')
            .trim();
          if (joined) return joined;
        }
      }
    }

    // Fallback: bất kỳ tin nhắn nào có nội dung từ cuối lên
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && typeof msg.content === 'string' && msg.content.trim()) {
        return msg.content.trim();
      }
    }

    return '';
  }

  // ─── Login ──────────────────────────────────────────────────────────
  async login() {
    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl: AUTH_LOGIN_URL,
      partition: `freebuff_${Date.now()}`,
      cookieEvent: FREEBUFF_EVENTS.LOGIN_TOKEN,
      infoEvent: FREEBUFF_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies && data.cookies.length > 0) {
          // Bắt buộc phải có session-token
          const hasSessionToken =
            data.cookies.includes('session-token') ||
            data.cookies.includes('__Secure-next-auth.session-token') ||
            data.cookies.includes('next-auth.session-token');

          const cookieNames = data.cookies
            .split(';')
            .map((c) => c.split('=')[0].trim())
            .filter(Boolean)
            .join(', ');

          if (!hasSessionToken) {
            logger.debug(
              '[Freebuff] Login validation: waiting for session-token cookie...',
            );
            return { isValid: false };
          }

          // Bắt buộc gọi API session với chính cookie vừa bắt được để xác thực
          const profile = await this.getUserProfile(data.cookies);
          if (profile?.email) {
            return {
              isValid: true,
              email: profile.email,
              cookies: data.cookies,
            };
          }
          logger.warn(
            '[Freebuff] Login validation: session cookie not yet active on Freebuff session endpoint...',
          );
        }
        return { isValid: false };
      },
    });
  }

  private parseCookies(credential: string): string {
    if (!credential) return '';
    if (typeof credential === 'string' && credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);
        return parsed.cookies || parsed.token || credential;
      } catch {}
    }
    return credential;
  }

  // ─── Profile ────────────────────────────────────────────────────────
  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string }> {
    try {
      const cookie = this.parseCookies(credential);
      const response = await fetch(SESSION_URL, {
        method: 'GET',
        headers: {
          ...FREEBUFF_HEADERS,
          Cookie: cookie,
        },
      });

      if (response.status === 200) {
        const json = (await response.json()) as FreebuffUserProfile;
        if (json?.user?.email) {
          return {
            email: json.user.email,
            name: json.user.name,
          };
        }
      }
    } catch (err) {
      logger.error('[Freebuff] Failed to get user profile:', err);
    }
    return { email: null };
  }

  // ─── Models ─────────────────────────────────────────────────────────
  async getModels(credential?: string, accountId?: string): Promise<any[]> {
    return MODELS;
  }

  // ─── Handle Message ─────────────────────────────────────────────────
  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      conversationId,
      onContent,
      onThinking,
      onMetadata,
      onSessionCreated,
      onDone,
      onError,
    } = options;

    try {
      let prompt = this.extractPrompt(messages);
      if (!prompt) {
        throw new Error('Nội dung tin nhắn không được để trống.');
      }

      // Giới hạn độ dài theo chính sách của Freebuff (32,000 ký tự)
      if (prompt.length > 31000) {
        logger.warn(
          `[Freebuff] Prompt length (${prompt.length}) exceeds 32000 limit. Truncating to latest 31000 chars.`,
        );
        prompt = prompt.slice(-31000);
      }

      const bodyPayload: FreebuffRequestBody = {
        content: prompt,
        message: prompt,
        model: model || 'glm-5.3-flash',
      };

      const existingThreadId = conversationId
        ? this.threadMap.get(conversationId) || conversationId
        : undefined;

      if (existingThreadId) {
        bodyPayload.threadId = existingThreadId;
      }

      const cookie = this.parseCookies(credential);

      let response = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          ...FREEBUFF_HEADERS,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify(bodyPayload),
      });

      // Nếu 404 do thread đã hết hạn hoặc không tồn tại, thử lại với thread mới
      if (response.status === 404 && bodyPayload.threadId) {
        logger.warn(
          `[Freebuff] Thread ${bodyPayload.threadId} not found (404). Retrying as new conversation...`,
        );
        if (conversationId) {
          this.threadMap.delete(conversationId);
        }
        delete bodyPayload.threadId;

        response = await fetch(STREAM_URL, {
          method: 'POST',
          headers: {
            ...FREEBUFF_HEADERS,
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify(bodyPayload),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `[Freebuff] API error ${response.status}: ${errorText.slice(0, 300)}`,
        );
        throw new Error(
          `Freebuff API error (${response.status}): ${errorText.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error('Empty response body from Freebuff stream.');
      }

      parseFreebuffSSE(response.body as any, {
        onContent,
        onThinking,
        onMetadata,
        onSessionCreated: (newThreadId) => {
          if (conversationId && newThreadId) {
            this.threadMap.set(conversationId, newThreadId);
          }
          if (newThreadId) {
            this.threadMap.set(newThreadId, newThreadId);
          }
          if (onSessionCreated) {
            onSessionCreated(newThreadId);
          }
        },
        onDone,
        onError,
      });
    } catch (error) {
      logger.error('[Freebuff] Error in handleMessage:', error);
      onError(error);
    }
  }
}

export default new FreebuffProvider();
