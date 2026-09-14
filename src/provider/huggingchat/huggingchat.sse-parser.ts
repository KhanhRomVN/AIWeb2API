/**
 * ------------------------------------------------------------------
 * HuggingChat SSE Parser
 * ------------------------------------------------------------------
 * Parse HuggingChat SSE response stream với thinking mode support.
 * Xử lý  tags
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { countTokens } from '../../utils/tokenizer';
import { createLogger } from '../../utils/logger';

// ── Types ──
import { HuggingChatSSEChunk } from './huggingchat.types';

// ── Constants ──
import { STREAM_TYPES, THINK_TAGS, ESCAPE_SEQUENCES } from './huggingchat.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('HuggingChatSSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: { total_token: number }) => void;
  onRaw?: (data: string) => void;
  promptTokens: number;
  completionTokensRef: { value: number };
}

// ─── Main Parser ────────────────────────────────────────────────────────

export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<void> {
  const {
    onContent,
    onThinking,
    onMetadata,
    onRaw,
    promptTokens,
    completionTokensRef,
  } = opts;

  let buffer = '';
  let isThinking = false;

  for await (const chunk of responseBody as any) {
    const chunkStr = chunk.toString().replaceAll(ESCAPE_SEQUENCES.NUL, '');
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line) as HuggingChatSSEChunk;

        if (json.type === STREAM_TYPES.STREAM && json.token) {
          const token = json.token;
          completionTokensRef.value += countTokens(token);

          if (token.includes(THINK_TAGS.OPEN)) {
            isThinking = true;
            const [before, after] = token.split(THINK_TAGS.OPEN);
            if (before) onContent(before);
            if (after && onThinking) onThinking(after);
            else if (after) onContent(after);
          } else if (token.includes(THINK_TAGS.CLOSE)) {
            isThinking = false;
            const [before, after] = token.split(THINK_TAGS.CLOSE);
            if (before && onThinking) onThinking(before);
            else if (before) onContent(before);
            if (after) onContent(after);
          } else {
            if (isThinking && onThinking) onThinking(token);
            else onContent(token);
          }

          if (onMetadata) {
            onMetadata({ total_token: promptTokens + completionTokensRef.value });
          }
        }
      } catch (e) {
        logger.warn('[HuggingChat] Failed to parse SSE line:', e);
      }
    }
  }
}