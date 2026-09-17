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
 * - VQD challenge solver (vm sandbox) — ported from OmniRouter
 *
 * Credential format: None (anonymous)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { Buffer } from 'node:buffer';
import { randomUUID, generateKeyPairSync } from 'crypto';
import fetch from 'node-fetch';

import { Provider, SendMessageOptions } from '../../types';
import { createLogger } from '../../utils/logger';

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
  USER_AGENTS,
  HTTP_HEADERS,
  CONTENT_TYPES,
  REASONING_EFFORT,
  MODEL_CAPABILITIES,
  MODEL_ALIASES,
  FETCH_TIMEOUT_MS,
  DEFAULT_FE_VERSION,
  CB_THRESHOLD,
  CB_COOLDOWN_MS,
} from './duckduckgo.constant';
import { solveDuckDuckGoChallenge, makeDuckDuckGoFeSignals } from './duckduckgo.vm-challenge';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DuckDuckGoProvider');

const AUTH_TOKEN_URL = `${BASE_URL}/duckchat/v1/auth/token`;
const COUNTRY_URL = `${BASE_URL}/country.json`;
const FE_VERSION_PATTERN = /serp_\d{8}_\d{6}_[A-Z]{2}-[0-9a-f]{20,40}/;
const MODEL_IDS_CACHE_TTL_MS = 10 * 60 * 1000;

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
    logger.warn(`[DDG-CB] Circuit breaker opened after ${circuitBreaker.failures} failures`);
  }
}

function cbRecordSuccess(): void {
  if (circuitBreaker.failures > 0) circuitBreaker.failures = 0;
}

// ─── Other Helpers ──────────────────────────────────────────────────────

function normalizeModel(model: string): string {
  // No default model — if model is empty or invalid, throw error
  if (!model) {
    throw new Error('Model parameter is required');
  }
  return MODEL_ALIASES[model] || model;
}

function getModelCapabilities(model: string) {
  return MODEL_CAPABILITIES[model] || { reasoningEffort: REASONING_EFFORT.NONE };
}

function normalizeMessages(value: unknown): DuckDuckGoRequestMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return [];
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

  return {
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
    reasoningEffort: capabilities.reasoningEffort || REASONING_EFFORT.NONE,
    canUseApproxLocation: null,
    canDelegateImageGeneration: null,
    durableStream: {
      messageId: randomUUID(),
      conversationId: randomUUID(),
      publicKey: getDurablePublicKey(),
    },
  };
}

let durablePublicKey: JsonWebKey | null = null;
function getDurablePublicKey(): JsonWebKey {
  if (!durablePublicKey) {
    const { publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicExponent: 0x10001,
    });
    const exportedKey = publicKey.export({ format: 'jwk' });
    durablePublicKey = {
      ...exportedKey,
      alg: 'RSA-OAEP-256',
      ext: true,
      key_ops: ['encrypt'],
      use: 'enc',
    };
  }
  return durablePublicKey!;
}

function extractContent(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (typeof record.content === 'string') return record.content;
  if (typeof record.message === 'string') return record.message;
  return '';
}

function parseDataLine(line: string): unknown | null {
  if (!line.startsWith('data: ')) return null;
  try { return JSON.parse(line.slice(6)); } catch { return null; }
}

function parseDdgError(body: string): { type?: unknown } | null {
  try { return JSON.parse(body) as { type?: unknown }; } catch { return null; }
}

// ─── Provider Class ────────────────────────────────────────────────────

const SEEDED_COOKIES: ReadonlyArray<readonly [string, string]> = [
  ['5', '1'],
  ['ah', 'wt-wt'],
  ['dcs', '1'],
  ['dcm', '3'],
  ['isRecentChatOn', '1'],
];

