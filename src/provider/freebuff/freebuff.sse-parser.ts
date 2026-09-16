/**
 * ------------------------------------------------------------------
 * Freebuff SSE Parser
 * ------------------------------------------------------------------
 * Phân tích luồng text/event-stream từ Freebuff và chuyển tiếp tới
 * các callback tương ứng.
 * ------------------------------------------------------------------
 */

import { FreebuffSSEEvent } from './freebuff.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('FreebuffSSEParser');

export interface FreebuffParserCallbacks {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onSessionCreated?: (sessionId: string) => void;
  onDone: () => void;
  onError: (err: any) => void;
}

export function parseFreebuffSSE(
  stream: NodeJS.ReadableStream,
  callbacks: FreebuffParserCallbacks,
): void {
  let buffer = '';
  let isDoneEmitted = false;

  const emitDoneOnce = () => {
    if (!isDoneEmitted) {
      isDoneEmitted = true;
      callbacks.onDone();
    }
  };

  stream.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString('utf8');
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;

        const rawJson = line.slice(5).trim();
        if (!rawJson) continue;

        try {
          const event: FreebuffSSEEvent = JSON.parse(rawJson);

          switch (event.type) {
            case 'meta':
              if (event.threadId) {
                if (callbacks.onSessionCreated) {
                  callbacks.onSessionCreated(event.threadId);
                }
                if (callbacks.onMetadata) {
                  callbacks.onMetadata({
                    threadId: event.threadId,
                    model: event.model,
                  });
                }
              }
              break;

            case 'reasoning_delta': {
              const text = event.text || event.delta || '';
              if (text && callbacks.onThinking) {
                callbacks.onThinking(text);
              }
              break;
            }

            case 'delta': {
              const text = event.text || event.delta || '';
              if (text) {
                callbacks.onContent(text);
              }
              break;
            }

            case 'suggestions': {
              const suggestions = event.followups || event.suggestions || [];
              if (callbacks.onMetadata && suggestions.length > 0) {
                callbacks.onMetadata({ suggestions });
              }
              break;
            }

            case 'done':
              emitDoneOnce();
              break;

            case 'title':
              // Event title cuối cùng
              break;

            default:
          }
        } catch (parseErr) {}
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
