/**
 * ------------------------------------------------------------------
 * Grok Build CLI SSE Parser
 * ------------------------------------------------------------------
 * Parse Grok Build /v1/responses SSE stream.
 *
 * Grok Build dùng OpenAI Responses API SSE format — khác hoàn toàn
 * với Chat Completions SSE format:
 *
 *   event: response.created / response.in_progress      (info, bỏ qua)
 *   event: response.output_item.added                   (info, bỏ qua)
 *   event: response.reasoning_summary_part.added        (info, bỏ qua)
 *   event: response.reasoning_summary_text.delta        → onThinking(delta)
 *   event: response.reasoning_summary_text.done         → đóng </thinking>
 *   event: response.reasoning_summary_part.done         (info, bỏ qua)
 *   event: response.content_part.added                  (info, bỏ qua)
 *   event: response.output_text.delta                   → onContent(delta)
 *   event: response.output_text.done                    (info, bỏ qua)
 *   event: response.output_item.done                    → finish_reason = stop
 *   event: response.completed                           → usage metadata
 *
 * Main exports:
 * - parseGrokBuildSSEStream()  : Parse stream và emit content/thinking/metadata
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { createLogger } from '../../utils/logger';
import {
  createGrokBuildThinkingParser,
  GrokBuildThinkingMetadata,
} from './grok-build-cli.thinking-parser';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GrokBuildSSE');

/** Events mang thông tin nhưng không cần xử lý nội dung. */
const INFO_EVENT_TYPES = new Set([
  'response.created',
  'response.in_progress',
  'response.output_item.added',
  'response.content_part.added',
  'response.output_text.done',
  'response.reasoning_summary_part.added',
  'response.reasoning_summary_part.done',
]);

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseGrokBuildSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: Record<string, unknown>) => void;
  onRaw?: (data: string) => void;
}

