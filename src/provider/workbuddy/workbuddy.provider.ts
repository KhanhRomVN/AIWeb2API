/**
 * ------------------------------------------------------------------
 * WorkBuddy Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Tencent CodeBuddy / WorkBuddy.
 * Gateway tương thích OpenAI đặt trước hai realm:
 *   - cn     → copilot.tencent.com (codebuddy.cn)
 *   - global → www.workbuddy.ai
 *
 * Auth flow: OAuth device flow (2 bước, theo pattern Kiro).
 *   Bước 1: login()    → POST upstream lấy state + authUrl,
 *                         trả về { pending:true, user_code, verification_url,
 *                                  tempSessionId: JSON(WorkBuddyPollContext) }
 *   Bước 2: pollOnce() → GET token từ upstream, trả về
 *                         { done:true, cookies, email } khi thành công
 *
 * Chat flow:
 *   - Gửi OpenAI-compatible body lên upstream /v2/chat/completions
 *     (global: /console/chat/completions, fallback /v2 nếu 404/405)
 *   - Upstream bắt buộc SSE stream (stream=true forced)
 *   - Token tự động refresh khi sắp hết hạn
 *
 * Credential format (JSON string):
 *   { accessToken, refreshToken, expiresAt, domain, realm, uid,
 *     enterpriseId?, nickname?, deviceToken? }
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';
import {
  WorkBuddyCredential,
  WorkBuddyApiEnvelope,
  WorkBuddyChatMeta,
} from './workbuddy.types';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { countMessagesTokens } from '../../utils/tokenizer';

// ── WorkBuddy Imports ──
import {
  parseCredential,
  serializeCredential,
  buildChatHeaders,
  buildBillingHeaders,
  chatBaseUrl,
  originFor,
  needsRefresh,
  refreshToken as doRefreshToken,
  classifyError,
} from './workbuddy.auth';
import { parseWorkBuddySseStream } from './workbuddy.sse-parser';
import { fetchWorkBuddyModels, toProviderModel } from './workbuddy.models';
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
  API_PATHS,
  HEADER_NAMES,
  CONTENT_TYPES,
  USER_AGENTS,
  LOGIN_PLATFORM,
  UPSTREAM_BASE_CN,
  UPSTREAM_BASE_GLOBAL,
  ORIGIN_CN,
  ORIGIN_GLOBAL,
  CHAT_TIMEOUT_MS,
  DEFAULT_REALM,
} from './workbuddy.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('WorkBuddyProvider');

// ─── Poll Context ─────────────────────────────────────────────────────────

/**
 * Context được serialize vào tempSessionId khi login() trả về pending=true.
 * pollOnce() deserialize để biết phải poll endpoint nào.
 */
interface WorkBuddyPollContext {
  state: string;
  realm: 'cn' | 'global';
}

// ─── Provider Class ────────────────────────────────────────────────────

export class WorkBuddyProvider implements Provider {
  name = PROVIDER_NAME;