const FAKE_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'Accept-Encoding': HTTP_HEADERS.ACCEPT_ENCODING,
  'Accept-Language': HTTP_HEADERS.ACCEPT_LANGUAGE,
  'Cache-Control': HTTP_HEADERS.CACHE_CONTROL,
  Origin: BASE_URL,
  Pragma: HTTP_HEADERS.PRAGMA,
  Referer: `${BASE_URL}/`,
  Priority: HTTP_HEADERS.PRIORITY,
  'Sec-Ch-Ua': HTTP_HEADERS.SEC_CH_UA,
  'Sec-Ch-Ua-Mobile': HTTP_HEADERS.SEC_CH_UA_MOBILE,
  'Sec-Ch-Ua-Platform': HTTP_HEADERS.SEC_CH_UA_PLATFORM,
  'Sec-Fetch-Dest': HTTP_HEADERS.SEC_FETCH_DEST,
  'Sec-Fetch-Mode': HTTP_HEADERS.SEC_FETCH_MODE,
  'Sec-Fetch-Site': HTTP_HEADERS.SEC_FETCH_SITE,
  'User-Agent': USER_AGENTS.LINUX_CHROME,
};

export class DuckDuckGoProvider implements Provider {
  name = PROVIDER_NAME;

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

  private warmed = false;
  private feVersion = DEFAULT_FE_VERSION;
  private pendingVqdHash1: string | null = null;
  private readonly cookieJar = new Map<string, string>();
  private modelsCache: { ids: Set<string>; fetchedAt: number } | null = null;

  constructor() {
    for (const [name, value] of SEEDED_COOKIES) {
      if (!this.cookieJar.has(name)) this.cookieJar.set(name, value);
    }
  }

  // ─── Header / Cookie Helpers ──────────────────────────────────────

  private buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const cookie = Array.from(this.cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    return { ...FAKE_HEADERS, ...extra, ...(cookie ? { Cookie: cookie } : {}) };
  }

  private rememberCookies(headers: any): void {
    // node-fetch Headers
    const raw = typeof headers.raw === 'function' ? headers.raw()['set-cookie'] : null;
    const cookies: string[] = Array.isArray(raw) ? raw : [];
    for (const c of cookies) {
      const pair = c.split(';', 1)[0]?.trim();
      if (!pair) continue;
      const sep = pair.indexOf('=');
      if (sep <= 0) continue;
      this.cookieJar.set(pair.slice(0, sep), pair.slice(sep + 1));
    }
  }

  private rememberChallengeHeader(headers: any): void {
    const nextHash = headers.get ? headers.get('x-vqd-hash-1') : null;
    if (nextHash) this.pendingVqdHash1 = nextHash;
  }

  // ─── Warm Session ─────────────────────────────────────────────────

  private async warmSession(signal: AbortSignal): Promise<void> {
    if (this.warmed || signal.aborted) return;
    this.warmed = true;

    const warmFetch = async (url: string, extra: Record<string, string> = {}): Promise<void> => {
      try {
        const resp = await fetch(url, {
          headers: this.buildHeaders(extra),
          signal: signal as any,
        });
        this.rememberCookies(resp.headers);
        // Extract feVersion from homepage HTML
        if (url === `${BASE_URL}/`) {
          try {
            const html = await resp.text();
            const match = html.match(FE_VERSION_PATTERN);
            if (match) this.feVersion = match[0];
          } catch { /* ignore */ }
        }
      } catch { /* ignore warm errors */ }
    };

    await warmFetch(`${BASE_URL}/`, {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    });
    await warmFetch(COUNTRY_URL);
    await warmFetch(AUTH_TOKEN_URL);
    await warmFetch(`${BASE_URL}/?q=DuckDuckGo+AI+Chat&ia=chat&duckai=1`, {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    });
  }

  // ─── VQD / Auth Headers ───────────────────────────────────────────

