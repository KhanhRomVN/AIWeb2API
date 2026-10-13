/**
 * ------------------------------------------------------------------
 * Mistral SSE Parser
 * ------------------------------------------------------------------
 * Parse Mistral chat stream. Mỗi dòng có dạng `<prefix>:<json>` —
 * parser lấy phần JSON sau dấu `:`, đọc `json.patches` và emit phần
 * text từ các patch op `append`/`add` có path chứa `/text`.
 *
 * Main functions:
 * - parseSSEStream() : Parse stream và emit content/raw chunks
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { MistralStreamEvent } from './mistral.types';

// ── Constants ──
import { PATCH_OPS, PATCH_PATH_TEXT_SUFFIX } from './mistral.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('MistralSSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onRaw?: (data: string) => void;
}

export interface ParseSSEResult {
  accumulatedContent: string;
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse Mistral stream và emit từng đoạn content qua `onContent`.
 * Hỗ trợ cả AsyncIterable (từ ImpersonateHttpClient) và ReadableStream (legacy).
 */
export async function parseSSEStream(
  responseBody: AsyncIterable<any> | NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<ParseSSEResult> {
  const { onContent, onRaw } = opts;

  let accumulatedContent = '';
  let buffer = '';

  // Chuyển đổi ReadableStream sang AsyncIterable nếu cần
  const iterable = 
    Symbol.asyncIterator in (responseBody as any)
      ? (responseBody as AsyncIterable<any>)
      : (async function* () {
          const rs = responseBody as NodeJS.ReadableStream;
          for await (const chunk of rs as any) {
            yield chunk;
          }
        })();

  for await (const chunk of iterable) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      if (onRaw) onRaw(line);

      try {
        const jsonStr = line.slice(colonIndex + 1);
        const data = JSON.parse(jsonStr) as MistralStreamEvent;
        if (data?.json?.patches) {
          for (const patch of data.json.patches) {
            if (
              (patch.op === PATCH_OPS.APPEND || patch.op === PATCH_OPS.ADD) &&
              patch.path.includes(PATCH_PATH_TEXT_SUFFIX) &&
              patch.value
            ) {
              const text = patch.value as string;
              accumulatedContent += text;
              onContent(text);
            } else if (
              patch.value &&
              typeof patch.value === 'string' &&
              patch.path.endsWith(PATCH_PATH_TEXT_SUFFIX)
            ) {
              accumulatedContent += patch.value;
              onContent(patch.value);
            }
          }
        }
      } catch (e) {
        logger.warn('[Mistral] Failed to parse SSE line:', e);
      }
    }
  }

  return { accumulatedContent };
}