/**
 * ------------------------------------------------------------------
 * Claude SSE Parser
 * ------------------------------------------------------------------
 * Parse Claude SSE response stream (Anthropic Message API format).
 * Xử lý content_block_delta (text/thinking), message_start (usage),
 * message_delta (usage + stop_reason), message_stop.
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
  onMetadata?: (meta: Record<string, unknown>) => void;
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
  const { onContent, onThinking, onRaw, onMetadata } = opts;

  let buffer = '';
  let accumulatedContent = '';
  let stopped = false;
  let eventCount = 0;

  logger.debug('[Claude SSE] Bắt đầu đọc response stream');

  for await (const chunk of responseBody) {
    const chunkStr = chunk.toString();
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      // Bỏ qua các dòng rỗng và các field khác (event:, id:, retry:)
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

      eventCount++;
      logger.debug(
        `[Claude SSE] event #${eventCount} type=${json.type}` +
          (json.delta?.text
            ? ` text="${json.delta.text.slice(0, 80)}"`
            : '') +
          (json.delta?.thinking ? ' [thinking]' : ''),
      );

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

      // Forward usage/stop metadata nếu caller quan tâm
      if (onMetadata && (json.usage || json.message?.id)) {
        onMetadata({
          usage: json.usage,
          message_id: json.message?.id,
          stop_reason: json.delta?.stop_reason,
        });
      }

      if (json.type === SSE_EVENT_TYPES.MESSAGE_STOP) {
        logger.debug(
          `[Claude SSE] message_stop — tổng ${eventCount} event, content ${accumulatedContent.length} ký tự`,
        );
        stopped = true;
        return { accumulatedContent, stopped };
      }
    }
  }

  logger.debug(
    `[Claude SSE] Stream kết thúc không có message_stop — tổng ${eventCount} event, content ${accumulatedContent.length} ký tự`,
  );
  return { accumulatedContent, stopped };
}