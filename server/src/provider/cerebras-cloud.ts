import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { loginService } from '../services/login.service';
import { createLogger } from '../utils/logger';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';
import { countTokens } from '../utils/tokenizer';

const logger = createLogger('CerebrasCloudProvider');

// =============================================================================
// CONSTANTS
// =============================================================================

export const BASE_URL = 'https://cloud.cerebras.ai';
export const API_BASE_URL = 'https://api.cerebras.ai';

// =============================================================================
// RATE LIMIT CONFIG (Cerebras Cloud free tier)
// https://inference-docs.cerebras.ai/rate-limits
// =============================================================================

const RATE_LIMITS = {
  requests: {
    perMinute: 5,
    perHour: 150,
    perDay: 2400,
  },
  tokens: {
    perMinute: 30_000,
    perHour: 1_000_000,
    perDay: 1_000_000,
  },
} as const;

const WINDOW_MS = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const;

// =============================================================================
// USAGE TRACKER (per-account, in-memory sliding window)
// =============================================================================

interface UsageWindow {
  // Timestamps (ms) của mỗi request trong window
  requestTimestamps: number[];
  // [timestamp, tokenCount] của mỗi request trong window
  tokenEntries: Array<{ ts: number; tokens: number }>;
}

interface AccountUsage {
  minute: UsageWindow;
  hour: UsageWindow;
  day: UsageWindow;
}

class CerebrasUsageTracker {
  // accountId → usage windows
  private usage: Map<string, AccountUsage> = new Map();

  private getOrCreate(accountId: string): AccountUsage {
    if (!this.usage.has(accountId)) {
      this.usage.set(accountId, {
        minute: { requestTimestamps: [], tokenEntries: [] },
        hour: { requestTimestamps: [], tokenEntries: [] },
        day: { requestTimestamps: [], tokenEntries: [] },
      });
    }
    return this.usage.get(accountId)!;
  }

  /** Xóa các entry đã hết hạn khỏi window */
  private prune(window: UsageWindow, windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    window.requestTimestamps = window.requestTimestamps.filter(
      (ts) => ts > cutoff,
    );
    window.tokenEntries = window.tokenEntries.filter(
      (e) => e.ts > cutoff,
    );
  }

  private countTokens(window: UsageWindow): number {
    return window.tokenEntries.reduce((sum, e) => sum + e.tokens, 0);
  }

  /**
   * Kiểm tra xem account có vượt rate limit không.
   * Trả về null nếu OK, hoặc error message nếu bị giới hạn.
   */
  checkLimit(accountId: string, estimatedTokens: number = 0): string | null {
    const u = this.getOrCreate(accountId);
    const now = Date.now();

    // Prune tất cả windows
    this.prune(u.minute, WINDOW_MS.minute);
    this.prune(u.hour, WINDOW_MS.hour);
    this.prune(u.day, WINDOW_MS.day);

    // Kiểm tra request limits
    if (u.minute.requestTimestamps.length >= RATE_LIMITS.requests.perMinute) {
      const oldest = u.minute.requestTimestamps[0];
      const resetIn = Math.ceil((oldest + WINDOW_MS.minute - now) / 1000);
      return `Rate limit exceeded: ${RATE_LIMITS.requests.perMinute} requests/minute. Reset in ${resetIn}s.`;
    }
    if (u.hour.requestTimestamps.length >= RATE_LIMITS.requests.perHour) {
      const oldest = u.hour.requestTimestamps[0];
      const resetIn = Math.ceil((oldest + WINDOW_MS.hour - now) / 1000);
      return `Rate limit exceeded: ${RATE_LIMITS.requests.perHour} requests/hour. Reset in ${resetIn}s.`;
    }
    if (u.day.requestTimestamps.length >= RATE_LIMITS.requests.perDay) {
      const oldest = u.day.requestTimestamps[0];
      const resetIn = Math.ceil((oldest + WINDOW_MS.day - now) / 1000);
      return `Rate limit exceeded: ${RATE_LIMITS.requests.perDay} requests/day. Reset in ${resetIn}s.`;
    }

    // Kiểm tra token limits (dùng estimated tokens nếu có)
    if (estimatedTokens > 0) {
      const minuteTokens = this.countTokens(u.minute);
      if (minuteTokens + estimatedTokens > RATE_LIMITS.tokens.perMinute) {
        return `Token limit exceeded: ${RATE_LIMITS.tokens.perMinute.toLocaleString()} tokens/minute (current: ${minuteTokens.toLocaleString()}).`;
      }
      const hourTokens = this.countTokens(u.hour);
      if (hourTokens + estimatedTokens > RATE_LIMITS.tokens.perHour) {
        return `Token limit exceeded: ${RATE_LIMITS.tokens.perHour.toLocaleString()} tokens/hour (current: ${hourTokens.toLocaleString()}).`;
      }
      const dayTokens = this.countTokens(u.day);
      if (dayTokens + estimatedTokens > RATE_LIMITS.tokens.perDay) {
        return `Token limit exceeded: ${RATE_LIMITS.tokens.perDay.toLocaleString()} tokens/day (current: ${dayTokens.toLocaleString()}).`;
      }
    }

    return null;
  }

