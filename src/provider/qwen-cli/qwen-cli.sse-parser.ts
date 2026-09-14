/**
 * ------------------------------------------------------------------
 * Qwen CLI SSE Parser
 * ------------------------------------------------------------------
 * Parse OpenAI-compatible SSE stream từ Qwen CLI chat completions.
 *
 * Main functions:
 * - parseSSEStream() : Parse stream và emit content/raw chunks
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { QwenSSEEvent } from './qwen-cli.types';

// ── Constants ──
import { API_FIELDS, SSE_PROTOCOL } from './qwen-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenCLISSE');

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
 * Parse Qwen CLI SSE stream. Trả về content tích lũy.
 * Caller chịu trách nhiệm gọi `onDone`/`onError`.
 */
export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<ParseSSEResult> {
  const { onContent, onRaw } = opts;

  let buffer = '';
  let accumulatedContent = '';

  for await (const chunk of responseBody as any) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX)) continue;
      if (onRaw) onRaw(trimmed);

      const jsonStr = trimmed
        .slice(SSE_PROTOCOL.DATA_PREFIX.length)
        .trim();
      if (jsonStr === SSE_PROTOCOL.DONE) {
        return { accumulatedContent };
      }

      try {
        const json = JSON.parse(jsonStr) as QwenSSEEvent;
        const content = json[API_FIELDS.CHOICES]?.[0]?.[API_FIELDS.DELTA]?.[
          API_FIELDS.CONTENT
        ];
        if (content) {
          accumulatedContent += content;
          onContent(content);
        }
      } catch (e) {
        logger.warn('[QwenCLI] Failed to parse SSE line:', e);
      }
    }
  }

  return { accumulatedContent };
}