/**
 * ------------------------------------------------------------------
 * Gemini CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Gemini CLI — dùng Code Assist API
 * (cloudcode-pa.googleapis.com) thông qua OAuth2 credential của
 * Gemini CLI app chính thức.
 *
 * Credential format (JSON string):
 * ```json
 * {
 *   "token": "<access_token>",
 *   "refresh_token": "<refresh_token>",
 *   "project_id": "<gcp_project_id>",
 *   "expiry": "2026-01-01T00:00:00+00:00",
 *   "client_id": "...",          // optional, dùng default nếu thiếu
 *   "client_secret": "...",      // optional
 *   "token_uri": "..."           // optional
 * }
 * ```
 *
 * Main features:
 * - handleMessage()    : Gửi tin nhắn với streaming/non-streaming
 * - refreshToken()     : Refresh OAuth2 access token tự động
 * - getUserProfile()   : Lấy email từ Google userinfo API
 * - getModels()        : Trả về danh sách models tĩnh
 *
 * Thinking mode:
 * - Gemini 2.5 series: điều khiển bằng hậu tố tên model
 *   (-max, -high, -medium, -low, -minimal) → thinkingBudget
 * - Gemini 3 series: (-high, -medium, -low, -minimal) → thinkingLevel
 * - Thêm -search để bật Google Search tool
 *
 * Payload upstream:
 * ```json
 * { "model": "<base_model>", "project": "<project_id>", "request": {...} }
 * ```
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ─
import * as http from 'http';
import fetch from 'node-fetch';
import type { Response as NodeFetchResponse } from 'node-fetch';
// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Gemini CLI Imports ──
import {
  GeminiCliCredential,
  GeminiContent,
  GeminiPart,
  GeminiInnerRequest,
  GeminiResponse,
  CodeAssistRequest,
  GenerationConfig,
  ThinkingConfig,
  Tool,
  TokenRefreshResult,
  GoogleUserInfo,
} from './gemini-cli.types';

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
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_SCOPES,
  TOKEN_ENDPOINT,
  USERINFO_ENDPOINT,
  RESOURCE_MANAGER_API,
  CODE_ASSIST_ENDPOINT,
  API_PATHS,
  STREAM_QUERY_PARAMS,
  USER_AGENT_BASE,
  MODELS,
  THINKING_BUDGETS,
  THINKING_LEVELS,
  GENERATION_CONFIG_LIMITS,
  DEFAULT_SAFETY_SETTINGS,
  LITE_SAFETY_SETTINGS,
  TOKEN_REFRESH_BUFFER_SECONDS,
  RETRY_CONFIG,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  SEARCH_SUFFIX,
  GOOGLE_TOKEN_URL,
  OAUTH_CALLBACK_PORT,
  OAUTH_CALLBACK_HOST,
  OAUTH_CALLBACK_URI,
  GEMINI_CLI_EVENTS,
} from './gemini-cli.constant';

import { proxyHandler } from './gemini-cli.proxy-handler';

import {
  parseSSEStream,
  extractContentFromResponse,
} from './gemini-cli.sse-parser';

// ─── Constants ──────────────────────────────────────────────────────────

const logger = createLogger('GeminiCliProvider');

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Tạo User-Agent header theo format Gemini CLI.
 */
function buildUserAgent(model: string = ''): string {
  if (model) return `${USER_AGENT_BASE} ${model}`;
  return USER_AGENT_BASE;
}

/**
 * Lấy base model name bằng cách loại bỏ tất cả suffix đã biết.
 * Ví dụ: "gemini-2.5-flash-high-search" → "gemini-2.5-flash"
 */
function getBaseModelName(modelName: string): string {
  const suffixes = [
    '-maxthinking',
    '-nothinking', // compat cũ
    '-minimal',
    '-medium',
    '-search',
    '-think',
    '-high',
    '-max',
    '-low',
  ];
  let result = modelName;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (result.endsWith(suffix)) {
        result = result.slice(0, -suffix.length);
        changed = true;
      }
    }
  }
  return result;
}

/**
 * Lấy thinking config (budget + level) từ model name.
 * Returns { thinkingBudget, thinkingLevel } — có thể cả hai đều undefined.
 */