  /** Ghi nhận một request mới */
  recordRequest(accountId: string): void {
    const u = this.getOrCreate(accountId);
    const now = Date.now();
    u.minute.requestTimestamps.push(now);
    u.hour.requestTimestamps.push(now);
    u.day.requestTimestamps.push(now);
  }

  /** Ghi nhận token usage sau khi request hoàn tất */
  recordTokens(accountId: string, tokens: number): void {
    if (tokens <= 0) return;
    const u = this.getOrCreate(accountId);
    const now = Date.now();
    const entry = { ts: now, tokens };
    u.minute.tokenEntries.push(entry);
    u.hour.tokenEntries.push(entry);
    u.day.tokenEntries.push(entry);
  }

  /** Lấy usage hiện tại của account để hiển thị */
  getUsageSummary(accountId: string): object {
    const u = this.getOrCreate(accountId);
    this.prune(u.minute, WINDOW_MS.minute);
    this.prune(u.hour, WINDOW_MS.hour);
    this.prune(u.day, WINDOW_MS.day);

    return {
      requests: {
        minute: { used: u.minute.requestTimestamps.length, limit: RATE_LIMITS.requests.perMinute },
        hour: { used: u.hour.requestTimestamps.length, limit: RATE_LIMITS.requests.perHour },
        day: { used: u.day.requestTimestamps.length, limit: RATE_LIMITS.requests.perDay },
      },
      tokens: {
        minute: { used: this.countTokens(u.minute), limit: RATE_LIMITS.tokens.perMinute },
        hour: { used: this.countTokens(u.hour), limit: RATE_LIMITS.tokens.perHour },
        day: { used: this.countTokens(u.day), limit: RATE_LIMITS.tokens.perDay },
      },
    };
  }
}

// Singleton tracker — shared across all requests
const usageTracker = new CerebrasUsageTracker();

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface CerebrasMessage {
  role: string;
  content: string;
}

export interface CerebrasCompletionPayload {
  messages: CerebrasMessage[];
  model: string;
  stream: boolean;
  temperature?: number;
  max_completion_tokens?: number;
  top_p?: number | string;
  tools?: any[];
}

