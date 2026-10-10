/**
 * ------------------------------------------------------------------
 * Cline SSE Parser
 * ------------------------------------------------------------------
 * Parse SSE stream từ Cline upstream (OpenAI-compatible format).
 *
 * Core features:
 * - streamToNonStream()          : Aggregate SSE stream thành 1 response object
 * - nonStreamWithContentCheck()  : Aggregate + retry nếu content rỗng
 * - unwrapData()                 : Bóc lớp { data: {...} } của upstream
 *
 * Quirks upstream:
 * - Upstream đôi khi trả 200 nhưng stream chỉ có `reasoning`, không có `content`.
 *   → Khi đó: thử rotate account và retry (tối đa MAX_NONSTREAM_ATTEMPTS lần).
 *   → Nếu vẫn rỗng: fallback đặt `content = reasoning` để client thấy gì đó.
 * - Upstream bọc response trong `{ data: { choices, ... } }` → dùng unwrapData().
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import type { Response as NodeFetchResponse } from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { EMPTY_CONTENT_COOLDOWN_MS, MAX_NONSTREAM_ATTEMPTS, SSE_DONE, DATA_PREFIX, DEFAULT_MODEL } from './cline.constant';
import { clineFetchWithRetry } from './cline.token-manager';
import type { AggregatedChatResponse, ClineChatBody } from './cline.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClineSSEParser');

// Module-level ref để token manager có thể set (tránh circular import)
// Giá trị thực được inject từ token-manager qua export
let _currentAccount: { cooldownUntil: number; accessToken: null | string; expiry: number } | null = null;

export function setCurrentAccountRef(
  acc: typeof _currentAccount,
): void {
  _currentAccount = acc;
}

// ─── Unwrap Data ─────────────────────────────────────────────────────────

/**
 * Upstream Cline đôi khi bọc response trong `{ data: { choices, id, usage } }`.
 * Hàm này bóc lớp đó ra, trả về object OpenAI chuẩn.
 */
export function unwrapData(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj && obj['data'] && typeof obj['data'] === 'object') {
    const d = obj['data'] as Record<string, unknown>;
    if (d['choices'] || d['id'] || d['usage']) return d;
  }
  return obj;
}

// ─── Stream → Non-stream Aggregation ────────────────────────────────────

/**
 * Đọc toàn bộ SSE stream, ghép các delta lại thành 1 response object.
 *
 * Xử lý đặc biệt:
 * - `delta.content` → ghép vào content
 * - `delta.reasoning` → ghép vào reasoning
 * - Nếu cuối stream content rỗng nhưng reasoning không rỗng
 *   → copy reasoning sang content, đánh dấu `reasoning_used_as_content: true`
 *   → caller sẽ phát hiện và retry với account khác
 */
