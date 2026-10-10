/**
 * ------------------------------------------------------------------
 * Freebuff CLI SSE Parser
 * ------------------------------------------------------------------
 * Parse SSE response stream từ codebuff.com/api/v1/chat/completions.
 * Response stream tuân theo format OpenAI-compatible SSE, nhưng
 * có thêm field `reasoning_content` trong delta cho thinking models.
 *
 * Main export:
 * - parseFreebuffCliSSE() : Parse stream và emit content/thinking/metadata
 * ------------------------------------------------------------------
 */

// ─── Imports ─────────────────────────────────────────────────────────────

import { createLogger } from '../../utils/logger';
import { countTokens } from '../../utils/tokenizer';
import { FreebuffCliSSEChunk, FreebuffCliParseResult } from './freebuff-cli.types';
import { SSE_PROTOCOL } from './freebuff-cli.constant';

// ─── Logger ──────────────────────────────────────────────────────────────

const logger = createLogger('FreebuffCliSSEParser');

// ─── Callbacks Interface ──────────────────────────────────────────────────

export interface FreebuffCliParserCallbacks {
  /** Phát ra content text chunk */
  onContent: (chunk: string) => void;
  /** Phát ra thinking/reasoning chunk (optional) */
  onThinking?: (chunk: string) => void;
  /** Phát ra metadata update (token count, model...) */
  onMetadata?: (meta: Record<string, unknown>) => void;
  /** Dữ liệu SSE thô để debug */
  onRaw?: (data: string) => void;
  /** Số token prompt (để cộng vào total) */
  promptTokens: number;
  /** Ref để tích luỹ completion tokens */
  completionTokensRef: { value: number };
}

// ─── Parser ───────────────────────────────────────────────────────────────

/**
 * Parse SSE stream từ Freebuff CLI endpoint.
 * Stream theo OpenAI format: mỗi event là `data: <json>` hoặc `data: [DONE]`.
 *
 * Thinking content nằm trong `choices[0].delta.reasoning_content`.
 * Content nằm trong `choices[0].delta.content`.
 *
 * @returns FreebuffCliParseResult chứa content/thinking đã tích luỹ + usage
 */
export async function parseFreebuffCliSSE(
  responseBody: NodeJS.ReadableStream,
  callbacks: FreebuffCliParserCallbacks,
): Promise<FreebuffCliParseResult> {
  const {
    onContent,
    onThinking,
    onMetadata,
    onRaw,
    promptTokens,
    completionTokensRef,
  } = callbacks;

  let buffer = '';
  let accumulatedContent = '';
  let accumulatedThinking = '';
  let lastUsage: FreebuffCliParseResult['usage'] | undefined;
  let isThinkingActive = false;

  for await (const chunk of responseBody) {
    const chunkStr = (chunk as Buffer).toString('utf8');
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;

    // Tách từng dòng SSE
    const lines = buffer.split('\n');
    // Dòng cuối chưa có '\n' → giữ lại trong buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX)) continue;

      const jsonStr = trimmed.slice(SSE_PROTOCOL.DATA_PREFIX.length).trim();
      if (jsonStr === SSE_PROTOCOL.DONE_MARKER) {
        // Stream kết thúc bình thường
        return { accumulatedContent, accumulatedThinking, usage: lastUsage };
      }

      let parsed: FreebuffCliSSEChunk;
      try {
        parsed = JSON.parse(jsonStr) as FreebuffCliSSEChunk;
      } catch (e) {
        logger.warn(
          `[FreebuffCLI] SSE JSON parse error — line="${trimmed.slice(0, 200)}"`,
        );
        continue;
      }

      // ── Usage metadata ────────────────────────────────────────────
      if (parsed.usage) {
        lastUsage = parsed.usage;
        if (onMetadata) {
          onMetadata({
            prompt_tokens: parsed.usage.prompt_tokens,
            completion_tokens: parsed.usage.completion_tokens,
            total_token: parsed.usage.total_tokens,
          });
        }
      }

      // ── Delta content ─────────────────────────────────────────────
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;

      // Thinking / reasoning content
      if (delta.reasoning_content) {
        const thinkText = delta.reasoning_content;
        if (!isThinkingActive) {
          isThinkingActive = true;
        }
        accumulatedThinking += thinkText;
        completionTokensRef.value += countTokens(thinkText);

        if (onThinking) {
          onThinking(thinkText);
        } else {
          // Nếu không có onThinking handler, wrap rồi emit qua onContent
          onContent(thinkText);
        }

        if (onMetadata) {
          onMetadata({
            total_token: promptTokens + completionTokensRef.value,
          });
        }
      }

      // Regular content
      if (delta.content) {
        const contentText = delta.content;

        // Nếu đang trong thinking mode và chuyển sang content → đóng thinking
        if (isThinkingActive) {
          isThinkingActive = false;
        }

        accumulatedContent += contentText;
        completionTokensRef.value += countTokens(contentText);
        onContent(contentText);

        if (onMetadata) {
          onMetadata({
            total_token: promptTokens + completionTokensRef.value,
          });
        }
      }

      // Finish reason — không cần xử lý thêm, stream sẽ có [DONE] sau
    }
  }

  // Xử lý buffer còn lại (nếu stream kết thúc không có newline cuối)
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX)) {
      const jsonStr = trimmed.slice(SSE_PROTOCOL.DATA_PREFIX.length).trim();
      if (jsonStr !== SSE_PROTOCOL.DONE_MARKER) {
        try {
          const parsed = JSON.parse(jsonStr) as FreebuffCliSSEChunk;
          if (parsed.usage) {
            lastUsage = parsed.usage;
          }
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            accumulatedContent += delta.content;
            onContent(delta.content);
          }
          if (delta?.reasoning_content) {
            accumulatedThinking += delta.reasoning_content;
            if (onThinking) onThinking(delta.reasoning_content);
          }
        } catch {
          // Bỏ qua chunk cuối không parse được
        }
      }
    }
  }

  return { accumulatedContent, accumulatedThinking, usage: lastUsage };
}
