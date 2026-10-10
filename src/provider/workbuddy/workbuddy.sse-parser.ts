/**
 * ------------------------------------------------------------------
 * WorkBuddy SSE Parser
 * ------------------------------------------------------------------
 * Parse SSE stream từ WorkBuddy upstream (tương thích OpenAI SSE).
 * WorkBuddy upstream luôn trả về SSE stream (stream=true bắt buộc).
 *
 * Main exports:
 * - parseWorkBuddySseStream() : Parse SSE stream, gọi callbacks
 * ------------------------------------------------------------------
 */

// ── External ──
import { Readable } from 'stream';

// ── Types ──
import { WorkBuddySseChunk } from './workbuddy.types';

// ── Constants ──
import { SSE_PROTOCOL } from './workbuddy.constant';

// ─── Callbacks ────────────────────────────────────────────────────────

export interface WorkBuddySseCallbacks {
  /** Gọi mỗi khi có text content delta */
  onContent?: (text: string) => void;
  /** Gọi khi có reasoning/thinking content (deepseek-r1) */
  onThinking?: (text: string) => void;
  /** Gọi khi có metadata (conversation_id, usage, ...) */
  onMetadata?: (meta: Record<string, any>) => void;
  /** Gọi mỗi khi có raw SSE data line */
  onRaw?: (line: string) => void;
  /** Token tracking */
  promptTokens?: number;
  completionTokensRef?: { value: number };
}

export interface WorkBuddySseResult {
  /** Total content accumulated */
  content: string;
  /** Total reasoning content accumulated */
  thinkingContent: string;
  /** finish_reason của choice cuối */
  finishReason: string | null;
  /** Usage nếu upstream trả về */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Parser ───────────────────────────────────────────────────────────

/**
 * Parse SSE stream từ WorkBuddy upstream → gọi callbacks và trả về result.
 *
 * WorkBuddy/CodeBuddy dùng OpenAI-compatible SSE format:
 *   data: {"id":"...","choices":[{"delta":{"content":"..."},...}],...}
 *   data: [DONE]
 *
 * thinking/reasoning content nằm trong delta.reasoning_content.
 */
export async function parseWorkBuddySseStream(
  body: NodeJS.ReadableStream | Readable,
  callbacks: WorkBuddySseCallbacks = {},
): Promise<WorkBuddySseResult> {
  const {
    onContent,
    onThinking,
    onMetadata,
    onRaw,
    promptTokens = 0,
    completionTokensRef,
  } = callbacks;

  let contentAccum = '';
  let thinkingAccum = '';
  let finishReason: string | null = null;
  let usage: WorkBuddySseResult['usage'] | undefined;

  // Buffer cho line chunking
  let lineBuffer = '';

  const processLine = (line: string) => {
    if (onRaw) onRaw(line);

    if (!line.startsWith(SSE_PROTOCOL.DATA_PREFIX)) return;

    const data = line.slice(SSE_PROTOCOL.DATA_PREFIX.length).trim();

    if (data === SSE_PROTOCOL.DONE) return;
    if (!data) return;

    let chunk: WorkBuddySseChunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      return; // skip malformed JSON
    }

    // Usage từ upstream
    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens,
        completion_tokens: chunk.usage.completion_tokens,
        total_tokens: chunk.usage.total_tokens,
      };
      if (completionTokensRef) {
        completionTokensRef.value = chunk.usage.completion_tokens;
      }
      if (onMetadata) {
        onMetadata({
          usage: {
            prompt_tokens: usage.prompt_tokens || promptTokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
          },
        });
      }
    }

    // Process choices
    if (!chunk.choices?.length) return;

    for (const choice of chunk.choices) {
      const delta = choice.delta;

      // finish_reason
      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      if (!delta) continue;

      // Reasoning/thinking content (deepseek-r1 và tương tự)
      if (delta.reasoning_content && onThinking) {
        thinkingAccum += delta.reasoning_content;
        onThinking(delta.reasoning_content);
      }

      // Regular content
      if (delta.content) {
        contentAccum += delta.content;
        if (onContent) onContent(delta.content);
        if (completionTokensRef) {
          // Rough estimate if no usage provided
          completionTokensRef.value += Math.ceil(delta.content.length / 4);
        }
      }
    }
  };

  // Stream processing
  return new Promise<WorkBuddySseResult>((resolve, reject) => {
    const readable = body as Readable;

    readable.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      lineBuffer += text;

      // Tách thành từng line (SSE format: lines separated by \n)
      const lines = lineBuffer.split('\n');
      // Giữ lại phần chưa kết thúc bằng \n
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed) processLine(trimmed);
      }
    });

    readable.on('end', () => {
      // Xử lý phần còn lại trong buffer
      if (lineBuffer.trim()) {
        processLine(lineBuffer.trim());
      }

      resolve({
        content: contentAccum,
        thinkingContent: thinkingAccum,
        finishReason,
        usage,
      });
    });

    readable.on('error', (err) => {
      reject(err);
    });
  });
}
