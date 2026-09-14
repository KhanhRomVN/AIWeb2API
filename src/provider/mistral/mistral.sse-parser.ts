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
 * Caller chịu trách nhiệm gọi `onDone`/`onError` sau khi hàm này
 * resolve/reject.
 */
export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<ParseSSEResult> {
  const { onContent, onRaw } = opts;

  let accumulatedContent = '';

  return new Promise((resolve, reject) => {
    let buffer = '';
    const body = responseBody as any;

    body.on('data', (chunk: Buffer) => {
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
    });

    body.on('end', () => {
      resolve({ accumulatedContent });
    });

    body.on('error', (err: Error) => {
      logger.error('[Mistral] Stream body error:', err);
      reject(err);
    });
  });
}