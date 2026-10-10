/**
 * ------------------------------------------------------------------
 * Codex SSE Parser
 * ------------------------------------------------------------------
 * Parse SSE stream từ Codex /backend-api/codex/responses.
 *
 * Codex dùng định dạng SSE chuẩn với JSON payload per-event.
 * Mỗi event có `type` field để xác định loại:
 * - response.output_text.delta   : text content chunk
 * - response.reasoning.delta     : thinking/reasoning chunk
 * - response.function_call_*     : tool call events
 * - response.done                : kết thúc stream (có usage info)
 * - rate_limit_exceeded / error  : lỗi
 *
 * Main exports:
 * - parseCodexSSEStream() : parse stream và gọi callbacks
 * ------------------------------------------------------------------
 */

// ── Types ──
import { SendMessageOptions } from '../../types';
import {
  CodexSSEChunk,
  CodexSSEResponse,
  CodexUsageInfo,
} from './codex.types';
import { SSE_PROTOCOL, SSE_EVENTS } from './codex.constant';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ParseSSEResult {
  /** Response ID từ server */
  responseId: string | null;
  /** Usage info (chỉ có ở event response.done hoặc response.usage) */
  usage: CodexUsageInfo | null;
  /** Error nếu stream kết thúc với lỗi */
  error: Error | null;
  /** Model thực tế được dùng */
  model: string | null;
}

export interface ParseSSECallbacks {
  onContent?: SendMessageOptions['onContent'];
  onThinking?: SendMessageOptions['onThinking'];
  onMetadata?: SendMessageOptions['onMetadata'];
  onRaw?: SendMessageOptions['onRaw'];
}

// ─── Parser ───────────────────────────────────────────────────────────────

/**
 * Parse SSE stream từ Codex responses endpoint.
 *
 * @param body   - Node.js ReadableStream từ fetch response.body
 * @param callbacks - các callback để gửi content ra ngoài
 * @returns thông tin về response sau khi stream kết thúc
 */
