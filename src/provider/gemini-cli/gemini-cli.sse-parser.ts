/**
 * ------------------------------------------------------------------
 * Gemini CLI SSE Parser
 * ------------------------------------------------------------------
 * Parse Gemini CLI SSE response stream từ Cloud Code API.
 * Xử lý nested `response.candidates[0].content.parts[0].text` hoặc
 * fallback sang `candidates[0].content.parts[0].text`.
 *
 * Main features:
 * - parseSSEStream() : Parse stream và emit content chunks
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { GeminiSSEChunk } from './gemini-cli.types';

// ── Constants ──
import { SSE_PROTOCOL, API_FIELDS } from './gemini-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiCLISSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onRaw?: (data: string) => void;
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse Gemini CLI SSE stream và emit từng đoạn content qua `onContent`.
 * Caller chịu trách nhiệm gọi `onDone`/`onError` sau khi hàm này
 * resolve/reject.
 */
export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<void> {
  const { onContent, onRaw } = opts;

  let buffer = '';

  for await (const chunk of responseBody as any) {
    const chunkStr = chunk.toString();
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine === `${SSE_PROTOCOL.DATA_PREFIX}${SSE_PROTOCOL.DONE}`) {
        return;
      }

      if (trimmedLine.startsWith(SSE_PROTOCOL.DATA_PREFIX)) {
        try {
          const jsonStr = trimmedLine.slice(SSE_PROTOCOL.DATA_PREFIX.length).trim();
          const json = JSON.parse(jsonStr) as GeminiSSEChunk;

          // Try response.candidates first, then fallback to candidates
          const responseObj = json.response || json;
          const content =
            responseObj.candidates?.[0]?.content?.parts?.[0]?.text;

          if (content) {
            onContent(content);
          }
        } catch (e) {
          logger.warn('[GeminiCLI] Failed to parse SSE line:', e);
        }
      }
    }
  }
}