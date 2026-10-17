/**
 * ------------------------------------------------------------------
 * Codex Provider
 * ------------------------------------------------------------------
 * Provider implementation cho ChatGPT/Codex OAuth gateway.
 *
 * Provider này gọi internal backend của ChatGPT/Codex tại:
 *   POST https://chatgpt.com/backend-api/codex/responses
 *
 * Sử dụng OAuth token của tài khoản ChatGPT (không cần OpenAI API key).
 * Giả lập headers/UA của Codex chính thức để tránh bị phát hiện.
 *
 * Main features:
 * - login()         : Đăng nhập qua ChatGPT OAuth PKCE (browser)
 * - handleMessage() : Gửi tin nhắn với SSE streaming response
 * - getUserProfile(): Lấy thông tin user từ id_token
 *
 * Credential format (JSON string):
 *   {"accessToken":"<jwt>","refreshToken":"<rt>","email":"user@email.com"}
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import fetch from 'node-fetch';
import { randomBytes } from 'crypto';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';
import { countMessagesTokens } from '../../utils/tokenizer';
import { coordinateTokenRefresh } from '../../utils/jwt-helper';
import { DEFAULT_PROVIDER_CONFIG } from '../_shared/default-provider-config';

// ── Codex Imports ──
import {
  CodexCredential,
  CodexChatPayload,
  CodexInputItem,
  CodexTokenResponse,
  CodexIDTokenClaims,
} from './codex.types';
import { parseCodexSSEStream } from './codex.sse-parser';
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
  CAN_REGENERATE,
  TOKEN_COUNT_MODE,
  MAX_INPUT_TOKEN,
  MODELS,
  BASE_URL,
  API_PATHS,
  OAUTH_CONFIG,
  USER_AGENTS,
  HTTP_HEADERS_CONFIG,
  HTTP_HEADER_NAMES,
  BEARER_PREFIX,
  LOGIN_PARTITION_PREFIX,
  CODEX_EVENTS,
  TOKEN_REFRESH_CONFIG,
  MODEL_ALIASES,
} from './codex.constant';

// ─── Shared Auth ────────────────────────────────────────────────────────
import { parseTokenCredential } from '../_shared/auth';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CodexProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class CodexProvider implements Provider {
  name = PROVIDER_NAME;

  // ─── Provider Configuration ────────────────────────────────────────
  static config = {
    ...DEFAULT_PROVIDER_CONFIG,
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
    can_regenerate: CAN_REGENERATE,
    token_count_mode: TOKEN_COUNT_MODE,
    max_input_token: MAX_INPUT_TOKEN,
  };

  // ─── Credential Helpers ─────────────────────────────────────────────

  /**
   * Parse credential string thành `CodexCredential`.
   * Hỗ trợ JSON mới `{"accessToken","refreshToken","email"}` và raw JWT token cũ.
   */
  private parseCredential(credential: string): CodexCredential {
    interface CodexBase {
      accessToken: string;
      refreshToken: string;
      jsonPayload?: Record<string, unknown>;
    }

    const result = parseTokenCredential<CodexBase>(credential, {
      accessKeys: ['accessToken', 'access_token', 'token', 'secretKey', 'secret_key'],
      refreshKeys: ['refreshToken', 'refresh_token'],
      logger,
      label: 'Codex',
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken || undefined,
      email: (result.jsonPayload?.email as string) || undefined,
    };
  }

  /**
   * Giải mã JWT payload (base64url) để lấy claims từ access_token hoặc id_token.
   * Không verify signature — chỉ decode để lấy email, sub, v.v.
   */
  private decodeJWTPayload(jwt: string): CodexIDTokenClaims | null {
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1];
      // base64url → base64
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        '=',
      );
      return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Lấy email từ JWT claims (id_token hoặc access_token).
   */
  private getEmailFromToken(token: string): string | null {
    const claims = this.decodeJWTPayload(token);
    if (!claims) return null;
    return (
      claims.email || claims['https://api.openai.com/profile']?.email || null
    );
  }

  /**
   * Refresh access token bằng refresh token.
   * Gọi `POST https://auth.openai.com/oauth/token` với grant_type=refresh_token.
   *
   * @returns credential mới (JSON string) hoặc null nếu thất bại.
  /**
   * Refresh access token bằng refresh token.
   * Sử dụng coordinateTokenRefresh để chống race condition khi nhiều request cùng lúc.
   */
  async refreshAccessToken(
    credential: CodexCredential,
  ): Promise<string | null> {
    const { refreshToken } = credential;
    if (!refreshToken) {
      logger.warn('[CodexCLI] No refresh token available');
      return null;
    }

    return coordinateTokenRefresh('codex', refreshToken, () =>
      this._performTokenRefresh(credential),
    );
  }

  /**
   * Logic cốt lõi thực hiện refresh token (không có coordination).
   */
  private async _performTokenRefresh(
    credential: CodexCredential,
  ): Promise<string | null> {
    const { refreshToken } = credential;
    if (!refreshToken) return null;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TOKEN_REFRESH_CONFIG.REQUEST_TIMEOUT_MS,
    );

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: OAUTH_CONFIG.CLIENT_ID,
        refresh_token: refreshToken,
        scope: OAUTH_CONFIG.SCOPES,
      });

      const res = await fetch(OAUTH_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        logger.warn(`[CodexCLI] Token refresh failed: HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as CodexTokenResponse;
      if (!data.access_token) {
        logger.warn('[CodexCLI] Token refresh returned no access_token');
        return null;
      }

      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token || refreshToken;
      const email =
        (data.id_token ? this.getEmailFromToken(data.id_token) : null) ||
        this.getEmailFromToken(newAccessToken) ||
        credential.email ||
        null;

      const newCredential = JSON.stringify({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        ...(email ? { email } : {}),
      });

      return newCredential;
    } catch (e: any) {
      clearTimeout(timeout);
      logger.warn('[CodexCLI] Token refresh request failed:', e?.message || e);
      return null;
    }
  }
  // ─── Profile ─────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const { accessToken } = this.parseCredential(credential);

    // Lấy email từ JWT claims (không cần call API)
    const email = this.getEmailFromToken(accessToken);
    if (email) {
      return { email };
    }

    return { email: null };
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    // ChatGPT OAuth PKCE login URL
    const loginUrl = `${OAUTH_CONFIG.AUTHORIZE_URL}?client_id=${OAUTH_CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_CONFIG.REDIRECT_URI)}&scope=${encodeURIComponent(OAUTH_CONFIG.SCOPES)}&response_type=code&code_challenge_method=S256&${new URLSearchParams(OAUTH_CONFIG.EXTRA_PARAMS).toString()}`;

    const result = await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: CODEX_EVENTS.LOGIN_TOKEN,
      infoEvent: CODEX_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          const accessToken = data.cookies;
          const email =
            data.email || this.getEmailFromToken(accessToken) || null;

          if (email) {
            const jsonCredential = JSON.stringify({
              accessToken,
              email,
            });
            return { isValid: true, cookies: jsonCredential, email };
          }

          // Token nhưng không có email — vẫn accept
          logger.warn('[CodexCLI] Login: got token but no email');
          return {
            isValid: true,
            cookies: JSON.stringify({ accessToken }),
            email: 'unknown@codex',
          };
        }
        return { isValid: false };
      },
    });

    return result;
  }

  // ─── Build Request Input ─────────────────────────────────────────────

  /**
   * Chuyển đổi messages từ định dạng OpenAI Chat sang Codex input items.
   *
   * Codex /responses dùng `input` array thay vì `messages`.
   * - role: 'user' | 'assistant' | 'system'
   * - content: string hoặc array of content parts
   */
  private buildInputItems(
    messages: SendMessageOptions['messages'],
  ): CodexInputItem[] {
    const items: CodexInputItem[] = [];

    for (const msg of messages) {
      const role = msg.role as 'user' | 'assistant' | 'system';

      if (typeof msg.content === 'string') {
        items.push({
          type: 'message',
          role,
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        // Multi-part content (text + images)
        const parts = (msg.content as any[]).map((part: any) => {
          if (part.type === 'text') {
            return { type: 'input_text', text: part.text };
          }
          if (part.type === 'image_url') {
            const url =
              typeof part.image_url === 'string'
                ? part.image_url
                : part.image_url?.url;
            return { type: 'input_image', image_url: url };
          }
          return part;
        });
        items.push({ type: 'message', role, content: parts });
      }
    }

    return items;
  }

  /**
   * Map model name: alias → Codex model ID.
   */
  private resolveModel(model: string): string {
    return MODEL_ALIASES[model] || model;
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

    const parsedCred = this.parseCredential(credential);
    let { accessToken } = parsedCred;

    try {
      // Thử refresh token nếu có refresh token và access token sắp hết hạn
      if (parsedCred.refreshToken) {
        const claims = this.decodeJWTPayload(accessToken);
        if (claims) {
          const exp = (claims as any).exp as number | undefined;
          const nowSecs = Math.floor(Date.now() / 1000);
          if (
            exp &&
            exp - nowSecs < TOKEN_REFRESH_CONFIG.REFRESH_BEFORE_EXPIRY_SECS
          ) {
            const newCredStr = await this.refreshAccessToken(parsedCred);
            if (newCredStr) {
              const newCred = this.parseCredential(newCredStr);
              accessToken = newCred.accessToken;
              if (options.onCredentialRotated) {
                try {
                  await options.onCredentialRotated(newCredStr);
                } catch (e: any) {
                  logger.warn(
                    '[CodexCLI] onCredentialRotated callback failed:',
                    e?.message,
                  );
                }
              }
            }
          }
        }
      }

      const resolvedModel = this.resolveModel(model);
      const inputItems = this.buildInputItems(messages);

      // Build headers giả lập Codex
      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${BEARER_PREFIX}${accessToken}`,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: HTTP_HEADERS_CONFIG.CONTENT_TYPE,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS_CONFIG.ACCEPT_SSE,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.CODEX_CLI_LINUX,
        [HTTP_HEADER_NAMES.ORIGINATOR]: HTTP_HEADERS_CONFIG.ORIGINATOR,
        [HTTP_HEADER_NAMES.VERSION]: HTTP_HEADERS_CONFIG.VERSION,
        [HTTP_HEADER_NAMES.X_CODEX_BETA_FEATURES]:
          HTTP_HEADERS_CONFIG.X_CODEX_BETA_FEATURES,
      };

      const client = new HttpClient({
        baseURL: BASE_URL,
        headers,
      });

      const response = await client.post(API_PATHS.CODEX_RESPONSES);

      // Nếu response là JSON (lỗi) thay vì SSE
      const contentType = response.headers.get('content-type') ?? '';
      if (
        contentType.includes('application/json') &&
        !contentType.includes('text/event-stream')
      ) {
        const jsonText = await response.text();
        logger.error('[CodexCLI] Received JSON instead of SSE:', jsonText);
        throw new Error(`Codex returned JSON error: ${jsonText}`);
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Codex API returned HTTP ${response.status}: ${errText}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body from Codex API');
      }

      // Emit metadata: prompt token count
      const promptTokens = countMessagesTokens(messages);
      if (onMetadata) {
        onMetadata({ prompt_tokens: promptTokens });
      }

      // Parse SSE stream
      const result = await parseCodexSSEStream(
        response.body as unknown as NodeJS.ReadableStream,
        { onContent, onThinking, onMetadata, onRaw },
      );

      // Nếu stream kết thúc với lỗi
      if (result.error) {
        throw result.error;
      }

      // Emit response metadata nếu có
      if (result.responseId && onMetadata) {
        onMetadata({ response_id: result.responseId });
      }
      if (result.model && onMetadata) {
        onMetadata({ model: result.model });
      }

      onDone();
    } catch (err: any) {
      logger.error('[CodexCLI] handleMessage error:', {
        message: err.message,
        code: err.code,
        model,
      });
      onError(err);
    }
  }
}

export default new CodexProvider();
