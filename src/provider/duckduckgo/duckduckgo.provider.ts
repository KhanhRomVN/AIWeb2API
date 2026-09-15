/**
 * ------------------------------------------------------------------
 * DuckDuckGo Provider
 * ------------------------------------------------------------------
 * Provider implementation cho DuckDuckGo AI API.
 * Hỗ trợ anonymous chat với multiple models.
 *
 * Main features:
 * - handleMessage()        : Gửi tin nhắn với streaming response
 * - No authentication required
 * - VQD token-based requests
 *
 * Credential format: None (anonymous)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import fetch from 'node-fetch';
import { randomUUID, generateKeyPairSync } from 'crypto';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';

// ── DuckDuckGo Imports ──
import {
  DuckDuckGoRequestMessage,
  DuckDuckGoVqdHeaders,
  ChatPayload,
  CircuitBreakerState,
} from './duckduckgo.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  STATUS_URL,
  CHAT_URL,
  MODELS_URL,
  API_PATHS,
  USER_AGENTS,
  HTTP_HEADERS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  API_FIELDS,
  REASONING_EFFORT,
  MODEL_CAPABILITIES,
  DEFAULT_MODEL,
  MODEL_ALIASES,
  FETCH_TIMEOUT_MS,
  DEFAULT_FE_VERSION,
  CB_THRESHOLD,
  CB_COOLDOWN_MS,
} from './duckduckgo.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DuckDuckGoProvider');

// ─── Circuit Breaker ────────────────────────────────────────────────────

const circuitBreaker: CircuitBreakerState = { failures: 0, openedAt: 0 };

function cbIsOpen(): boolean {
  if (circuitBreaker.openedAt === 0) return false;
  if (Date.now() - circuitBreaker.openedAt >= CB_COOLDOWN_MS) {
    circuitBreaker.openedAt = 0;
    return false;
  }
  return true;
}

function cbRecordFailure(): void {
  circuitBreaker.failures++;
  if (circuitBreaker.failures >= CB_THRESHOLD && circuitBreaker.openedAt === 0) {
    circuitBreaker.openedAt = Date.now();
    logger.warn(
      `[DDG-CB] Circuit breaker opened after ${circuitBreaker.failures} consecutive failures`,
    );
  }
}

function cbRecordSuccess(): void {
  if (circuitBreaker.failures > 0) {
    circuitBreaker.failures = 0;
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────

let durablePublicKey: JsonWebKey | null = null;

function getDurablePublicKey(): JsonWebKey {
  if (!durablePublicKey) {
    const { publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicExponent: 0x10001,
    });
    durablePublicKey = {
      ...publicKey.export({ format: 'jwk' }),
      alg: 'RSA-OAEP-256',
      ext: true,
      key_ops: ['encrypt'],
      use: 'enc',
    };
  }
  return durablePublicKey;
}

function normalizeModel(model: string): string {
  return MODEL_ALIASES[model] || model || DEFAULT_MODEL;
}

function getModelCapabilities(model: string) {
  return (
    MODEL_CAPABILITIES[model] || { reasoningEffort: REASONING_EFFORT.NONE }
  );
}

function normalizeMessages(
  value: unknown,
): DuckDuckGoRequestMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message))
      return [];
    const record = message as Record<string, unknown>;
    if (typeof record.role !== 'string') return [];
    return [{ ...record, role: record.role, content: record.content }];
  });
}

function buildChatPayload(
  model: string,
  messages: DuckDuckGoRequestMessage[],
): ChatPayload {
  const capabilities = getModelCapabilities(model);
  const payload: ChatPayload = {
    model,
    messages,
    metadata: {
      toolChoice: {
        NewsSearch: false,
        VideosSearch: false,
        LocalSearch: false,
        WeatherForecast: false,
      },
    },
    canUseTools: false,
    ...(capabilities.reasoningEffort
      ? { reasoningEffort: capabilities.reasoningEffort }
      : {}),
    canUseApproxLocation: null,
    canDelegateImageGeneration: null,
    durableStream: {
      messageId: randomUUID(),
      conversationId: randomUUID(),
      publicKey: getDurablePublicKey(),
    },
  };
  return payload;
}

function extractContent(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  const content = record.content;
  if (typeof content === 'string') return content;
  const message = record.message;
  if (typeof message === 'string') return message;
  return '';
}

function parseDataLine(line: string): unknown | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch (error) {
    return null;
  }
}

// ─── Provider Class ────────────────────────────────────────────────────

export class DuckDuckGoProvider implements Provider {
  name = PROVIDER_NAME;

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
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  private feVersion = DEFAULT_FE_VERSION;
  private cookieJar = new Map<string, string>();

  constructor() {
    this.seedCookies();
  }

  private seedCookies(): void {
    const seededCookies: ReadonlyArray<readonly [string, string]> = [
      ['5', '1'],
      ['ah', 'wt-wt'],
      ['dcs', '1'],
      ['dcm', '3'],
      ['isRecentChatOn', '1'],
    ];
    for (const [name, value] of seededCookies) {
      if (!this.cookieJar.has(name)) {
        this.cookieJar.set(name, value);
      }
    }
  }

  private buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const cookie = Array.from(this.cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    const baseHeaders = {
      [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT,
      'Accept-Encoding': HTTP_HEADERS.ACCEPT_ENCODING,
      'Accept-Language': HTTP_HEADERS.ACCEPT_LANGUAGE,
      'Cache-Control': HTTP_HEADERS.CACHE_CONTROL,
      [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
      Pragma: HTTP_HEADERS.PRAGMA,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}/`,
      Priority: HTTP_HEADERS.PRIORITY,
      'Sec-Ch-Ua': HTTP_HEADERS.SEC_CH_UA,
      'Sec-Ch-Ua-Mobile': HTTP_HEADERS.SEC_CH_UA_MOBILE,
      'Sec-Ch-Ua-Platform': HTTP_HEADERS.SEC_CH_UA_PLATFORM,
      'Sec-Fetch-Dest': HTTP_HEADERS.SEC_FETCH_DEST,
      'Sec-Fetch-Mode': HTTP_HEADERS.SEC_FETCH_MODE,
      'Sec-Fetch-Site': HTTP_HEADERS.SEC_FETCH_SITE,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.LINUX_CHROME,
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    };

    return baseHeaders;
  }

  // ─── Acquire VQD Headers ────────────────────────────────────────────

  private async acquireVqdHeaders(
    signal: AbortSignal,
  ): Promise<DuckDuckGoVqdHeaders> {
    try {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const resp = await fetch(STATUS_URL, {
        method: 'GET',
        headers: this.buildHeaders({
          [HTTP_HEADER_NAMES.ACCEPT]: '*/*',
          'Cache-Control': 'no-store',
          [HTTP_HEADER_NAMES.X_VQD_ACCEPT]: '1',
        }),
        signal,
      });

      if (!resp.ok) {
        return {
          vqd4: null,
          vqdHash1: null,
          status: resp.status,
          retryAfter: resp.headers.get('Retry-After'),
        };
      }

      return {
        vqd4: resp.headers.get(HTTP_HEADER_NAMES.X_VQD_4.toLowerCase()),
        vqdHash1: resp.headers.get(
          HTTP_HEADER_NAMES.X_VQD_HASH_1.toLowerCase(),
        ),
        status: resp.status,
        retryAfter: null,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      return { vqd4: null, vqdHash1: null, status: null, retryAfter: null };
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      messages,
      model,
      onContent,
      onMetadata,
      onDone,
      onError,
    } = options;

    const requestedModel = normalizeModel(model);

    logger.debug('[DuckDuckGo] handleMessage:', {
      model: requestedModel,
      messageCount: messages.length,
    });

    // Circuit breaker fast-fail
    if (cbIsOpen()) {
      onError(
        new Error('DuckDuckGo circuit breaker open — upstream unavailable'),
      );
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error(`Timeout after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);

    try {
      const normalizedMessages = normalizeMessages(messages);

      if (normalizedMessages.length === 0) {
        throw new Error('No messages provided');
      }

      // Acquire VQD headers
      const vqdHeaders = await this.acquireVqdHeaders(controller.signal);

      if (!vqdHeaders.vqd4 && !vqdHeaders.vqdHash1) {
        if (vqdHeaders.status === 429) {
          cbRecordFailure();
          throw new Error('Failed to acquire VQD token: upstream rate limited');
        }
        cbRecordFailure();
        throw new Error('Failed to acquire VQD token');
      }

      // Build chat payload
      const payload = buildChatPayload(requestedModel, normalizedMessages);

      // Send chat request
      const chatHeaders = this.buildHeaders({
        [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.EVENT_STREAM,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        'x-ddg-journey-id': randomUUID().replace(/-/g, ''),
        'x-fe-version': this.feVersion,
        ...(vqdHeaders.vqd4
          ? { [HTTP_HEADER_NAMES.X_VQD_4]: vqdHeaders.vqd4 }
          : {}),
        ...(vqdHeaders.vqdHash1
          ? { [HTTP_HEADER_NAMES.X_VQD_HASH_1]: vqdHeaders.vqdHash1 }
          : {}),
      });

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: chatHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          cbRecordFailure();
          throw new Error(`DuckDuckGo API returned ${response.status}: Rate limited`);
        }
        if (response.status >= 500) {
          cbRecordFailure();
          throw new Error(`DuckDuckGo API returned ${response.status}: Upstream error`);
        }
        throw new Error(`DuckDuckGo API returned ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Parse SSE stream
      const reader = response.body;
      let buffer = '';
      let accumulatedContent = '';

      reader.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          const data = parseDataLine(trimmed);
          if (!data) continue;

          const content = extractContent(data);
          if (content) {
            accumulatedContent += content;
            onContent(content);
          }

          // Extract metadata if available
          const record = data as Record<string, unknown>;
          if (record.action === 'success' || record.status === 'complete') {
            if (onMetadata) {
              onMetadata({
                model: requestedModel,
                finish_reason: 'stop',
              });
            }
          }
        }
      });

      reader.on('end', () => {
        clearTimeout(timeout);
        cbRecordSuccess();
        onDone();
      });

      reader.on('error', (err: Error) => {
        clearTimeout(timeout);
        cbRecordFailure();
        onError(err);
      });
    } catch (err: any) {
      clearTimeout(timeout);
      cbRecordFailure();
      logger.error('[DuckDuckGo] handleMessage error:', {
        message: err.message,
        stack: err.stack,
      });
      onError(err);
    }
  }

  // ─── Login (Not Required) ───────────────────────────────────────────

  async login() {
    // DuckDuckGo doesn't require authentication
    throw new Error('DuckDuckGo does not require authentication');
  }

  // ─── Get User Profile (Not Supported) ───────────────────────────────

  async getUserProfile(): Promise<{
    email: string | null;
    name?: string;
    id?: string;
  }> {
    return { email: null };
  }
}

export default new DuckDuckGoProvider();