function getThinkingSettings(modelName: string): {
  thinkingBudget?: number;
  thinkingLevel?: string;
} {
  const base = getBaseModelName(modelName);

  // Compat cũ
  if (modelName.includes('-nothinking')) {
    return { thinkingBudget: base.includes('flash') ? 0 : 128 };
  }
  if (modelName.includes('-maxthinking')) {
    if (base.includes('gemini-3')) {
      return { thinkingLevel: THINKING_LEVELS.HIGH };
    }
    return {
      thinkingBudget: base.includes('flash')
        ? THINKING_BUDGETS.FLASH_MAX
        : THINKING_BUDGETS.PRO_MAX,
    };
  }

  // Gemini 3 series → thinkingLevel
  if (base.includes('gemini-3')) {
    if (modelName.includes('-high'))
      return { thinkingLevel: THINKING_LEVELS.HIGH };
    if (modelName.includes('-medium')) {
      // Gemini 3 Pro không hỗ trợ medium
      if (base.includes('flash'))
        return { thinkingLevel: THINKING_LEVELS.MEDIUM };
      return {}; // pro → default (no level)
    }
    if (modelName.includes('-low'))
      return { thinkingLevel: THINKING_LEVELS.LOW };
    if (modelName.includes('-minimal')) return {}; // không set thinking
    return {}; // default
  }

  // Gemini 2.5 series → thinkingBudget
  if (base.includes('gemini-2.5')) {
    const isFlash = base.includes('flash');
    if (modelName.includes('-max')) {
      return {
        thinkingBudget: isFlash
          ? THINKING_BUDGETS.FLASH_MAX
          : THINKING_BUDGETS.PRO_MAX,
      };
    }
    if (modelName.includes('-high'))
      return { thinkingBudget: THINKING_BUDGETS.HIGH };
    if (modelName.includes('-medium'))
      return { thinkingBudget: THINKING_BUDGETS.MEDIUM };
    if (modelName.includes('-low'))
      return { thinkingBudget: THINKING_BUDGETS.LOW };
    if (modelName.includes('-minimal')) {
      return {
        thinkingBudget: isFlash
          ? THINKING_BUDGETS.FLASH_MINIMAL
          : THINKING_BUDGETS.PRO_MINIMAL,
      };
    }
  }

  return {};
}

/**
 * Kiểm tra model có phải search model không (có hậu tố -search).
 */
function isSearchModel(modelName: string): boolean {
  return modelName.includes(SEARCH_SUFFIX);
}

/**
 * Kiểm tra access token có cần refresh không (còn < 5 phút).
 */
function shouldRefreshToken(expiry: string): boolean {
  try {
    const expiryTs = new Date(expiry).getTime();
    const nowTs = Date.now();
    const bufferMs = TOKEN_REFRESH_BUFFER_SECONDS * 1000;
    return expiryTs - nowTs < bufferMs;
  } catch {
    return true; // Nếu parse lỗi → refresh
  }
}

/**
 * Chuyển messages từ format AIWeb2API sang Gemini contents format.
 * Xử lý: system → systemInstruction, user/assistant → contents.
 */
function convertMessagesToGemini(messages: SendMessageOptions['messages']): {
  contents: GeminiContent[];
  systemInstruction?: GeminiContent;
} {
  const contents: GeminiContent[] = [];
  let systemInstruction: GeminiContent | undefined;

  for (const msg of messages) {
    const role = msg.role as string;

    // System message → systemInstruction
    if (role === 'system') {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? (msg.content as Array<{ text?: string }>)
                .map((c) => c.text ?? '')
                .join('\n')
            : String(msg.content ?? '');

      systemInstruction = {
        role: 'user', // Gemini system instruction dùng role 'user'
        parts: [{ text }],
      };
      continue;
    }

    // Map role: user → 'user', assistant → 'model'
    const geminiRole: 'user' | 'model' =
      role === 'assistant' ? 'model' : 'user';

    // Build parts
    const parts: GeminiPart[] = [];

    if (typeof msg.content === 'string') {
      if (msg.content.trim()) {
        parts.push({ text: msg.content });
      }
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
        source?: { type: string; media_type: string; data: string };
      }>) {
        if (part.type === 'text' && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url' && part.image_url?.url) {
          // OpenAI format: data URI base64
          const url = part.image_url.url;
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: { mimeType: match[1], data: match[2] },
            });
          }
        } else if (part.type === 'image' && part.source?.type === 'base64') {
          // Anthropic format
          parts.push({
            inlineData: {
              mimeType: part.source.media_type,
              data: part.source.data,
            },
          });
        }
      }
    }

    if (parts.length === 0) {
      parts.push({ text: '' });
    }

    contents.push({ role: geminiRole, parts });
  }

  return { contents, systemInstruction };
}

