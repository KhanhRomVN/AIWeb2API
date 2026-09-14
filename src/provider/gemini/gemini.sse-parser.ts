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
  let buffer = '';
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

  for await (const chunk of responseBody) {
    const chunkStr = chunk.toString();
    totalBytes += chunkStr.length;
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const texts = extractTextsFromLine(line);
      for (const t of texts) {
        emitDelta(t);
      }
    }
  }

  if (buffer.trim()) {
    const texts = extractTextsFromLine(buffer);
    for (const t of texts) {
      if (t.length > prevText.length) {
        const delta = cleanText(t.slice(prevText.length));
        if (delta) {
          completionTokensRef.value += countTokens(delta);
          onContent(delta);
        }
        prevText = t;
      }
    }
  }

  return { accumulatedContent: prevText, totalBytes };
}