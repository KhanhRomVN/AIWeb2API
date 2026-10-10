/**
 * ------------------------------------------------------------------
 * Cline Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Cline AI API (https://api.cline.bot/api/v1).
 * Hỗ trợ:
 *  - login()    : Bước 1 — khởi tạo WorkOS device code flow,
 *                  trả về { pending: true, user_code, verification_url, tempSessionId }
 *  - pollOnce() : Bước 2 — UI gọi định kỳ cho đến khi done=true
 *  - handleMessage() : Chat với streaming SSE
 *  - getUserProfile() : Lấy email từ credential
 *
 * Credential format (JSON string hoặc raw refreshToken):
 *  - Raw: `<refreshToken>`
 *  - JSON: `{ "refreshToken": "...", "email": "..." }`
 *  - Multi-account: nhiều dòng, mỗi dòng 1 token hoặc JSON
 *
 * Auth flow (WorkOS device authorization — 2 bước):
 *  Step 1 — login():
 *    POST api.workos.com/user_management/authorize/device
 *    → device_code, user_code, verification_uri_complete, interval, expires_in
 *    → trả { pending: true, user_code, verification_url, tempSessionId: <poll context JSON> }
 *
 *  Step 2 — pollOnce(tempSessionId):
 *    Poll api.workos.com/user_management/authenticate với device_code
 *    → Khi thành công: POST api.cline.bot/auth/register → Cline refreshToken
 *    → trả { done: true, cookies: JSON.stringify({ refreshToken, email }), email }
 *
 * Token management:
 *  - refreshToken → accessToken qua /auth/refresh (TTL ~10 phút, có thể rotate)
 *  - Pool nhiều account (multi-line credential) → round-robin + cooldown khi 429
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Cline Imports ──
import type {
  ClineCredential,
  ClineRegisterResponse,
  WorkOSDeviceResponse,
  WorkOSTokenResponse,
  ClineChatBody,
} from './cline.types';
import {
  parseAccounts,
  getAccessToken,
  clineFetchWithRetry,
  buildClineHeaders,
} from './cline.token-manager';
import { getModelUpstreamId, needsForceStream } from './cline.model-manager';
import { unwrapData } from './cline.sse-parser';
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
  SUPPORTS_SESSION_CLEANUP,
  REQUEST_LIMIT,
  REQUEST_LIMIT_PERIOD,
  BLOCKED_TIME_RANGES,
  MODELS,
  DEFAULT_MODEL,
  BASE_URL,
  API_PATHS,
  WORKOS_DEVICE_URL,
  WORKOS_AUTH_URL,
  CLINE_REGISTER_URL,
  WORKOS_CLIENT_ID,
  HTTP_HEADER_NAMES,
} from './cline.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClineProvider');

// ─── Poll Context ────────────────────────────────────────────────────────

interface ClinePollContext {
  device_code: string;
  interval: number;
  expires_at: number; // timestamp ms
}

// ─── Provider Class ──────────────────────────────────────────────────────

export class ClineProvider implements Provider {
  name = PROVIDER_NAME;

  usagePolicy: NonNullable<Provider['usagePolicy']> = {
    requestLimit: REQUEST_LIMIT,
    requestLimitPeriod: REQUEST_LIMIT_PERIOD,
    blockedTimeRanges: BLOCKED_TIME_RANGES,
  };

  // ─── Provider Configuration ───────────────────────────────────────
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
    can_regenerate: CAN_REGENERATE,
    blocked_time_ranges: BLOCKED_TIME_RANGES,
    supports_session_cleanup: SUPPORTS_SESSION_CLEANUP,
  };

  // ─── Credential Helpers ──────────────────────────────────────────

  private parseCredential(credential: string): ClineCredential {
    const firstLine = credential.split('\n')[0].trim();
    if (firstLine.startsWith('{')) {
      try {
        const parsed = JSON.parse(firstLine);
        const rt = parsed.refreshToken || parsed.refresh_token || parsed.token;
        if (rt) return { refreshToken: rt, email: parsed.email };
      } catch {
        /* fallthrough */
      }
    }
    return { refreshToken: firstLine };
  }

  // ─── User Profile ────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const cred = this.parseCredential(credential);
    return { email: cred.email || null };
  }

  // ─── Login — Bước 1: Khởi tạo device code ───────────────────────

  /**
   * Bắt đầu WorkOS device authorization flow.
   * Trả về ngay sau khi có device_code — KHÔNG chờ user xác thực.
   *
   * Return shape (giống Kiro):
   * {
   *   success: true,
   *   pending: true,
   *   cookies: '',
   *   email: '',
   *   tempSessionId: '<JSON poll context>',
   *   user_code: '...',
   *   verification_url: 'https://...',
   *   expires_in: 300,
   *   poll_interval: 5,
   * }
   */
  async login(_options?: any): Promise<any> {
    const resp = await fetch(WORKOS_DEVICE_URL, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ client_id: WORKOS_CLIENT_ID }).toString(),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(
        `Cline: WorkOS device authorization failed (HTTP ${resp.status}): ${errText.slice(0, 200)}`,
      );
    }

    const data = (await resp.json()) as WorkOSDeviceResponse;

    const deviceCode = data.device_code;
    const userCode = data.user_code || '';
    const verificationUrl =
      data.verification_uri_complete || data.verification_uri || '';
    const interval = Math.max(data.interval ?? 5, 5);
    const expiresIn = data.expires_in ?? 300;

    if (!deviceCode) {
      throw new Error(
        'Cline: WorkOS device authorization response missing device_code',
      );
    }

    const pollContext: ClinePollContext = {
      device_code: deviceCode,
      interval,
      expires_at: Date.now() + expiresIn * 1000,
    };

    return {
      success: true,
      pending: true,
      cookies: '',
      email: '',
      tempSessionId: JSON.stringify(pollContext),
      user_code: userCode,
      verification_url: verificationUrl,
      expires_in: expiresIn,
      poll_interval: interval,
    };
  }

  // ─── Poll — Bước 2: Poll định kỳ cho đến khi done ───────────────

  /**
   * Gọi một lần poll WorkOS authenticate endpoint.
   * UI gọi định kỳ (mỗi `interval` giây) cho đến khi done=true hoặc error.
   *
   * Return:
   * - { done: false }                   → authorization_pending, tiếp tục
   * - { done: false, error: '...' }     → hết hạn / bị từ chối
   * - { done: true, cookies, email }    → thành công
   */
  async pollOnce(pollContext: string): Promise<{
    done: boolean;
    cookies?: string;
    email?: string;
    error?: string;
  }> {
    let ctx: ClinePollContext;
    try {
      ctx = JSON.parse(pollContext);
    } catch {
      return { done: false, error: 'Invalid poll context' };
    }

    if (Date.now() >= ctx.expires_at) {
      return {
        done: false,
        error: 'Device code expired. Please try again.',
      };
    }

    try {
      const resp = await fetch(WORKOS_AUTH_URL, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: ctx.device_code,
          client_id: WORKOS_CLIENT_ID,
        }).toString(),
      });

      const data = (await resp.json()) as WorkOSTokenResponse;

      // Thành công
      if (data.access_token) {
        return await this.finalizeClineLogin(
          data.access_token,
          data.refresh_token || '',
        );
      }

      // Handle polling errors
      const err = data.error;
      if (err === 'slow_down') {
        // Không trả error — UI chỉ cần tăng interval
        return { done: false };
      }
      if (err === 'authorization_pending') {
        return { done: false };
      }
      if (err === 'access_denied') {
        return { done: false, error: 'User denied authorization.' };
      }
      if (err === 'expired_token' || err === 'device_expired') {
        return {
          done: false,
          error: 'Device code expired. Please try again.',
        };
      }

      const errMsg = data.error_description || err || 'WorkOS poll failed';
      return { done: false, error: errMsg };
    } catch (e: any) {
      logger.warn('[Cline] pollOnce error:', e?.message);
      return { done: false };
    }
  }

  /**
   * Sau khi WorkOS trả access_token, đăng ký với Cline để lấy refreshToken.
   */
  private async finalizeClineLogin(
    workosAccessToken: string,
    workosRefreshToken: string,
  ): Promise<{ done: boolean; cookies: string; email: string }> {
    const registerResp = await fetch(CLINE_REGISTER_URL, {
      method: 'POST',
      headers: { [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/json' },
      body: JSON.stringify({
        accessToken: workosAccessToken,
        refreshToken: workosRefreshToken,
      }),
    });

    if (!registerResp.ok) {
      const errText = await registerResp.text();
      throw new Error(
        `Cline register failed (HTTP ${registerResp.status}): ${errText.slice(0, 200)}`,
      );
    }

    const registerData = (await registerResp.json()) as ClineRegisterResponse;
    const clineRefreshToken = registerData?.data?.refreshToken;

    if (!clineRefreshToken) {
      throw new Error('Cline register: no refreshToken in response');
    }

    const email = registerData?.data?.userInfo?.email || '';
    const cookies = JSON.stringify({ refreshToken: clineRefreshToken, email });

    return { done: true, cookies, email };
  }

  // ─── Handle Message ──────────────────────────────────────────────

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

    try {
      const sessionId = `sess_${Date.now()}`;
      const requestedModel = model || DEFAULT_MODEL;
      const upstreamModel = await getModelUpstreamId(requestedModel);

      const chatMessages = messages.map((m) => ({
        role: m.role,
        content:
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }));

      const body: ClineChatBody = {
        model: upstreamModel,
        session_id: sessionId,
        reasoning_effort: (options as any).reasoning_effort || 'high',
        messages: chatMessages,
        stream: true,
      };

      // Passthrough optional params — KHÔNG pass max_tokens (gây upstream 500)
      const optAny = options as any;
      for (const k of [
        'temperature',
        'top_p',
        'stop',
        'presence_penalty',
        'frequency_penalty',
        'response_format',
        'seed',
      ] as const) {
        if (optAny[k] !== undefined) (body as any)[k] = optAny[k];
      }

      if (onMetadata) {
        onMetadata({ conversation_id: sessionId });
      }

      const resp = await clineFetchWithRetry(
        credential,
        API_PATHS.CHAT_COMPLETIONS,
        body as unknown as Record<string, unknown>,
        sessionId,
        true,
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(
          `Cline upstream error ${resp.status}: ${errText.slice(0, 300)}`,
        );
      }

      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        // Non-SSE (JSON error) — extract content best-effort
        const json = (await resp.json()) as Record<string, unknown>;
        const normalized = unwrapData(json);
        const content =
          (normalized['choices'] as any)?.[0]?.message?.content || '';
        if (onContent) onContent(content);
        if (onMetadata) onMetadata({ model: requestedModel });
        onDone();
        return;
      }

      await this.streamSSEToCallbacks(resp, {
        onContent: onContent || (() => {}),
        onThinking,
        onMetadata,
        onRaw,
        externalModel: requestedModel,
        onDone,
      });
    } catch (err: any) {
      logger.error('[Cline] handleMessage error:', {
        message: err.message,
        stack: err.stack,
      });
      onError(err);
    }
  }

  /**
   * Đọc SSE stream từ upstream, forward từng delta đến callbacks.
   */
  private async streamSSEToCallbacks(
    upstream: import('node-fetch').Response,
    opts: {
      onContent: (text: string) => void;
      onThinking?: (text: string) => void;
      onMetadata?: (meta: Record<string, unknown>) => void;
      onRaw?: (raw: string) => void;
      externalModel: string;
      onDone: () => void;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const body = upstream.body!;
      let buf = '';

      body.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8');
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);

          if (opts.onRaw) opts.onRaw(line);

          if (!line.startsWith('data:')) continue;
          const payload = line.slice('data:'.length).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const obj = JSON.parse(payload) as Record<string, unknown>;
            const normalized = unwrapData(obj);
            normalized['model'] = opts.externalModel;

            const choices = normalized['choices'] as
              | Array<{
                  delta?: {
                    content?: string;
                    reasoning?: string;
                  };
                  finish_reason?: string;
                }>
              | undefined;

            const choice = choices?.[0];
            if (!choice) continue;

            const delta = choice.delta || {};
            if (delta.content) opts.onContent(delta.content);
            if (delta.reasoning && opts.onThinking) {
              opts.onThinking(delta.reasoning);
            }

            if (opts.onMetadata && normalized['usage']) {
              const usage = normalized['usage'] as {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
              };
              opts.onMetadata({
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
                total_tokens: usage.total_tokens,
              });
            }
          } catch {
            /* ignore malformed SSE chunk */
          }
        }
      });

      body.on('end', () => {
        opts.onDone();
        resolve();
      });

      body.on('error', (err: Error) => {
        reject(err);
      });
    });
  }
}

export default new ClineProvider();