/**
 * Xây dựng GeminiInnerRequest từ messages và model options.
 */
function buildInnerRequest(
  messages: SendMessageOptions['messages'],
  modelName: string,
): GeminiInnerRequest {
  const { contents, systemInstruction } = convertMessagesToGemini(messages);

  // Generation config
  const generationConfig: GenerationConfig = {
    maxOutputTokens: GENERATION_CONFIG_LIMITS.MAX_OUTPUT_TOKENS,
    topK: GENERATION_CONFIG_LIMITS.TOP_K,
  };

  // Thinking config
  const { thinkingBudget, thinkingLevel } = getThinkingSettings(modelName);
  const baseModel = getBaseModelName(modelName);
  const isPro = baseModel.includes('pro');

  if (thinkingBudget !== undefined || thinkingLevel !== undefined) {
    const thinkingConfig: ThinkingConfig = {};

    if (thinkingBudget !== undefined) {
      thinkingConfig.thinkingBudget = thinkingBudget;
      // includeThoughts: true trừ khi budget = 0
      thinkingConfig.includeThoughts = thinkingBudget > 0;
    } else if (thinkingLevel !== undefined) {
      thinkingConfig.thinkingLevel = thinkingLevel;
      thinkingConfig.includeThoughts = true;
    }

    generationConfig.thinkingConfig = thinkingConfig;
  } else if (isPro) {
    // Pro model luôn bật thinking
    generationConfig.thinkingConfig = { includeThoughts: true };
  }

  // Tools
  const tools: Tool[] = [];

  if (isSearchModel(modelName)) {
    tools.push({ googleSearch: {} });
  }

  // Safety settings
  const safetySettings = (modelName.toLowerCase().includes('lite')
    ? LITE_SAFETY_SETTINGS
    : DEFAULT_SAFETY_SETTINGS) as unknown as GeminiInnerRequest['safetySettings'];

  const request: GeminiInnerRequest = {
    contents,
    generationConfig,
    safetySettings,
  };

  if (tools.length > 0) request.tools = tools;
  if (systemInstruction) request.systemInstruction = systemInstruction;

  return request;
}

// ─── Device Code Types (unused — kept for reference) ─────────────────────

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

// ─── Provider Class ───────────────────────────────────────────────────────

