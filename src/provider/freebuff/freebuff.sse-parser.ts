/**
 * ------------------------------------------------------------------
 * Freebuff SSE Parser
 * ------------------------------------------------------------------
 * Phân tích luồng text/event-stream từ Freebuff và chuyển tiếp tới
 * các callback tương ứng.
 *
 * SSE event types:
 * - meta           : threadId, model, accessTier (emit ở đầu)
 * - delta          : text chunk (content chính)
 * - reasoning_delta: thinking chunk (cho model có thinking)
 * - title          : tiêu đề thread được cập nhật
 * - suggestions    : followup suggestions
 * - done           : stream kết thúc
 * ------------------------------------------------------------------
 */

import { FreebuffSSEEvent } from './freebuff.types';
import { SSE_TYPES } from './freebuff.constant';
import { createLogger } from '../../utils/logger';
import { createFreebuffThinkingParser } from './freebuff.thinking-parser';

const logger = createLogger('FreebuffSSEParser');

// ─── Callbacks Interface ─────────────────────────────────────────────────

export interface FreebuffParserCallbacks {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onSessionCreated?: (sessionId: string) => void;
  onDone: () => void;
  onError: (err: any) => void;
}

// ─── Parser ───────────────────────────────────────────────────────────────

export function parseFreebuffSSE(
  stream: NodeJS.ReadableStream,
  callbacks: FreebuffParserCallbacks,
): void {
  let buffer = '';
  let isDoneEmitted = false;
  const thinkingParser = createFreebuffThinkingParser();

  const emitDoneOnce = () => {
    if (!isDoneEmitted) {
      isDoneEmitted = true;
      callbacks.onDone();
    }
  };

  stream.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString('utf8');

    // SSE dùng double-newline để phân cách events
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      for (const line of trimmed.split('\n')) {
        if (!line.startsWith('data:')) continue;

        const rawJson = line.slice(5).trim();
        if (!rawJson) continue;

        let event: FreebuffSSEEvent;
        try {
          event = JSON.parse(rawJson);
        } catch {
          // Bỏ qua dòng không parse được
          continue;
        }

        handleSSEEvent(event, callbacks, thinkingParser);

        if (event.type === SSE_TYPES.DONE) {
          emitDoneOnce();
        }
      }
    }
  });

  stream.on('end', () => {
    emitDoneOnce();
  });

  stream.on('error', (err) => {
    logger.error('[Freebuff SSE] Stream error:', err);
    callbacks.onError(err);
  });
}

// ─── Event Handler ────────────────────────────────────────────────────────

function handleSSEEvent(
  event: FreebuffSSEEvent,
  callbacks: FreebuffParserCallbacks,
  thinkingParser: ReturnType<typeof createFreebuffThinkingParser>,
): void {
  switch (event.type) {
    case SSE_TYPES.META: {
      if (event.threadId) {
        if (callbacks.onSessionCreated) {
          callbacks.onSessionCreated(event.threadId);
        }
        if (callbacks.onMetadata) {
          callbacks.onMetadata({
            threadId: event.threadId,
            model: event.model,
            accessTier: event.accessTier,
          });
        }
      }
      break;
    }

    case SSE_TYPES.REASONING_DELTA: {
      const text = event.text ?? event.delta ?? '';
      if (text && callbacks.onThinking) {
        // Feed qua thinking parser để wrap với <thinking> tag
        const wrapped = thinkingParser.feed(text);
        callbacks.onThinking(wrapped);
      }
      break;
    }

    case SSE_TYPES.DELTA: {
      const text = event.text ?? event.delta ?? '';
      if (text) {
        // Nếu thinking đang active, đóng nó lại trước khi emit content
        if (thinkingParser.isActive() && callbacks.onThinking) {
          const closingTag = thinkingParser.end();
          if (closingTag) callbacks.onThinking(closingTag);
        }
        callbacks.onContent(text);
      }
      break;
    }

    case SSE_TYPES.SUGGESTIONS: {
      const suggestions = event.followups ?? event.suggestions ?? [];
      if (suggestions.length > 0 && callbacks.onMetadata) {
        callbacks.onMetadata({ suggestions });
      }
      break;
    }

    case SSE_TYPES.TITLE: {
      // Freebuff emit title event khi thread title được cập nhật
      if (callbacks.onMetadata && event.title) {
        callbacks.onMetadata({ title: event.title, threadId: event.threadId });
      }
      break;
    }

    case SSE_TYPES.DONE:
      // Handled ở parseFreebuffSSE
      break;

    default:
      // Unknown event type — bỏ qua
      break;
  }
}