// =============================================================================
// PROXY HANDLER
// Bắt session token từ cookie khi user đăng nhập qua browser
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('cloud.cerebras.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('authjs.session-token')) {
        logger.debug('[Proxy] Captured Cerebras session-token cookie');
        proxyEvents.emit('cerebras-cookies', reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // Bắt thông tin user từ /api/auth/session
    if (
      host &&
      host.includes('cloud.cerebras.ai') &&
      url.includes('/api/auth/session')
    ) {
      try {
        const json = JSON.parse(body);
        if (json?.user?.email) {
          logger.info(
            `[Proxy] Captured Cerebras user email: ${json.user.email}`,
          );
          proxyEvents.emit('cerebras-user-info', {
            email: json.user.email,
            name: json.user.name,
            id: json.user.id,
          });
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class CerebrasCloudProvider implements Provider {
  name = 'cerebras-cloud';
  proxyHandler = proxyHandler;
  defaultModel = 'llama-3.3-70b';

  // ---------------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------------

  async login() {
    logger.info('Starting Cerebras Cloud login...');

    return await loginService.login({
      providerId: 'cerebras-cloud',
      loginUrl: `${BASE_URL}/`,
      partition: `cerebras-cloud-${Date.now()}`,
      cookieEvent: 'cerebras-cookies',
      infoEvent: 'cerebras-user-info',
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (!data.cookies) return { isValid: false };

        // Kiểm tra có session token không
        const hasSessionToken =
          data.cookies.includes('authjs.session-token') ||
          data.cookies.includes('__Secure-authjs.callback-url');

        if (!hasSessionToken) {
          return { isValid: false };
        }

        let email = data.email;

        // Nếu chưa có email, thử lấy từ profile
        if (!email) {
          logger.info(
            '[CerebrasCloud] Email not captured directly, fetching profile...',
          );
          const profile = await this.getProfile(data.cookies);
          email = profile.email || undefined;
        }

        if (email) {
          return { isValid: true, cookies: data.cookies, email };
        }

        // Chấp nhận nếu có session token dù chưa lấy được email
        return { isValid: true, cookies: data.cookies };
      },
    });
  }

  // ---------------------------------------------------------------------------
  // GET PROFILE
  // ---------------------------------------------------------------------------

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'GET',
        headers: this.buildBaseHeaders(credential, BASE_URL),
      });

      if (response.ok) {
        const json = await response.json() as any;
        if (json?.user) {
          return {
            email: json.user.email || null,
            name: json.user.name,
            id: json.user.id,
          };
        }
      }
      return { email: null };
    } catch (e) {
      logger.error('[CerebrasCloud] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ---------------------------------------------------------------------------
  // GET MODELS
  // ---------------------------------------------------------------------------

  async getModels(credential: string): Promise<any[]> {
    logger.info('Fetching Cerebras Cloud models...');
    try {
      // Lấy API key từ credential (có thể là cookie hoặc Bearer token)
      const apiKey = this.extractApiKey(credential);

      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'accept-language': 'en-US,en;q=0.9',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        // Dùng cookie session
        headers['Cookie'] = credential;
      }

      const response = await fetch(`${API_BASE_URL}/v1/models`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Cerebras Models API returned ${response.status}: ${errorText}`,
        );
        return this.getFallbackModels(`API Error ${response.status}`);
      }

      const json = await response.json() as any;
      const modelsData = json.data || json.models || [];

      if (!Array.isArray(modelsData)) {
        return this.getFallbackModels('Invalid API Format');
      }

      return modelsData.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.description || '',
        context_length: model.context_window || model.max_tokens || 8192,
        is_thinking: false,
      }));
    } catch (e: any) {
      logger.error('Error fetching Cerebras Cloud models:', e);
      return this.getFallbackModels('Exception: ' + e.message);
    }
  }

  private getFallbackModels(debugError?: string) {
    const models: any[] = [
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        context_length: 128000,
        is_thinking: false,
      },
      {
        id: 'llama3.1-8b',
        name: 'Llama 3.1 8B',
        context_length: 128000,
        is_thinking: false,
      },
      {
        id: 'qwen-3-32b',
        name: 'Qwen 3 32B',
        context_length: 32768,
        is_thinking: false,
      },
      {
        id: 'gpt-oss-120b',
        name: 'OpenAI GPT OSS 120B',
        context_length: 65536,
        is_thinking: false,
      },
      {
        id: 'zai-glm-4.7',
        name: 'Z.ai GLM 4.7',
        context_length: 65536,
        is_thinking: true,
      },
    ];

    if (debugError) {
      models.unshift({
        id: 'debug-error',
        name: `⚠️ ${debugError}`,
        context_length: 0,
        is_thinking: false,
      });
    }
    return models;
  }

  // ---------------------------------------------------------------------------
  // HANDLE MESSAGE (gửi tin nhắn mới)
  // ---------------------------------------------------------------------------

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      temperature,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
    } = options;

    const selectedModel = model || this.defaultModel;
    const apiKey = this.extractApiKey(credential);

    // Lấy accountId từ options nếu có (để track per-account usage)
    const accountId = (options as any).accountId || credential.slice(0, 32);

    // ── Rate limit check ──────────────────────────────────────────────────────
    // Ước tính token từ messages để kiểm tra trước khi gửi
    const estimatedInputTokens = messages.reduce(
      (sum, m) => sum + Math.ceil((m.content?.length || 0) / 4),
      0,
    );
    const limitError = usageTracker.checkLimit(accountId, estimatedInputTokens);
    if (limitError) {
      logger.warn(`[CerebrasCloud] Rate limit blocked: ${limitError}`);
      onError(new Error(limitError));
      return;
    }

    // Ghi nhận request ngay khi bắt đầu
    usageTracker.recordRequest(accountId);

    const payload: CerebrasCompletionPayload = {
      messages: messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      model: selectedModel,
      stream: true,
      temperature: typeof temperature === 'number' ? temperature : 1,
      max_completion_tokens: 65000,
      top_p: '0.95',
      tools: [],
    };

    try {
      logger.info(
        `[CerebrasCloud] Sending message to model: ${selectedModel}`,
      );

      const headers = this.buildApiHeaders(credential, apiKey);

      const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cerebras API returned ${response.status}: ${errorText}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Track token usage từ stream
      let totalTokensUsed = 0;
      const wrappedOnMetadata = (meta: any) => {
        if (meta?.total_token && meta.total_token > totalTokensUsed) {
          totalTokensUsed = meta.total_token;
        }
        if (onMetadata) onMetadata(meta);
      };

      await this.parseSSEStream(response.body as NodeJS.ReadableStream, {
        onContent,
        onThinking,
        onMetadata: wrappedOnMetadata,
        onRaw,
      });

      // Ghi nhận token usage sau khi stream hoàn tất
      if (totalTokensUsed > 0) {
        usageTracker.recordTokens(accountId, totalTokensUsed);
        logger.debug(
          `[CerebrasCloud] Recorded ${totalTokensUsed} tokens for account ${accountId}`,
        );
      }

      onDone();
    } catch (err: any) {
      logger.error('[CerebrasCloud] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ---------------------------------------------------------------------------
  // CONTINUE MESSAGE (gửi tin nhắn tiếp theo trong hội thoại)
  // Cerebras dùng OpenAI-compatible API nên chỉ cần gửi toàn bộ messages history
  // ---------------------------------------------------------------------------

  async continueMessage(options: SendMessageOptions): Promise<void> {
    // Cerebras API là stateless (OpenAI-compatible), không có session riêng.
    // "Continue" chỉ đơn giản là gửi lại toàn bộ messages history bao gồm
    // các tin nhắn trước đó — giống hệt handleMessage.
    return this.handleMessage(options);
  }

  // ---------------------------------------------------------------------------
  // SSE STREAM PARSER
  // Parse OpenAI-compatible SSE stream từ Cerebras API
  // Hỗ trợ cả delta.content (nội dung) và delta.reasoning (thinking)
  // ---------------------------------------------------------------------------

  private async parseSSEStream(
    responseBody: NodeJS.ReadableStream,
    opts: {
      onContent: (chunk: string) => void;
      onThinking?: (chunk: string) => void;
      onMetadata?: (meta: any) => void;
      onRaw?: (data: string) => void;
    },
  ): Promise<void> {
    const { onContent, onThinking, onMetadata, onRaw } = opts;

    let buffer = '';

    for await (const chunk of responseBody) {
      const chunkStr = chunk.toString();
      if (onRaw) onRaw(chunkStr);
      buffer += chunkStr;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine === 'data: [DONE]') {
          logger.debug('[CerebrasCloud] Stream complete [DONE]');
          return;
        }

        if (!trimmedLine.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmedLine.substring(6));
          const delta = json.choices?.[0]?.delta;

          if (!delta) continue;

          // Nội dung thinking/reasoning (các model như zai-glm-4.7)
          if (delta.reasoning !== undefined && delta.reasoning !== null) {
            if (onThinking) {
              onThinking(delta.reasoning);
            } else {
              // Fallback: emit thinking như content nếu không có handler riêng
              onContent(`[Thinking] ${delta.reasoning}`);
            }
          }

          // Nội dung chính
          if (delta.content) {
            onContent(delta.content);
          }

          // Metadata: usage, time_info từ chunk cuối
          if (json.usage && onMetadata) {
            onMetadata({
              total_token: json.usage.total_tokens,
              prompt_tokens: json.usage.prompt_tokens,
              completion_tokens: json.usage.completion_tokens,
              reasoning_tokens:
                json.usage.completion_tokens_details?.reasoning_tokens,
            });
          }

          if (json.time_info && onMetadata) {
            onMetadata({
              time_info: json.time_info,
            });
          }

          // finish_reason
          const finishReason = json.choices?.[0]?.finish_reason;
          if (finishReason && onMetadata) {
            onMetadata({ finish_reason: finishReason });
          }
        } catch (_e) {
          // Bỏ qua các dòng JSON không hợp lệ
        }
      }
    }

    logger.debug('[CerebrasCloud] Stream ended naturally');
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Trích xuất API key từ credential.
   * Credential có thể là:
   * - Bearer token trực tiếp: "csk-xxxx..."
   * - Cookie string chứa authjs.session-token
   */
  private extractApiKey(credential: string): string | null {
    // Nếu credential trông như một API key (bắt đầu bằng csk-)
    if (credential.trim().startsWith('csk-')) {
      return credential.trim();
    }

    // Nếu là Bearer token thuần
    if (!credential.includes('=') && !credential.includes(';')) {
      return credential.trim();
    }

    // Không phải API key — là cookie session
    return null;
  }

  /**
   * Build headers cho API endpoint (api.cerebras.ai)
   * Dùng Authorization Bearer nếu có API key, ngược lại dùng Cookie
   */
  private buildApiHeaders(
    credential: string,
    apiKey: string | null,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-site': 'same-site',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'accept-language': 'en-US,en;q=0.9',
      // Stainless SDK headers (giả lập client chính thức để tránh bị chặn)
      'x-stainless-lang': 'js',
      'x-stainless-runtime': 'browser:chrome',
      'x-stainless-runtime-version': '146.0.0',
      'x-stainless-package-version': '1.64.1',
      'x-stainless-os': 'Unknown',
      'x-stainless-arch': 'unknown',
      'x-stainless-retry-count': '0',
      'x-stainless-timeout': '10',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      // Dùng cookie session từ cloud.cerebras.ai
      headers['Cookie'] = credential;
    }

    return headers;
  }

  /**
   * Build headers cho cloud endpoint (cloud.cerebras.ai)
   */
  private buildBaseHeaders(
    credential: string,
    refererBase: string,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      Origin: refererBase,
      Referer: `${refererBase}/`,
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'accept-language': 'en-US,en;q=0.9',
      Cookie: credential,
    };
  }

  // ---------------------------------------------------------------------------
  // ROUTES & MISC
  // ---------------------------------------------------------------------------

  registerRoutes(router: Router) {
    // GET /cerebras-cloud/usage?accountId=xxx — xem usage hiện tại
    router.get('/usage', (req, res) => {
      const accountId = req.query.accountId as string;
      if (!accountId) {
        res.status(400).json({ success: false, message: 'accountId is required' });
        return;
      }
      const summary = usageTracker.getUsageSummary(accountId);
      res.json({ success: true, data: { accountId, usage: summary, limits: RATE_LIMITS } });
    });
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('cerebras') ||
      m.includes('llama3') ||
      m.includes('llama-3') ||
      m.includes('qwen-3') ||
      m.includes('gpt-oss') ||
      m.includes('zai-glm') ||
      m.includes('csk-')
    );
  }
}

export default new CerebrasCloudProvider();