export class GeminiCliProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ──────────────────────────────────────────
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
  };

  // ─── Credential Helpers ──────────────────────────────────────────────

  /**
   * Parse credential string thành GeminiCliCredential.
   * Credential phải là JSON hợp lệ.
   */
  private parseCredential(credential: string): GeminiCliCredential {
    const trimmed = credential.trim();

    if (!trimmed.startsWith('{')) {
      throw new Error(
        'Gemini CLI credential phải là JSON. Format: { "token": "...", "refresh_token": "...", "project_id": "...", "expiry": "..." }',
      );
    }

    try {
      const parsed = JSON.parse(trimmed);

      // Hỗ trợ cả "token" và "access_token"
      const token =
        parsed.token || parsed.access_token || parsed.accessToken || '';
      const refresh_token = parsed.refresh_token || parsed.refreshToken || '';
      const project_id = parsed.project_id || parsed.projectId || '';
      const expiry = parsed.expiry || parsed.expires_at || '';

      if (!token) throw new Error('Missing access token (token/access_token)');
      if (!refresh_token) throw new Error('Missing refresh_token');
      if (!project_id) throw new Error('Missing project_id');

      return {
        token,
        refresh_token,
        project_id,
        expiry,
        client_id: parsed.client_id || OAUTH_CLIENT_ID,
        client_secret: parsed.client_secret || OAUTH_CLIENT_SECRET,
        token_uri: parsed.token_uri || TOKEN_ENDPOINT,
        scopes: parsed.scopes,
      };
    } catch (e) {
      if ((e as Error).message.startsWith('Missing ')) throw e;
      throw new Error(
        `Không thể parse Gemini CLI credential: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Serialize GeminiCliCredential về JSON string để lưu.
   */
  private serializeCredential(cred: GeminiCliCredential): string {
    return JSON.stringify({
      token: cred.token,
      refresh_token: cred.refresh_token,
      project_id: cred.project_id,
      expiry: cred.expiry,
      client_id: cred.client_id,
      client_secret: cred.client_secret,
      token_uri: cred.token_uri,
      scopes: cred.scopes,
    });
  }

  // ─── Token Management ─────────────────────────────────────────────────

  /**
   * Refresh access token bằng refresh_token.
   * Gọi Google OAuth2 token endpoint.
   *
   * @param refreshToken - OAuth2 refresh token
   * @returns Token mới (access_token, expires_in, …)
   */
  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    // refreshToken ở đây là raw refresh_token string
    // nhưng interface nhận credential string → thử parse, fallback raw
    let actualRefreshToken = refreshToken;
    let clientId = OAUTH_CLIENT_ID;
    let clientSecret = OAUTH_CLIENT_SECRET;
    let tokenUri = TOKEN_ENDPOINT;

    if (refreshToken.trim().startsWith('{')) {
      try {
        const cred = this.parseCredential(refreshToken);
        actualRefreshToken = cred.refresh_token;
        clientId = cred.client_id ?? OAUTH_CLIENT_ID;
        clientSecret = cred.client_secret ?? OAUTH_CLIENT_SECRET;
        tokenUri = cred.token_uri ?? TOKEN_ENDPOINT;
      } catch {
        // Nếu parse lỗi → dùng raw string
      }
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: actualRefreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Refresh token thất bại (${res.status}): ${errText.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as TokenRefreshResult & {
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      throw new Error(
        `OAuth error: ${data.error} — ${data.error_description ?? ''}`,
      );
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type ?? 'Bearer',
    };
  }

  /**
   * Lấy credential hợp lệ: tự refresh token nếu gần hết hạn.
   * Returns credential mới (có thể đã refresh), và flag rotated.
   */
  private async ensureValidCredential(credential: string): Promise<{
    cred: GeminiCliCredential;
    rawCredential: string;
    rotated: boolean;
  }> {
    const cred = this.parseCredential(credential);

    // Kiểm tra có cần refresh không
    if (!shouldRefreshToken(cred.expiry)) {
      return { cred, rawCredential: credential, rotated: false };
    }

    try {
      const refreshResult = await this.refreshToken(cred.refresh_token);

      // Tính expiry mới
      const newExpiryDate = new Date(
        Date.now() + refreshResult.expires_in * 1000,
      );

      const newCred: GeminiCliCredential = {
        ...cred,
        token: refreshResult.access_token,
        expiry: newExpiryDate.toISOString(),
      };

      const newRaw = this.serializeCredential(newCred);

      return { cred: newCred, rawCredential: newRaw, rotated: true };
    } catch (e) {
      logger.warn(
        `[GeminiCli] Refresh token thất bại: ${(e as Error).message}, dùng token cũ`,
      );
      return { cred, rawCredential: credential, rotated: false };
    }
  }

  // ─── Profile ───────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string }> {
    try {
      const { cred } = await this.ensureValidCredential(credential);

      const res = await fetch(USERINFO_ENDPOINT, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `Bearer ${cred.token}`,
        },
      });

      if (!res.ok) {
        logger.warn(`[GeminiCli] getUserProfile failed: ${res.status}`);
        return { email: null };
      }

      const data = (await res.json()) as GoogleUserInfo;
      return {
        email: data.email ?? null,
        name: data.name,
      };
    } catch (e) {
      logger.warn(`[GeminiCli] getUserProfile error: ${(e as Error).message}`);
      return { email: null };
    }
  }

  // ─── Models ────────────────────────────────────────────────────────────

  async getModels(_credential: string): Promise<(typeof MODELS)[number][]> {
    // Danh sách tĩnh — không cần gọi upstream
    return MODELS as unknown as (typeof MODELS)[number][];
  }

  // ─── Login (OAuth Authorization Code Flow via CDP browser) ─────────────

  /**
   * Đăng nhập Gemini CLI qua Google OAuth2 Authorization Code flow.
   *
   * Flow:
   * 1. Tạo Google OAuth URL với redirect_uri=http://localhost:11451
   * 2. Mở browser CDP, user đăng nhập Google
   * 3. Google redirect về localhost:11451?code=AUTH_CODE
   * 4. proxyHandler.onRequest() bắt URL → emit GEMINI_CLI_EVENTS.AUTH_CODE → { code, state }
   * 5. captureCredentialsViaCDP nhận { code, state } qua cookieEvent → validate → exchange tokens
   * 6. Lấy project_id từ Cloud Resource Manager
   * 7. Trả credential JSON
   */
  async login() {
    const state =
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    const params = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: OAUTH_CALLBACK_URI,
      response_type: 'code',
      scope: OAUTH_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Khởi tạo HTTP server tạm thời để bắt callback OAuth từ Google
    // Vì Chrome thường bypass proxy cho localhost, ta cần server thực sự listen port 11451
    let localServer: http.Server | null = null;

    try {
      localServer = http.createServer((req, res) => {
        const urlObj = new URL(req.url || '/', `http://${OAUTH_CALLBACK_HOST}`);
        const code = urlObj.searchParams.get('code');
        const receivedState = urlObj.searchParams.get('state');

        if (code && receivedState === state) {
          // Serialize payload thành JSON string để loginService.cookieEventListener
          // gán vào capturedCookies, sau đó validate() sẽ JSON.parse lại.
          const payloadStr = JSON.stringify({ code, state: receivedState });
          proxyEvents.emit(GEMINI_CLI_EVENTS.AUTH_CODE, payloadStr);

          // Trả về HTML thông báo thành công cho user
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Login Successful</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h1>✅ Đăng nhập thành công!</h1>
              <p>Bạn có thể đóng tab này và quay lại ứng dụng.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
            </html>
          `);
        } else {
          // Callback không khớp state hoặc thiếu code — vẫn trả 200 để tránh lỗi trình duyệt
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h1>Lỗi: Invalid callback</h1></body></html>');
        }
      });

      // Bind server vào port 11451
      await new Promise<void>((resolve, reject) => {
        localServer!.listen(OAUTH_CALLBACK_PORT, '127.0.0.1', () => {
          resolve();
        });
        localServer!.on('error', (err) => {
          logger.error('[GeminiCli] Failed to start local OAuth server:', err);
          reject(err);
        });
      });

      // captureCredentialsViaCDP mở browser, chờ user login,
      // HTTP server ở trên sẽ bắt redirect và emit AUTH_CODE event.
      // loginService nhận event qua cookieEvent listener → validate → exchange tokens.
      const captureResult = await loginService.captureCredentialsViaCDP({
        providerId: PROVIDER_ID,
        loginUrl: authUrl,
        partition: `gemini-cli-${Date.now()}`,
        timeout: 300000,
        cookieEvent: GEMINI_CLI_EVENTS.AUTH_CODE,
        validate: async (data: {
          cookies: string;
          email?: string;
          headers?: any;
        }) => {
          if (!data.cookies) return { isValid: false };
          try {
            // proxyEvents.emit(AUTH_CODE, { code, state }) →
            // loginService gọi cookieEventListener(data) với data = { code, state }
            // capturedCookies = JSON.stringify({ code, state }) nếu object, hoặc raw string
            const payload: { code?: string; state?: string } =
              typeof data.cookies === 'string' && data.cookies.startsWith('{')
                ? JSON.parse(data.cookies)
                : { code: data.cookies as string, state: '' };

            if (payload.code && payload.state === state) {
              return { isValid: true, cookies: payload.code };
            }
          } catch {
            if (typeof data.cookies === 'string' && data.cookies.length > 10) {
              return { isValid: true, cookies: data.cookies };
            }
          }
          return { isValid: false };
        },
      });

      const authCode = captureResult?.cookies ?? '';
      if (!authCode) {
        throw new Error('Không lấy được authorization code từ Google OAuth');
      }

      // Exchange code → tokens
      const tokenBody = new URLSearchParams({
        code: authCode,
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        redirect_uri: OAUTH_CALLBACK_URI,
        grant_type: 'authorization_code',
      });

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/x-www-form-urlencoded',
        },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(
          `Token exchange failed (${tokenRes.status}): ${errText.slice(0, 300)}`,
        );
      }

      const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

      if (!tokenData.access_token) {
        throw new Error(
          `Token exchange error: ${tokenData.error_description ?? tokenData.error ?? 'No access_token'}`,
        );
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token ?? '';
      const expiresIn = tokenData.expires_in ?? 3600;
      const expiryDate = new Date(Date.now() + expiresIn * 1000);

      // Lấy email
      let email = '';
      try {
        const userInfoRes = await fetch(USERINFO_ENDPOINT, {
          headers: {
            [HTTP_HEADER_NAMES.AUTHORIZATION]: `Bearer ${accessToken}`,
          },
        });
        if (userInfoRes.ok) {
          const userInfo = (await userInfoRes.json()) as GoogleUserInfo;
          email = userInfo.email ?? '';
        }
      } catch (e) {
        logger.warn(
          `[GeminiCli] Failed to fetch userinfo: ${(e as Error).message}`,
        );
      }

      // Lấy project_id
      const projectId = await this.selectProjectId(accessToken);

      const credential = this.serializeCredential({
        token: accessToken,
        refresh_token: refreshToken,
        project_id: projectId,
        expiry: expiryDate.toISOString(),
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        token_uri: TOKEN_ENDPOINT,
        scopes: OAUTH_SCOPES,
      });

      return {
        success: true,
        cookies: credential,
        email,
      };
    } finally {
      // Đảm bảo đóng HTTP server tạm thời dù login thành công hay thất bại
      if (localServer) {
        localServer.close(() => {});
      }
    }
  }

  /**
   * Lấy project_id từ Cloud Resource Manager.
   * - 1 project active → dùng luôn
   * - Nhiều project → ưu tiên project có chữ "default" trong tên/ID
   * - Không lấy được → trả chuỗi rỗng (user có thể sửa sau)
   */
  private async selectProjectId(accessToken: string): Promise<string> {
    try {
      const res = await fetch(
        `${RESOURCE_MANAGER_API}?filter=lifecycleState:ACTIVE`,
        {
          headers: {
            [HTTP_HEADER_NAMES.AUTHORIZATION]: `Bearer ${accessToken}`,
          },
        },
      );

      if (!res.ok) {
        logger.warn(
          `[GeminiCli] Failed to list projects (${res.status}), project_id will be empty`,
        );
        return '';
      }

      const data = (await res.json()) as {
        projects?: Array<{ projectId: string; name: string }>;
      };

      const projects = data.projects ?? [];

      if (projects.length === 0) {
        logger.warn('[GeminiCli] No active GCP projects found');
        return '';
      }

      if (projects.length === 1) {
        return projects[0].projectId;
      }

      // Nhiều project → ưu tiên project có "default" trong tên/ID
      const defaultProject = projects.find(
        (p) =>
          p.projectId.toLowerCase().includes('default') ||
          p.name.toLowerCase().includes('default'),
      );

      if (defaultProject) {
        return defaultProject.projectId;
      }

      return projects[0].projectId;
    } catch (e) {
      logger.warn(`[GeminiCli] selectProjectId error: ${(e as Error).message}`);
      return '';
    }
  }

  // ─── Request Helpers ──────────────────────────────────────────────────

  /**
   * Tạo request headers cho Code Assist API.
   */
  private buildHeaders(token: string, model: string): Record<string, string> {
    return {
      [HTTP_HEADER_NAMES.AUTHORIZATION]: `Bearer ${token}`,
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES.USER_AGENT]: buildUserAgent(model),
    };
  }

  /**
   * Tạo payload gửi lên Code Assist API.
   */
  private buildPayload(
    model: string,
    projectId: string,
    innerRequest: GeminiInnerRequest,
  ): CodeAssistRequest {
    const baseModel = getBaseModelName(model);
    return {
      model: baseModel,
      project: projectId,
      request: innerRequest,
    };
  }

  /**
   * Gọi Code Assist API với retry tự động.
   * Retry trên các status code: 429, 500, 503.
   */
  private async callWithRetry(
    url: string,
    headers: Record<string, string>,
    payload: CodeAssistRequest,
  ): Promise<NodeFetchResponse> {
    const { MAX_RETRIES, RETRY_INTERVAL_MS, RETRYABLE_STATUS_CODES } =
      RETRY_CONFIG;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        // Nếu có thể retry
        if (
          attempt < MAX_RETRIES &&
          RETRYABLE_STATUS_CODES.includes(res.status as 429 | 500 | 503)
        ) {
          logger.warn(
            `[GeminiCli] Request failed (${res.status}), retry ${attempt + 1}/${MAX_RETRIES}...`,
          );
          await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
          continue;
        }

        return res;
      } catch (e) {
        lastError = e as Error;
        if (attempt < MAX_RETRIES) {
          logger.warn(
            `[GeminiCli] Network error, retry ${attempt + 1}/${MAX_RETRIES}: ${lastError.message}`,
          );
          await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
        }
      }
    }

    throw lastError ?? new Error('Request failed after all retries');
  }

  // ─── Handle Message ────────────────────────────────────────────────────

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
      onCredentialRotated,
    } = options;

    try {
      // 1. Ensure valid credential (auto-refresh nếu cần)
      const { cred, rawCredential, rotated } =
        await this.ensureValidCredential(credential);

      // Notify caller nếu credential đã được rotate
      if (rotated && onCredentialRotated) {
        try {
          await onCredentialRotated(rawCredential);
        } catch (e) {
          logger.warn(
            `[GeminiCli] onCredentialRotated callback failed: ${(e as Error).message}`,
          );
        }
      }

      // 2. Build request
      const innerRequest = buildInnerRequest(messages, model);
      const payload = this.buildPayload(model, cred.project_id, innerRequest);
      const baseModel = getBaseModelName(model);
      const headers = this.buildHeaders(cred.token, baseModel);

      // 3. Call API — stream endpoint
      const streamUrl = `${CODE_ASSIST_ENDPOINT}${API_PATHS.STREAM_GENERATE}${STREAM_QUERY_PARAMS}`;
      const res = await this.callWithRetry(streamUrl, headers, payload);

      // 4. Handle error response
      if (!res.ok) {
        const errText = await res.text();
        let errorDetail = errText;
        try {
          const errJson = JSON.parse(errText);
          errorDetail = errJson?.error?.message ?? errJson?.message ?? errText;
        } catch {
          // Keep raw text
        }
        throw new Error(
          `Code Assist API error (${res.status}): ${errorDetail.slice(0, 500)}`,
        );
      }

      // 5. Stream response body
      if (!res.body) {
        throw new Error('Response body is null');
      }

      let hasContent = false;
      let hasThinking = false;

      for await (const chunk of parseSSEStream(
        res.body as AsyncIterable<Buffer>,
      )) {
        if (chunk.type === 'error') {
          logger.warn(`[GeminiCli] SSE parse error: ${chunk.message}`);
          continue;
        }

        if (chunk.type === 'done') break;

        if (chunk.type !== 'data' || !chunk.data) continue;

        // Raw callback
        if (onRaw && chunk.raw) {
          onRaw(chunk.raw);
        }

        // Extract content
        const { text, thinking, finishReason } = extractContentFromResponse(
          chunk.data,
        );

        if (thinking && onThinking) {
          hasThinking = true;
          onThinking(thinking);
        }

        if (text) {
          hasContent = true;
          onContent(text);
        }

        // Usage metadata
        if (chunk.data.usageMetadata && onMetadata) {
          onMetadata({
            usage: chunk.data.usageMetadata,
            finishReason,
          });
        }
      }

      onDone();
    } catch (e) {
      logger.error(`[GeminiCli] handleMessage error: ${(e as Error).message}`);
      onError(e);
    }
  }
}

// ─── Default Export ──────────────────────────────────────────────────────

export default new GeminiCliProvider();
