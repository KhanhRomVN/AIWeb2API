/**
 * ------------------------------------------------------------------
 * Claude SSE Parser
 * ------------------------------------------------------------------
 * Parse Claude SSE response stream (Anthropic Message API format).
 * Xử lý content_block_delta (text/thinking), content_block_start
 * (tool_use), message_start (usage), message_delta (usage + stop_reason),
 * message_stop.
 *
 * Main features:
 * - parseSSEStream() : Parse stream và emit content/thinking/raw chunks
 *
 * Tool use handling:
 * Khi claude gọi tool (bash_tool, view, str_replace, create_file), parser
 * sẽ collect toàn bộ input JSON rồi emit dưới dạng marker:
 *   \n__CLAUDE_TOOL__:{"name":"...","input":{...}}__END_TOOL__\n
 * Zen nhận marker này, parse và convert sang Zen XML tool format.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { ClaudeSSEEvent } from './claude.types';

// ── Constants ──
import {
  SSE_PROTOCOL,
  SSE_EVENT_TYPES,
  CLAUDE_TOOL_MARKER,
} from './claude.constant';

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

// ─── Internal: Tool Block State ──────────────────────────────────────────

/**
 * Trạng thái tích lũy 1 tool call đang được stream.
 * Content block dạng tool_use trong Anthropic streaming:
 *   content_block_start  → { type: "content_block_start", content_block: { type: "tool_use", id, name, input: {} } }
 *   content_block_delta  → { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "..." } }
 *   content_block_stop   → tool input hoàn chỉnh
 */
interface ToolBlockState {
  index: number;
  name: string;
  id: string;
  /** Tích lũy partial_json delta cho tool input. */
  rawJson: string;
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

  // Map từ content block index → trạng thái tool đang tích lũy.
  // Dùng Map vì có thể có nhiều tool block song song (dù hiếm).
  const toolBlocks = new Map<number, ToolBlockState>();

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

      // ── Text delta ────────────────────────────────────────────────
      if (
        json.type === SSE_EVENT_TYPES.CONTENT_BLOCK_DELTA &&
        json.delta?.type === 'text_delta' &&
        json.delta?.text
      ) {
        accumulatedContent += json.delta.text;
        onContent(json.delta.text);
        continue;
      }

      // ── Text delta (fallback: delta có text nhưng không có type) ──
      if (
        json.type === SSE_EVENT_TYPES.CONTENT_BLOCK_DELTA &&
        !json.delta?.type &&
        json.delta?.text
      ) {
        accumulatedContent += json.delta.text;
        onContent(json.delta.text);
        continue;
      }

      // ── Thinking delta ────────────────────────────────────────────
      if (
        json.type === SSE_EVENT_TYPES.CONTENT_BLOCK_DELTA &&
        json.delta?.thinking
      ) {
        if (onThinking) onThinking(json.delta.thinking);
        continue;
      }

      // ── Tool use: bắt đầu block mới ──────────────────────────────
      if (
        json.type === SSE_EVENT_TYPES.CONTENT_BLOCK_START &&
        json.content_block?.type === 'tool_use' &&
        typeof json.index === 'number'
      ) {
        const name = json.content_block.name || '';
        const id = json.content_block.id || '';
        toolBlocks.set(json.index, {
          index: json.index,
          name,
          id,
          rawJson: '',
        });
        continue;
      }

      // ── Tool use: tích lũy input JSON delta ───────────────────────
      if (
        json.type === SSE_EVENT_TYPES.CONTENT_BLOCK_DELTA &&
        json.delta?.type === 'input_json_delta' &&
        typeof json.index === 'number'
      ) {
        const state = toolBlocks.get(json.index);
        if (state && json.delta.partial_json) {
          state.rawJson += json.delta.partial_json;
        }
        continue;
      }

      // ── Tool use: kết thúc block → emit marker ────────────────────
      if (
        json.type === 'content_block_stop' &&
        typeof json.index === 'number'
      ) {
        const state = toolBlocks.get(json.index);
        if (state) {
          toolBlocks.delete(json.index);
          let input: Record<string, unknown> = {};
          if (state.rawJson) {
            try {
              input = JSON.parse(state.rawJson);
            } catch {
              logger.warn(
                `[Claude] Failed to parse tool input JSON for ${state.name}:`,
                state.rawJson.slice(0, 200),
              );
            }
          }
          const payload = JSON.stringify({
            name: state.name,
            id: state.id,
            input,
          });
          const marker = `\n${CLAUDE_TOOL_MARKER.START}${payload}${CLAUDE_TOOL_MARKER.END}\n`;
          accumulatedContent += marker;
          onContent(marker);
        }
        continue;
      }

      // ── Forward usage/stop metadata ───────────────────────────────
      if (onMetadata && (json.usage || json.message?.id)) {
        onMetadata({
          usage: json.usage,
          message_id: json.message?.id,
          stop_reason: json.delta?.stop_reason,
        });
      }

      if (json.type === SSE_EVENT_TYPES.MESSAGE_STOP) {
        stopped = true;
        return { accumulatedContent, stopped };
      }
    }
  }

  return { accumulatedContent, stopped };
}
