/**
 * ------------------------------------------------------------------
 * Z.AI SSE Parser
 * ------------------------------------------------------------------
 * Parse Z.AI SSE response stream với support cho thinking mode.
 * Xử lý inner `data` object với `phase` ('thinking' hoặc normal) và
 * `delta_content`.
 *
 * Main features:
 * - parseSSEStream() : Parse stream và emit content/thinking chunks
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { SSE_PROTOCOL, CHAT_PAYLOAD_CONSTANTS } from './zai.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZAISSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ZAISSEData {
  phase?: string;
  delta_content?: string;
  done?: boolean;
}

export interface ZAISSEChunk {
  data?: ZAISSEData;
}

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onRaw?: (data: string) => void;
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse Z.AI SSE stream và emit từng đoạn content/thinking qua callbacks.
 * Caller chịu trách nhiệm gọi `onDone`/`onError` sau khi hàm này
 * resolve/reject.
 */
export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<void> {
  const { onContent, onThinking, onRaw } = opts;

  let buffer = '';

  for await (const chunk of responseBody as any) {
    const chunkStr = chunk.toString();
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith(SSE_PROTOCOL.DATA_PREFIX)) continue;

      const dataStr = line.slice(SSE_PROTOCOL.DATA_PREFIX_LENGTH).trim();
      if (dataStr === SSE_PROTOCOL.DONE) {
        return;
      }

      try {
        const json = JSON.parse(dataStr) as ZAISSEChunk;
        const inner = json.data;

        if (inner && typeof inner === 'object') {
          const phase = inner.phase;
          const content = inner.delta_content || '';

          if (phase === CHAT_PAYLOAD_CONSTANTS.PHASE_THINKING) {
            if (content && onThinking) onThinking(content);
          } else {
            if (content) onContent(content);
          }

          if (inner.done) {
            return;
          }
        }
      } catch (e) {
        logger.warn('[Z.AI] Failed to parse SSE line:', e);
      }
    }
  }
}