/**
 * ------------------------------------------------------------------
 * Claude SSE Parser
 * ------------------------------------------------------------------
 * Parse Claude SSE response stream (Anthropic Message API).
 * Xử lý content_block_delta (text/thinking), message_stop, và forward
 * raw chunks nếu cần.
 *
 * Main features:
 * - parseSSEStream() : Parse stream và emit content/thinking/raw chunks
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { ClaudeSSEEvent } from './claude.types';

// ── Constants ──
import { SSE_PROTOCOL, SSE_EVENT_TYPES } from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeSSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onRaw?: (data: string) => void;
}

export interface ParseSSEResult {
  accumulatedContent: string;
  /** `true` khi gặp event `message_stop`. */
  stopped: boolean;
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse Claude SSE stream.
 * Trả về content tích lũy và cờ `stopped` khi gặp `message_stop`.
 * Caller chịu trách nhiệm gọi `onDone` sau khi hàm này return.
 */
export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<ParseSSEResult> {
  const { onContent, onThinking, onRaw } = opts;

  let buffer = '';
  let accumulatedContent = '';
  let stopped = false;

  for await (const chunk of responseBody) {
    const chunkStr = chunk.toString();
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith(SSE_PROTOCOL.DATA_PREFIX)) continue;

      const data = line.substring(SSE_PROTOCOL.DATA_PREFIX.length).trim();
      if (data === SSE_PROTOCOL.DONE) continue;

      let json: ClaudeSSEEvent;
      try {
        json = JSON.parse(data) as ClaudeSSEEvent;
      } catch (e) {
        logger.warn('[Claude] Failed to parse SSE line:', e);
        continue;
      }

      if (
        json.type === SSE_EVENT_TYPES.CONTENT_BLOCK_DELTA &&
        json.delta?.text
      ) {
        accumulatedContent += json.delta.text;
        onContent(json.delta.text);
        continue;
      }

      if (
        json.type === SSE_EVENT_TYPES.CONTENT_BLOCK_DELTA &&
        json.delta?.thinking
      ) {
        if (onThinking) onThinking(json.delta.thinking);
        continue;
      }

      if (json.type === SSE_EVENT_TYPES.MESSAGE_STOP) {
        stopped = true;
        return { accumulatedContent, stopped };
      }
    }
  }

  return { accumulatedContent, stopped };
}