  private async acquireVqdHeaders(signal: AbortSignal): Promise<DuckDuckGoVqdHeaders> {
    try {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const resp = await fetch(STATUS_URL, {
        method: 'GET',
        headers: this.buildHeaders({
          Accept: '*/*',
          'Cache-Control': 'no-store',
          'x-vqd-accept': '1',
        }),
        signal: signal as any,
      });
      this.rememberCookies(resp.headers);
      if (!resp.ok) {
        return { vqd4: null, vqdHash1: null, status: resp.status, retryAfter: resp.headers.get('Retry-After') };
      }
      return {
        vqd4: resp.headers.get('x-vqd-4'),
        vqdHash1: resp.headers.get('x-vqd-hash-1'),
        status: resp.status,
        retryAfter: null,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return { vqd4: null, vqdHash1: null, status: null, retryAfter: null };
    }
  }

  private async acquireAuthHeaders(signal: AbortSignal): Promise<DuckDuckGoVqdHeaders> {
    // Use cached pending challenge from previous response first
    if (this.pendingVqdHash1) {
      const challenge = this.pendingVqdHash1;
      this.pendingVqdHash1 = null;
      try {
        return {
          vqd4: null,
          vqdHash1: await solveDuckDuckGoChallenge(challenge, USER_AGENTS.LINUX_CHROME),
          status: null,
          retryAfter: null,
        };
      } catch { /* fall through to fresh acquire */ }
    }

    const headers = await this.acquireVqdHeaders(signal);
    if (headers.vqdHash1) {
      try {
        return {
          vqd4: headers.vqd4,
          vqdHash1: await solveDuckDuckGoChallenge(headers.vqdHash1, USER_AGENTS.LINUX_CHROME),
          status: headers.status,
          retryAfter: headers.retryAfter,
        };
      } catch {
        // Retry once with a fresh challenge
        const retry = await this.acquireVqdHeaders(signal);
        if (retry.vqdHash1) {
          try {
            return {
              vqd4: retry.vqd4,
              vqdHash1: await solveDuckDuckGoChallenge(retry.vqdHash1, USER_AGENTS.LINUX_CHROME),
              status: retry.status,
              retryAfter: retry.retryAfter,
            };
          } catch { /* ignore */ }
        }
        return {
          vqd4: retry.vqd4 ?? headers.vqd4,
          vqdHash1: null,
          status: retry.status ?? headers.status,
          retryAfter: retry.retryAfter ?? headers.retryAfter,
        };
      }
    }
    return headers;
  }

  // ─── Live Model IDs ───────────────────────────────────────────────

  private async getLiveModelIds(signal: AbortSignal): Promise<Set<string> | null> {
    const now = Date.now();
    if (this.modelsCache && now - this.modelsCache.fetchedAt < MODEL_IDS_CACHE_TTL_MS) {
      return this.modelsCache.ids;
    }
    try {
      const resp = await fetch(MODELS_URL, {
        method: 'GET',
        headers: this.buildHeaders({ Accept: 'application/json' }),
        signal: signal as any,
      });
      if (!resp.ok) return null;
      const json = (await resp.json()) as any;
      const models = json?.models;
      if (!Array.isArray(models)) return null;
      const ids = new Set<string>(
        models
          .filter((m: any) => Array.isArray(m?.accessTier) && m.accessTier.includes('free'))
          .map((m: any) => String(m.id ?? ''))
          .filter(Boolean),
      );
      if (ids.size === 0) return null;
      this.modelsCache = { ids, fetchedAt: now };
      return ids;
    } catch {
      return null;
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, model, onContent, onMetadata, onDone, onError } = options;

    const requestedModel = normalizeModel(model);
    logger.debug(`[DuckDuckGo] handleMessage: model=${requestedModel} messages=${messages.length}`);

    if (cbIsOpen()) {
      onError(new Error('DuckDuckGo circuit breaker open — upstream unavailable'));
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let upstreamModel = requestedModel;

    try {
      const normalizedMessages = normalizeMessages(messages);
      if (normalizedMessages.length === 0) throw new Error('No messages provided');

      await this.warmSession(controller.signal);

      // Resolve model against live catalog
      upstreamModel = requestedModel;
      const liveIds = await this.getLiveModelIds(controller.signal);
      if (liveIds && !liveIds.has(upstreamModel)) {
        const aliased = MODEL_ALIASES[upstreamModel] ?? upstreamModel;
        if (!liveIds.has(aliased)) {
          throw new Error(
            `Model "${upstreamModel}" not available in DuckDuckGo catalog. ` +
            `Available models: ${Array.from(liveIds).join(', ')}`,
          );
        }
        if (aliased !== upstreamModel) {
          logger.warn(`[DuckDuckGo] model "${upstreamModel}" aliased to "${aliased}"`);
          upstreamModel = aliased;
        }
      }

      const vqdHeaders = await this.acquireAuthHeaders(controller.signal);
      if (!vqdHeaders.vqd4 && !vqdHeaders.vqdHash1) {
        cbRecordFailure();
        logger.error('[DuckDuckGo] Failed to acquire VQD token:', {
          status: vqdHeaders.status,
          model: upstreamModel,
        });
        if (vqdHeaders.status === 429)
          throw new Error('Failed to acquire VQD token: upstream rate limited');
        throw new Error('Failed to acquire VQD token');
      }

      const sendChat = async (vh: DuckDuckGoVqdHeaders) => {
        const payload = buildChatPayload(upstreamModel, normalizedMessages);
        const resp = await fetch(CHAT_URL, {
          method: 'POST',
          headers: this.buildHeaders({
            Accept: CONTENT_TYPES.EVENT_STREAM,
            'Content-Type': CONTENT_TYPES.JSON,
            'x-ddg-journey-id': randomUUID().replace(/-/g, ''),
            'x-fe-signals': makeDuckDuckGoFeSignals(),
            'x-fe-version': this.feVersion,
            ...(vh.vqd4 ? { 'x-vqd-4': vh.vqd4 } : {}),
            ...(vh.vqdHash1 ? { 'x-vqd-hash-1': vh.vqdHash1 } : {}),
          }),
          body: JSON.stringify(payload),
          signal: controller.signal as any,
        });
        this.rememberCookies(resp.headers);
        this.rememberChallengeHeader(resp.headers);
        return resp;
      };

      let response = await sendChat(vqdHeaders);

      // 418 ERR_CHALLENGE — retry once with fresh VQD (unless ERR_BN_LIMIT)
      if (response.status === 418) {
        const bodyText = await response.text();
        const parsed = parseDdgError(bodyText);
        const errorType = typeof parsed?.type === 'string' ? parsed.type : '';
        
        if (errorType !== 'ERR_BN_LIMIT') {
          this.pendingVqdHash1 = null;
          const freshVqd = await this.acquireAuthHeaders(controller.signal);
          if (freshVqd.vqd4 || freshVqd.vqdHash1) {
            response = await sendChat(freshVqd);
          }
        } else {
          clearTimeout(timeout);
          cbRecordFailure();
          onError(new Error(`DuckDuckGo: ${errorType} — IP/session rate limited`));
          return;
        }
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        if (response.status === 429) cbRecordFailure();
        else if (response.status >= 500) cbRecordFailure();
        throw new Error(`DuckDuckGo API returned ${response.status}: ${errText.slice(0, 200)}`);
      }

      if (!response.body) throw new Error('No response body');

      // Simple stream parsing like OmniRoute
      const reader = response.body as any;
      let buffer = '';

      reader.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.trim() === 'data: [DONE]') continue;
          
          const data = parseDataLine(line);
          const content = extractContent(data);
          
          if (content) {
            onContent(content);
          }
        }
      });

      reader.on('end', () => {
        // Flush remaining buffer
        if (buffer.trim()) {
          const data = parseDataLine(buffer);
          const content = extractContent(data);
          if (content) onContent(content);
        }

        clearTimeout(timeout);
        cbRecordSuccess();
        if (onMetadata) onMetadata({ model: upstreamModel, finish_reason: 'stop' });
        onDone();
      });

      reader.on('error', (err: Error) => {
        clearTimeout(timeout);
        cbRecordFailure();
        logger.error('[DuckDuckGo] Stream error:', err);
        onError(err);
      });
    } catch (err: any) {
      clearTimeout(timeout);
      cbRecordFailure();
      logger.error('[DuckDuckGo] handleMessage error:', err);
      onError(err);
    }
  }

  // ─── Get Models ──────────────────────────────────────────────────────

  async getModels(): Promise<any[]> {
    return [...MODELS];
  }

  // ─── Login (Not Required) ───────────────────────────────────────────

  async login() {
    throw new Error('DuckDuckGo does not require authentication');
  }

  async getUserProfile(): Promise<{ email: string | null }> {
    return { email: null };
  }
}

export default new DuckDuckGoProvider();