  usagePolicy: NonNullable<Provider['usagePolicy']> = {
    requestLimit: REQUEST_LIMIT,
    requestLimitPeriod: REQUEST_LIMIT_PERIOD,
    blockedTimeRanges: BLOCKED_TIME_RANGES,
  };

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
    can_regenerate: CAN_REGENERATE,
    blocked_time_ranges: BLOCKED_TIME_RANGES,
    supports_session_cleanup: SUPPORTS_SESSION_CLEANUP,
  };

  // ─── Login (Bước 1) ──────────────────────────────────────────────────

  /**
   * Bước 1 của OAuth device flow.
   * POST upstream để lấy state + authUrl.
   *
   * Trả về:
   * - pending: true
   * - user_code: state string (user dùng để nhận dạng session nếu cần)
   * - verification_url: URL user cần mở trên browser để xác nhận
   * - tempSessionId: JSON(WorkBuddyPollContext) — gửi lại qua pollOnce()
   *
   * options.workbuddyRealm: 'cn' | 'global' (mặc định DEFAULT_REALM)
   */
  async login(options?: {
    workbuddyRealm?: 'cn' | 'global';
    realm?: 'cn' | 'global';
  }): Promise<{
    success: boolean;
    pending: boolean;
    cookies: string;
    email: string;
    tempSessionId: string;
    user_code: string;
    verification_url: string;
    expires_in?: number;
    poll_interval?: number;
  }> {
    const realm: 'cn' | 'global' =
      options?.workbuddyRealm ?? options?.realm ?? DEFAULT_REALM;

    const base = realm === 'global' ? UPSTREAM_BASE_GLOBAL : UPSTREAM_BASE_CN;
    const origin = realm === 'global' ? ORIGIN_GLOBAL : ORIGIN_CN;

    const loginHeaders = {
      [HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
      [HEADER_NAMES.X_REQUESTED_WITH]: 'XMLHttpRequest',
      [HEADER_NAMES.ORIGIN]: origin,
      [HEADER_NAMES.REFERER]: `${origin}/`,
      [HEADER_NAMES.USER_AGENT]: USER_AGENTS.LOGIN,
      [HEADER_NAMES.X_CODEBUDDY_REQUEST]: '1',
    };

    // POST /v2/plugin/auth/state?platform=CLI
    const url = `${base}${API_PATHS.LOGIN_STATE}?platform=${LOGIN_PLATFORM}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: loginHeaders,
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      logger.warn(`[WorkBuddy] login failed body=${errBody.slice(0, 300)}`);
      throw new Error(`WorkBuddy login failed: HTTP ${res.status} ${errBody}`);
    }

    const rawBody = await res.text();

    let envelope: WorkBuddyApiEnvelope<{
      state?: string;
      authUrl?: string;
      auth_url?: string;
    }>;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      throw new Error(`WorkBuddy login: response is not JSON: ${rawBody}`);
    }

    if (envelope.code !== 0 || !envelope.data) {
      throw new Error(
        `WorkBuddy login API error: code=${envelope.code} msg=${envelope.msg ?? ''}`,
      );
    }

    const state = envelope.data.state;
    const authUrl = envelope.data.authUrl ?? envelope.data.auth_url;

    if (!state || !authUrl) {
      throw new Error(
        `WorkBuddy login: missing state or authUrl in response: ${JSON.stringify(envelope.data)}`,
      );
    }

    const pollCtx: WorkBuddyPollContext = { state, realm };

    return {
      success: true,
      pending: true,
      cookies: '',
      email: '',
      tempSessionId: JSON.stringify(pollCtx),
      user_code: state, // hiển thị cho user biết session state
      verification_url: authUrl, // URL user mở trên browser
    };
  }

  // ─── Poll Once (Bước 2) ───────────────────────────────────────────────

  /**
   * Bước 2: Poll một lần — gọi từ UI định kỳ đến khi done=true hoặc error.
   *
   * - done: false + no error  → authorization_pending, tiếp tục poll
   * - done: false + error     → hết hạn hoặc bị denied
   * - done: true              → thành công, cookies + email có giá trị
   *
   * pollContext = tempSessionId từ login().
   */
  async pollOnce(pollContext: string): Promise<{
    done: boolean;
    cookies?: string;
    email?: string;
    error?: string;
  }> {
    let ctx: WorkBuddyPollContext;
    try {
      ctx = JSON.parse(pollContext);
    } catch {
      return { done: false, error: 'Invalid poll context' };
    }

    const { state, realm } = ctx;
    const base = realm === 'global' ? UPSTREAM_BASE_GLOBAL : UPSTREAM_BASE_CN;
    const origin = realm === 'global' ? ORIGIN_GLOBAL : ORIGIN_CN;

    const loginHeaders = {
      [HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
      [HEADER_NAMES.X_REQUESTED_WITH]: 'XMLHttpRequest',
      [HEADER_NAMES.ORIGIN]: origin,
      [HEADER_NAMES.REFERER]: `${origin}/`,
      [HEADER_NAMES.USER_AGENT]: USER_AGENTS.LOGIN,
      [HEADER_NAMES.X_CODEBUDDY_REQUEST]: '1',
    };

    // GET /v2/plugin/auth/token?state=<state>
    const tokenUrl = `${base}${API_PATHS.LOGIN_TOKEN}?state=${encodeURIComponent(state)}`;
    let tokenRes: Awaited<ReturnType<typeof fetch>>;
    try {
      tokenRes = await fetch(tokenUrl, { headers: loginHeaders });
    } catch (err: any) {
      logger.warn(`[WorkBuddy] pollOnce fetch error: ${err?.message}`);
      return { done: false, error: err?.message };
    }

    const rawTokenBody = await tokenRes.text();

    if (!tokenRes.ok) {
      if (tokenRes.status === 400 || tokenRes.status === 404) {
        return { done: false, error: 'Authorization pending or state expired' };
      }
      return {
        done: false,
        error: `Token poll HTTP ${tokenRes.status}: ${rawTokenBody}`,
      };
    }

    let tokenEnvelope: WorkBuddyApiEnvelope<{
      accessToken?: string;
      access_token?: string;
      refreshToken?: string;
      refresh_token?: string;
      expiresIn?: number;
      expires_in?: number;
    }>;
    try {
      tokenEnvelope = JSON.parse(rawTokenBody);
    } catch {
      logger.warn(`[WorkBuddy] pollOnce token body not JSON: ${rawTokenBody}`);
      return { done: false, error: 'Token response is not JSON' };
    }

    // code !== 0 → authorization_pending hoặc lỗi khác
    if (tokenEnvelope.code !== 0 || !tokenEnvelope.data) {
      const msg = tokenEnvelope.msg ?? '';
      const code = tokenEnvelope.code ?? -1;
      // Upstream pending codes:
      //   11217 = "login ing..." (user chưa confirm trên browser)
      //   10001, 1001 = generic "not yet"
      // Hoặc msg chứa keyword pending/waiting/ing
      const isPending =
        code === 11217 ||
        code === 10001 ||
        code === 1001 ||
        msg.toLowerCase().includes('pending') ||
        msg.toLowerCase().includes('waiting') ||
        msg.toLowerCase().includes('login ing') ||
        msg.toLowerCase().includes('logging in');

      if (isPending) {
        return { done: false };
      }
      return { done: false, error: `code=${code} msg=${msg}` };
    }

    const td = tokenEnvelope.data;
    const accessToken = td.accessToken ?? td.access_token ?? '';
    const refreshTokenVal = td.refreshToken ?? td.refresh_token ?? '';
    const expiresIn = td.expiresIn ?? td.expires_in ?? 0;

    if (!accessToken) {
      logger.warn(
        `[WorkBuddy] pollOnce: no accessToken in data keys=${Object.keys(td).join(',')}`,
      );
      return { done: false, error: 'No accessToken in token response' };
    }

    const expiresAt =
      expiresIn > 0 ? Math.floor(Date.now() / 1000) + expiresIn : 0;

    // Extract uid, email, nickname trực tiếp từ JWT payload
    // (tránh gọi thêm /login/account vì không cần thiết)
    const jwtPayload = decodeJwtPayload(accessToken);

    const uid = jwtPayload?.sub ?? '';
    const nickname = jwtPayload?.name ?? jwtPayload?.preferred_username ?? '';
    const emailFromJwt =
      jwtPayload?.email ?? jwtPayload?.preferred_username ?? '';

    // /login/account là best-effort (bổ sung enterpriseId nếu có)
    let enterpriseId: string | undefined;
    const accountUrl = `${base}${API_PATHS.LOGIN_ACCOUNT}?state=${encodeURIComponent(state)}`;
    try {
      const accountRes = await fetch(accountUrl, { headers: loginHeaders });
      const rawAccountBody = await accountRes.text();

      if (accountRes.ok) {
        const accEnvelope = JSON.parse(rawAccountBody) as WorkBuddyApiEnvelope<{
          uid?: string;
          userId?: string;
          user_id?: string;
          nickname?: string;
          nick?: string;
          enterpriseId?: string;
          enterprise_id?: string;
        }>;
        if (accEnvelope.code === 0 && accEnvelope.data) {
          const acc = accEnvelope.data;
          enterpriseId = acc.enterpriseId ?? acc.enterprise_id ?? undefined;
        }
      }
    } catch (e: any) {
      logger.warn(
        `[WorkBuddy] pollOnce account fetch failed (non-fatal): ${e?.message}`,
      );
    }

    const cred: WorkBuddyCredential = {
      accessToken,
      refreshToken: refreshTokenVal,
      expiresAt,
      realm,
      uid,
      ...(enterpriseId ? { enterpriseId } : {}),
    };

    const email = emailFromJwt || uid || nickname || '';
    const serialized = serializeCredential(cred);

    return {
      done: true,
      cookies: serialized,
      email,
    };
  }

  // ─── Profile ─────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const cred = parseCredential(credential);
    // Decode JWT để lấy email và name
    const jwt = decodeJwtPayload(cred.accessToken);
    return {
      email: jwt?.email ?? jwt?.preferred_username ?? cred.uid ?? null,
      name: jwt?.name,
      id: cred.uid,
    };
  }

  // ─── Models ──────────────────────────────────────────────────────────

  async getModels(credential: string): Promise<(typeof MODELS)[number][]> {
    try {
      const cred = parseCredential(credential);
      if (!cred.accessToken) return [...MODELS];

      const models = await fetchWorkBuddyModels(cred);
      if (!models.length) return [...MODELS];

      return models.map(toProviderModel) as any;
    } catch {
      return [...MODELS];
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
      onRaw,
    } = options;

    let cred: WorkBuddyCredential;
    try {
      cred = parseCredential(credential);
      if (!cred.accessToken) {
        throw new Error(
          'WorkBuddy: invalid credential — accessToken missing. Re-login required.',
        );
      }
    } catch (err: any) {
      onError(err);
      return;
    }

    // Auto-refresh token nếu sắp hết hạn
    if (needsRefresh(cred)) {
      const refreshed = await doRefreshToken(cred);
      if (refreshed) {
        cred = refreshed;
        if (options.onCredentialRotated) {
          try {
            await options.onCredentialRotated(serializeCredential(cred));
          } catch (e: any) {
            logger.warn('[WorkBuddy] onCredentialRotated failed:', e?.message);
          }
        }
      } else {
        logger.warn('[WorkBuddy] Token refresh failed, using existing token');
      }
    }

    const body = this.buildChatBody(messages, model, options);
    const meta: WorkBuddyChatMeta = {
      conversationId: options.conversationId,
      conversationRequestId: randomUUID(),
    };

    try {
      await this.doChat(cred, body, meta, {
        onContent,
        onThinking,
        onMetadata,
        onRaw,
        promptTokens: countMessagesTokens(messages),
      });
      onDone();
    } catch (err: any) {
      onError(err ?? new Error('WorkBuddy: chat failed'));
    }
  }

  // ─── Internal: doChat ─────────────────────────────────────────────────

  private async doChat(
    cred: WorkBuddyCredential,
    body: object,
    meta: WorkBuddyChatMeta,
    callbacks: {
      onContent?: (t: string) => void;
      onThinking?: (t: string) => void;
      onMetadata?: (m: Record<string, any>) => void;
      onRaw?: (l: string) => void;
      promptTokens?: number;
    },
  ): Promise<void> {
    const base = chatBaseUrl(cred.realm);
    const chatPath =
      cred.realm === 'global'
        ? API_PATHS.CHAT_COMPLETIONS_CONSOLE
        : API_PATHS.CHAT_COMPLETIONS_V2;

    const headers = buildChatHeaders(cred, meta);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${base}${chatPath}`, {
        method: 'POST',
        signal: controller.signal as any,
        headers,
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
    clearTimeout(timeoutId);

    // Global realm: fallback /v2 nếu /console trả 404/405
    if (cred.realm === 'global' && (res.status === 404 || res.status === 405)) {
      const fb = await fetch(`${base}${API_PATHS.CHAT_COMPLETIONS_V2}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!fb.ok) {
        const errBody = await fb.text();
        const e = Object.assign(new Error(errBody.slice(0, 500)), {
          status: fb.status,
          kind: classifyError(fb.status, errBody).kind,
        });
        throw e;
      }
      return this.streamResponse(fb, callbacks);
    }

    if (!res.ok) {
      const errBody = await res.text();
      const e = Object.assign(new Error(errBody.slice(0, 500)), {
        status: res.status,
        kind: classifyError(res.status, errBody).kind,
      });
      throw e;
    }

    return this.streamResponse(res, callbacks);
  }

  // ─── Internal: streamResponse ─────────────────────────────────────────

  private async streamResponse(
    res: Awaited<ReturnType<typeof fetch>>,
    callbacks: {
      onContent?: (t: string) => void;
      onThinking?: (t: string) => void;
      onMetadata?: (m: Record<string, any>) => void;
      onRaw?: (l: string) => void;
      promptTokens?: number;
    },
  ): Promise<void> {
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const txt = await res.text();
      throw new Error(`WorkBuddy returned JSON instead of SSE: ${txt}`);
    }
    if (!res.body) throw new Error('WorkBuddy: empty response body');

    await parseWorkBuddySseStream(res.body as NodeJS.ReadableStream, {
      onContent: callbacks.onContent,
      onThinking: callbacks.onThinking,
      onMetadata: callbacks.onMetadata,
      onRaw: callbacks.onRaw,
      promptTokens: callbacks.promptTokens ?? 0,
      completionTokensRef: { value: 0 },
    });
  }

  // ─── Internal: buildChatBody ──────────────────────────────────────────

  private buildChatBody(
    messages: SendMessageOptions['messages'],
    model: string,
    options: SendMessageOptions,
  ): object {
    const opts = options as any;

    // Normalize messages
    const normalizedMessages = messages.map((msg) => {
      const m = { ...msg } as any;

      // developer role → system (upstream không nhận 'developer')
      if (m.role === 'developer') m.role = 'system';

      // image_url: string → { url: string }
      if (Array.isArray(m.content)) {
        m.content = m.content.map((part: any) => {
          if (
            part?.type === 'image_url' &&
            typeof part.image_url === 'string'
          ) {
            return { ...part, image_url: { url: part.image_url } };
          }
          return part;
        });
      }

      return m;
    });

    // WorkBuddy yêu cầu message đầu tiên phải là system (code 11128)
    if (normalizedMessages.length === 0 || normalizedMessages[0].role !== 'system') {
      normalizedMessages.unshift({ role: 'system', content: '' });
    }

    const body: Record<string, any> = {
      model,
      messages: normalizedMessages,
      stream: true,
      stream_options: { include_usage: true },
    };

    // max_completion_tokens (OpenAI alias) → max_tokens
    if (opts.max_completion_tokens != null) {
      body.max_tokens = opts.max_completion_tokens;
    } else if (opts.max_tokens != null) {
      body.max_tokens = opts.max_tokens;
    }

    if (opts.temperature != null) body.temperature = opts.temperature;
    if (opts.top_p != null) body.top_p = opts.top_p;

    // Tool calls
    if (opts.tools) body.tools = opts.tools;
    if (opts.tool_choice) {
      // upstream chỉ nhận string; object → lấy .type hoặc 'auto'
      const tc = opts.tool_choice;
      body.tool_choice =
        typeof tc === 'object' && tc !== null ? (tc.type ?? 'auto') : tc;
    }

    return body;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Best-effort decode JWT payload (không verify signature).
 * Dùng để extract sub, email, name, exp từ accessToken.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → Buffer → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── Export ───────────────────────────────────────────────────────────

export default new WorkBuddyProvider();