export async function streamToNonStream(
  upstream: NodeFetchResponse,
): Promise<AggregatedChatResponse> {
  const reader = upstream.body!;

  let buf = '';
  let content = '';
  let reasoning = '';
  let finishReason: string | null = null;
  let model = '';
  let id = '';
  let usage: AggregatedChatResponse['usage'] | null = null;

  return new Promise((resolve, reject) => {
    reader.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (!line.startsWith(DATA_PREFIX)) continue;
        const payload = line.slice(DATA_PREFIX.length).trim();
        if (!payload || payload === SSE_DONE) continue;
        try {
          const obj = JSON.parse(payload) as Record<string, unknown>;
          const normalized = unwrapData(obj);
          const choices = normalized['choices'] as Array<{
            delta?: { content?: string; reasoning?: string };
            finish_reason?: string;
          }> | undefined;
          const choice = choices?.[0];
          if (!choice) continue;
          const delta = choice.delta || {};
          if (delta.content) content += delta.content;
          if (delta.reasoning) reasoning += delta.reasoning;
          if (choice.finish_reason) finishReason = choice.finish_reason;
          if (normalized['id']) id = normalized['id'] as string;
          if (normalized['model']) model = normalized['model'] as string;
          if (normalized['usage']) usage = normalized['usage'] as AggregatedChatResponse['usage'];
        } catch {
          /* ignore malformed chunk */
        }
      }
    });

    reader.on('end', () => {
      const msg: AggregatedChatResponse['choices'][0]['message'] = {
        role: 'assistant',
        content,
      };
      if (reasoning) msg.reasoning = reasoning;

      // Fallback: stream chỉ có reasoning, không có content
      if (!content && reasoning) {
        msg.content = reasoning;
        msg.reasoning_used_as_content = true;
      }

      resolve({
        id: id || `gen_${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || DEFAULT_MODEL,
        choices: [
          {
            index: 0,
            message: msg,
            finish_reason: finishReason || 'stop',
            logprobs: null,
            native_finish_reason: finishReason || 'stop',
          },
        ],
        usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    });

    reader.on('error', reject);
  });
}

// ─── Non-stream With Content Check ──────────────────────────────────────

/**
 * Aggregate SSE stream thành non-stream response với content check.
 *
 * Nếu content rỗng sau aggregate:
 *  - Đánh dấu account hiện tại cooldown 30s
 *  - Retry với account khác (tối đa MAX_NONSTREAM_ATTEMPTS lần)
 *  - Nếu vẫn rỗng sau tất cả retry → trả response cuối (ít nhất có reasoning)
 */
export async function nonStreamWithContentCheck(
  credential: string,
  path: string,
  bodyObj: ClineChatBody,
  sessionId: string,
  firstResp: NodeFetchResponse,
  currentAccountRef: { cooldownUntil: number; accessToken: null | string; expiry: number } | null,
): Promise<{ data: AggregatedChatResponse } | { error: { status: number; message: string } }> {
  let lastData: AggregatedChatResponse | null = null;
  let resp: NodeFetchResponse | null = firstResp;

  for (let attempt = 0; attempt < MAX_NONSTREAM_ATTEMPTS; attempt++) {
    if (!resp) {
      const fetched = await clineFetchWithRetry(
        credential,
        path,
        bodyObj as unknown as Record<string, unknown>,
        sessionId,
        true,
      );
      resp = fetched;
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return {
        error: {
          status: resp.status,
          message: `upstream error: ${errText.slice(0, 300)}`,
        },
      };
    }

    const contentType = resp.headers.get('content-type') || '';
    let normalized: AggregatedChatResponse | null = null;

    if (contentType.includes('text/event-stream')) {
      normalized = await streamToNonStream(resp);
    } else {
      try {
        const raw = (await resp.json()) as Record<string, unknown>;
        normalized = unwrapData(raw) as unknown as AggregatedChatResponse;
      } catch {
        normalized = null;
      }
    }

    if (!normalized) {
      return {
        error: { status: 502, message: 'upstream returned non-SSE / unparseable body' },
      };
    }

    lastData = normalized;
    const msg = normalized.choices?.[0]?.message || {} as AggregatedChatResponse['choices'][0]['message'];
    const content = (msg.content || '').trim();
    const reasoning = (msg.reasoning || '').trim();
    const isReasoningFallback = (msg as any).reasoning_used_as_content === true;

    if (content && !isReasoningFallback) {
      return { data: normalized };
    }

    // Content rỗng hoặc chỉ là reasoning fallback → rotate account + retry
    if (reasoning || isReasoningFallback) {
      if (currentAccountRef) {
        currentAccountRef.cooldownUntil = Date.now() + EMPTY_CONTENT_COOLDOWN_MS;
        currentAccountRef.accessToken = null;
        currentAccountRef.expiry = 0;
        logger.warn(`[ClineSSE] Attempt ${attempt + 1}: empty content, cooldown 30s, retrying...`);
      }
      await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 300)));
      resp = null;
      continue;
    }

    // Hoàn toàn rỗng (không có cả reasoning) → retry
    logger.warn(`[ClineSSE] Attempt ${attempt + 1}: completely empty response, retrying...`);
    await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 300)));
    resp = null;
  }

  // Hết retry → trả data cuối (có thể chỉ có reasoning)
  return { data: lastData! };
}
