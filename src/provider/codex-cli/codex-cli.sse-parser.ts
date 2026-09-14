/**
 * ------------------------------------------------------------------
 * Codex CLI SSE Parser
 * ------------------------------------------------------------------
 * Parse Codex CLI SSE response stream từ OpenAI-compatible API.
 * Hỗ trợ nhiều format delta: top-level `delta`, `choices[0].delta.content`,
 * và `message.content.parts[0]`.
 *
 * Main features:
 * - parseSSEStream() : Parse stream và emit content chunks
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { CodexSSEChunk } from './codex-cli.types';

// ── Constants ──
import { SSE_PROTOCOL, API_FIELDS } from './codex-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CodexCLISSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onRaw?: (data: string) => void;
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse Codex CLI SSE stream và emit từng đoạn content qua `onContent`.
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
          const json = JSON.parse(jsonStr) as CodexSSEChunk;

          // Try multiple content paths
          const content =
            json.delta ||
            json.choices?.[0]?.delta?.content ||
            json.message?.content?.parts?.[0];

          if (content) {
            onContent(typeof content === 'string' ? content : JSON.stringify(content));
          }
        } catch (e) {
          logger.warn('[CodexCLI] Failed to parse SSE line:', e);
        }
      }
    }
  }
}