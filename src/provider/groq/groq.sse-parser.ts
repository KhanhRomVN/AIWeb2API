/**
 * ------------------------------------------------------------------
 * Groq SSE Parser
 * ------------------------------------------------------------------
 * Parse Groq SSE response stream từ OpenAI-compatible API.
 *
 * Main features:
 * - parseSSEStream() : Parse stream và emit content chunks
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { GroqSSEEvent } from './groq.types';

// ── Constants ──
import { SSE_PROTOCOL, API_FIELDS } from './groq.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GroqSSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onRaw?: (data: string) => void;
}

// ─── Main Parser ────────────────────────────────────────────────────────

export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<void> {
  const { onContent, onRaw } = opts;

  let buffer = '';

  for await (const chunk of responseBody) {
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
          const json = JSON.parse(
            trimmedLine.substring(SSE_PROTOCOL.DATA_PREFIX.length),
          ) as GroqSSEEvent;
          const delta = json[API_FIELDS.CHOICES]?.[0]?.[API_FIELDS.DELTA];
          const content = delta?.[API_FIELDS.CONTENT];
          if (content) {
            onContent(content);
          }
        } catch (e) {
          logger.warn('[Groq] Failed to parse SSE line:', e);
        }
      }
    }
  }
}