export interface ParseGrokBuildSSEResult {
  /** Tổng content text đã emit. */
  accumulatedContent: string;
  /** Usage từ response.completed event. */
  usage: Record<string, unknown> | null;
  /** finish_reason từ response.output_item.done hoặc response.completed. */
  finishReason: string | null;
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse Grok Build SSE stream từ /v1/responses endpoint.
 *
 * @param responseBody - Node.js readable stream từ fetch response.body
 * @param opts - Callbacks cho content, thinking, metadata
 * @returns Promise resolving khi stream kết thúc
 */
export async function parseGrokBuildSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseGrokBuildSSEOptions,
): Promise<ParseGrokBuildSSEResult> {
  const { onContent, onThinking, onMetadata, onRaw } = opts;

  let buffer = '';
  let currentEventType = '';
  let accumulatedContent = '';
  let usage: Record<string, unknown> | null = null;
  let finishReason: string | null = null;
  let totalContentLength = 0;
  let eventCount = 0;

  const thinkingParser = createGrokBuildThinkingParser();

  for await (const chunk of responseBody) {
    const chunkStr = (chunk as Buffer).toString();
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();

      // ── SSE event name line ──────────────────────────────────────
      if (trimmed.startsWith('event: ')) {
        currentEventType = trimmed.slice(7).trim();
        continue;
      }

      // ── Empty line = SSE event boundary, reset event type ────────
      if (!trimmed) {
        currentEventType = '';
        continue;
      }

      // ── [DONE] sentinel ──────────────────────────────────────────
      if (trimmed === 'data: [DONE]') {
        logger.debug('[GrokBuildSSE] stream [DONE] received');
        currentEventType = '';
        continue;
      }

      if (!trimmed.startsWith('data: ')) continue;

      // ── Parse JSON payload ───────────────────────────────────────
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
      } catch (e) {
        logger.warn('[GrokBuildSSE] JSON parse error', {
          line: trimmed.slice(0, 200),
          error: e instanceof Error ? e.message : String(e),
        });
        currentEventType = '';
        continue;
      }

      eventCount++;
      const type = (data.type as string) || currentEventType;

      // ── Log sample events ────────────────────────────────────────
      if (eventCount <= 5) {
        logger.debug('[GrokBuildSSE] event sample', {
          eventCount,
          type,
          dataKeys: Object.keys(data),
          deltaPreview:
            typeof data.delta === 'string'
              ? data.delta.slice(0, 60)
              : undefined,
        });
      }

      // ── Thinking delta ───────────────────────────────────────────
      if (
        type === 'response.reasoning_summary_text.delta' ||
        type === 'response.reasoning.delta' ||
        type === 'response.thinking.delta'
      ) {
        if (typeof data.delta === 'string' && data.delta) {
          const chunk = thinkingParser.feed(data.delta);
          if (onThinking) {
            onThinking(chunk);
          }
        }
        currentEventType = '';
        continue;
      }

      // ── Thinking ended ───────────────────────────────────────────
      if (
        type === 'response.reasoning_summary_text.done' ||
        type === 'response.reasoning.done' ||
        type === 'response.thinking.done'
      ) {
        const closingChunk = thinkingParser.end();
        if (closingChunk && onThinking) {
          onThinking(closingChunk);
        }
        currentEventType = '';
        continue;
      }

      // ── Content delta ────────────────────────────────────────────
      if (
        type === 'response.output_text.delta' ||
        type === 'response.text.delta'
      ) {
        if (typeof data.delta === 'string' && data.delta) {
          accumulatedContent += data.delta;
          totalContentLength += data.delta.length;
          onContent(data.delta);
        }
        currentEventType = '';
        continue;
      }

      // ── Output item done → finish_reason ────────────────────────
      if (type === 'response.output_item.done') {
        finishReason = 'stop';
        if (onMetadata) onMetadata({ finish_reason: 'stop' });
        currentEventType = '';
        continue;
      }

      // ── Response completed → usage ───────────────────────────────
      if (type === 'response.completed' || type === 'response.done') {
        const resp = data.response as Record<string, unknown> | undefined;
        const usageData =
          (resp?.usage as Record<string, unknown>) ||
          (data.usage as Record<string, unknown>);

        if (usageData) {
          usage = usageData;

          // Emit thinking_tokens metadata nếu có reasoning_tokens
          const reasoningTokens = (
            usageData.output_tokens_details as Record<string, unknown>
          )?.reasoning_tokens as number | undefined;

          if (reasoningTokens) {
            // Emit closing tag với reasoning_tokens nếu thinking parser
            // chưa emit (trường hợp response.reasoning_summary_text.done
            // không được fire trước response.completed)
            const lateClose = thinkingParser.end({
              reasoning_tokens: reasoningTokens,
            });
            if (lateClose && onThinking) {
              onThinking(lateClose);
            }
          }

          if (onMetadata) {
            onMetadata({ usage: usageData });
          }
        }

        const status = resp?.status as string | undefined;
        if (status) {
          finishReason = finishReason ?? status;
          if (onMetadata) onMetadata({ finish_reason: status });
        }

        currentEventType = '';
        continue;
      }

      // ── Error event ──────────────────────────────────────────────
      if (type === 'error') {
        logger.error('[GrokBuildSSE] stream error event', { data });
        currentEventType = '';
        continue;
      }

      // ── Info events (bỏ qua) ─────────────────────────────────────
      if (INFO_EVENT_TYPES.has(type)) {
        logger.debug('[GrokBuildSSE] info event', { type });
        currentEventType = '';
        continue;
      }

      // ── Fallback: Chat Completions format ────────────────────────
      // Safety net nếu Grok thay đổi format về Chat Completions SSE.
      if (data.choices && Array.isArray(data.choices)) {
        logger.warn('[GrokBuildSSE] unexpected chat-completions format', {
          type,
        });
        for (const choice of data.choices as Record<string, unknown>[]) {
          const delta = choice.delta as Record<string, unknown> | undefined;
          if (typeof delta?.content === 'string' && delta.content) {
            accumulatedContent += delta.content;
            totalContentLength += delta.content.length;
            onContent(delta.content);
          }
        }
        currentEventType = '';
        continue;
      }

      // ── Unknown event ────────────────────────────────────────────
      logger.warn('[GrokBuildSSE] unknown event type', {
        type,
        dataKeys: Object.keys(data),
      });
      currentEventType = '';
    }
  }

  logger.debug('[GrokBuildSSE] stream ended', {
    totalContentLength,
    totalEvents: eventCount,
    hasUsage: usage !== null,
    finishReason,
  });

  if (totalContentLength === 0) {
    logger.warn(
      '[GrokBuildSSE] stream ended with zero content — check event format',
    );
  }

  return { accumulatedContent, usage, finishReason };
}