export async function parseCodexSSEStream(
  body: NodeJS.ReadableStream,
  callbacks: ParseSSECallbacks,
): Promise<ParseSSEResult> {
  const { onContent, onThinking, onMetadata, onRaw } = callbacks;

  let buffer = '';
  let responseId: string | null = null;
  let usage: CodexUsageInfo | null = null;
  let streamError: Error | null = null;
  let model: string | null = null;

  // Tool call accumulator: partial JSON delta per call_id
  const toolCallBuffers: Map<string, string> = new Map();

  for await (const rawChunk of body) {
    const chunk =
      typeof rawChunk === 'string'
        ? rawChunk
        : (rawChunk as Buffer).toString('utf8');

    buffer += chunk;

    // Process tất cả lines đầy đủ trong buffer
    const lines = buffer.split('\n');
    // Giữ lại dòng cuối chưa hoàn chỉnh
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Forward raw line cho onRaw
      if (onRaw) onRaw(trimmed + '\n');

      if (!trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX)) continue;

      const dataStr = trimmed.slice(SSE_PROTOCOL.DATA_PREFIX.length);

      // [DONE] marker
      if (dataStr === SSE_PROTOCOL.DONE) continue;

      // Parse JSON
      let parsed: CodexSSEChunk;
      try {
        parsed = JSON.parse(dataStr);
      } catch {
        // Không phải JSON hợp lệ — bỏ qua
        continue;
      }

      const eventType = parsed.type as string;

      switch (eventType) {
        // ── Response metadata ──────────────────────────────────────────
        case SSE_EVENTS.RESPONSE_CREATED:
        case SSE_EVENTS.RESPONSE_IN_PROGRESS: {
          const resp = parsed.response as CodexSSEResponse | undefined;
          if (resp?.id) {
            responseId = resp.id;
            if (onMetadata) onMetadata({ response_id: responseId });
          }
          if (resp?.model) {
            model = resp.model;
          }
          break;
        }

        // ── Text content delta ─────────────────────────────────────────
        case SSE_EVENTS.OUTPUT_TEXT_DELTA: {
          const text = parsed.delta?.text;
          if (text && onContent) {
            onContent(text);
          }
          break;
        }

        // ── Reasoning / thinking delta ─────────────────────────────────
        case SSE_EVENTS.REASONING_DELTA:
        case SSE_EVENTS.REASONING_SUMMARY_DELTA: {
          const thinkingText = parsed.delta?.thinking ?? parsed.delta?.text;
          if (thinkingText && onThinking) {
            onThinking(thinkingText);
          }
          break;
        }

        // ── Tool call arguments delta ──────────────────────────────────
        case SSE_EVENTS.FUNCTION_CALL_ARGS_DELTA: {
          // Accumulate partial JSON arguments
          const callId = parsed.item_id ?? String(parsed.output_index ?? 0);
          const argsDelta = parsed.delta?.text ?? '';
          if (argsDelta) {
            const prev = toolCallBuffers.get(callId) ?? '';
            toolCallBuffers.set(callId, prev + argsDelta);
          }
          break;
        }

        // ── Tool call done ─────────────────────────────────────────────
        case SSE_EVENTS.FUNCTION_CALL_ARGS_DONE: {
          // Tool call hoàn thành — có thể emit qua onContent nếu cần
          // (hiện tại chỉ accumulate, không emit ra content)
          break;
        }

        // ── Usage info ─────────────────────────────────────────────────
        case SSE_EVENTS.USAGE: {
          // Một số Codex implementations gửi usage event riêng
          const resp = parsed.response as CodexSSEResponse | undefined;
          if (resp?.usage) {
            usage = resp.usage;
          }
          break;
        }

        // ── Response done ──────────────────────────────────────────────
        case SSE_EVENTS.RESPONSE_DONE: {
          const resp = parsed.response as CodexSSEResponse | undefined;
          if (resp?.id) responseId = resp.id;
          if (resp?.model) model = resp.model;
          if (resp?.usage) {
            usage = resp.usage;
            if (onMetadata) {
              onMetadata({
                total_tokens: usage.total_tokens,
                prompt_tokens: usage.input_tokens,
                completion_tokens: usage.output_tokens,
              });
            }
          }
          // Stream completed normally
          break;
        }

        // ── Rate limit exceeded ────────────────────────────────────────
        case SSE_EVENTS.RATE_LIMIT_EXCEEDED: {
          const resetsIn = parsed.error?.resets_in_seconds;
          const msg = parsed.error?.message ?? 'Rate limit exceeded';
          const fullMsg = resetsIn
            ? `${msg} (resets in ${resetsIn}s)`
            : msg;
          streamError = Object.assign(new Error(fullMsg), {
            code: 'rate_limit_exceeded',
            resetsInSeconds: resetsIn,
          });
          break;
        }

        // ── Generic error ──────────────────────────────────────────────
        case SSE_EVENTS.ERROR:
        case SSE_EVENTS.RESPONSE_FAILED: {
          const errMsg =
            parsed.error?.message ??
            (parsed.response as CodexSSEResponse | undefined)?.error
              ?.message ??
            'Codex stream error';
          const errCode =
            parsed.error?.code ??
            (parsed.response as CodexSSEResponse | undefined)?.error?.code ??
            'unknown';
          streamError = Object.assign(new Error(errMsg), {
            code: errCode,
          });
          break;
        }

        // ── Ignore các events không liên quan ─────────────────────────
        case SSE_EVENTS.OUTPUT_TEXT_DONE:
        case SSE_EVENTS.REASONING_DONE:
        case SSE_EVENTS.REASONING_SUMMARY_DONE:
        case SSE_EVENTS.OUTPUT_ITEM_ADDED:
        case SSE_EVENTS.OUTPUT_ITEM_DONE:
        case SSE_EVENTS.CONTENT_PART_ADDED:
        case SSE_EVENTS.CONTENT_PART_DONE:
        case SSE_EVENTS.RESPONSE_CANCELLED:
          break;

        default:
          // Unknown event type — bỏ qua
          break;
      }
    }
  }

  return { responseId, usage, error: streamError, model };
}
