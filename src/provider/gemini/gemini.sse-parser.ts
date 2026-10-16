/**
 * ------------------------------------------------------------------
 * Gemini SSE Parser
 * ------------------------------------------------------------------
 * Parse streaming response từ Gemini StreamGenerate endpoint.
 * Response là các dòng NDJSON chứa nested JSON; text được trích
 * bằng `extractTextsFromLine` rồi diff với đoạn trước để tính delta.
 *
 * Main features:
 * - parseSSEStream() : Loop stream, emit content delta + metadata
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { countTokens } from '../../utils/tokenizer';

// ── Shared ──
import { readTextLines } from '../_shared/sse';

// ── Helpers ──
import { extractTextsFromLine, cleanText } from './gemini.helpers';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onMetadata?: (meta: Record<string, unknown>) => void;
  onRaw?: (data: string) => void;
  promptTokens: number;
}

export interface ParseSSEResult {
  accumulatedContent: string;
  totalBytes: number;
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse Gemini StreamGenerate response.
 * Gom từng dòng, trích text, tính delta so với text đã emit trước đó
 * và forward qua `onContent`.
 */
export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<ParseSSEResult> {
  const { onContent, onMetadata, onRaw, promptTokens } = opts;

  const completionTokensRef = { value: 0 };
  let prevText = '';
  let totalBytes = 0;

  const emitDelta = (text: string) => {
    if (text.length <= prevText.length) return;
    const delta = cleanText(text.slice(prevText.length));
    if (delta) {
      completionTokensRef.value += countTokens(delta);
      onContent(delta);
      if (onMetadata) {
        onMetadata({
          total_token: promptTokens + completionTokensRef.value,
        });
      }
    }
    prevText = text;
  };

  const lines = readTextLines(responseBody, {
    flushRemainder: true,
    onRaw: (chunk) => {
      totalBytes += chunk.length;
      if (onRaw) onRaw(chunk);
    },
  });

  for await (const line of lines) {
    for (const t of extractTextsFromLine(line)) {
      emitDelta(t);
    }
  }

  return { accumulatedContent: prevText, totalBytes };
}