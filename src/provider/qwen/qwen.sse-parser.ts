/**
 * ------------------------------------------------------------------
 * Qwen SSE Parser
 * ------------------------------------------------------------------
 * Parse Qwen SSE response stream với thinking mode support.
 * Xử lý response.created events, reasoning_content, và content chunks.
 *
 * Main features:
 * - parseSSEStream()        : Parse stream, emit content/thinking/metadata
 * - Thinking mode           : Extract reasoning_content từ delta
 * - Session tracking        : Capture conversation_id và parent_message_id
 * - StreamingThinkingParser : Handle inline thinking tags
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { SSEEventPayload, SSEResponseCreated } from './qwen.types';

// ── Constants ──
import {
  SSE_PROTOCOL,
  SSE_EVENT_FIELDS,
} from './qwen.constant';

// ─── Logger ─────────────────────────────────────────────────────────────
const logger = createLogger('QwenSSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: {
    conversation_id?: string;
    parent_message_id?: string;
    last_parent_id?: string;
  }) => void;
  onSessionCreated?: (sessionId: string) => void;
  onRaw?: (data: string) => void;
  onDone: () => void;
  isNewChat: boolean;
  conversationId?: string;
}

export interface ParseSSEResult {
  capturedParentId: string | null;
  totalChunksProcessed: number;
}

// ─── Streaming Thinking Parser ─────────────────────────────────────────

class StreamingThinkingParser {
  private buffer = '';
  private inThinking = false;
  private onContent: (chunk: string) => void;
  private onThinking?: (chunk: string) => void;

  constructor(
    onContent: (chunk: string) => void,
    onThinking?: (chunk: string) => void,
  ) {
    this.onContent = onContent;
    this.onThinking = onThinking;
  }

  feed(chunk: string): void {
    this.buffer += chunk;

    const openTag = 'think';
    const closeTag = '/think';

    while (this.buffer.length > 0) {
      if (!this.inThinking) {
        const openIdx = this.buffer.indexOf(openTag);
        if (openIdx === -1) {
          // No thinking tag found, emit as normal content
          this.onContent(this.buffer);
          this.buffer = '';
          return;
        }

        // Emit content before thinking tag
        if (openIdx > 0) {
          this.onContent(this.buffer.slice(0, openIdx));
        }

        this.buffer = this.buffer.slice(openIdx + openTag.length);
        this.inThinking = true;
      } else {
        const closeIdx = this.buffer.indexOf(closeTag);
        if (closeIdx === -1) {
          // Thinking not closed yet, emit all as thinking
          if (this.onThinking) {
            this.onThinking(this.buffer);
          } else {
            this.onContent('[Thinking] ' + this.buffer);
          }
          this.buffer = '';
          return;
        }

        // Emit thinking content
        const thinkingContent = this.buffer.slice(0, closeIdx);
        if (this.onThinking) {
          this.onThinking(thinkingContent);
        } else {
          this.onContent('[Thinking] ' + thinkingContent + '\n');
        }

        this.buffer = this.buffer.slice(closeIdx + closeTag.length);
        this.inThinking = false;
      }
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      if (this.inThinking) {
        if (this.onThinking) {
          this.onThinking(this.buffer);
        } else {
          this.onContent(`[Thinking] ${this.buffer}`);
        }
      } else {
        this.onContent(this.buffer);
      }
      this.buffer = '';
    }
  }
}

// ─── Main Parser ────────────────────────────────────────────────────────

export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<ParseSSEResult> {
  const {
    onContent,
    onThinking,
    onMetadata,
    onSessionCreated,
    onRaw,
    onDone,
    isNewChat,
  } = opts;

  let buffer = '';
  let conversationIdCaptured = false;
  let parentIdCaptured = false;
  let capturedParentId: string | null = null;
  const thinkingParser = new StreamingThinkingParser(onContent, onThinking);
  let totalChunksProcessed = 0;

  for await (const chunk of responseBody as any) {
    const chunkStr = chunk.toString();
    buffer += chunkStr;
    if (onRaw) onRaw(chunkStr);
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let jsonStr = trimmed;
      if (trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX)) {
        jsonStr = trimmed.slice(SSE_PROTOCOL.DATA_PREFIX_LENGTH).trim();
      } else if (trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX_SHORT)) {
        jsonStr = trimmed.slice(SSE_PROTOCOL.DATA_PREFIX_SHORT_LENGTH).trim();
      } else {
        continue;
      }

      if (jsonStr === SSE_PROTOCOL.DONE) {
        thinkingParser.flush();
        onDone();
        return { capturedParentId, totalChunksProcessed };
      }

      try {
        const json = JSON.parse(jsonStr) as SSEEventPayload;
        totalChunksProcessed++;

        // Handle response.created event
        let responseCreated: SSEResponseCreated | undefined;
        if (json[SSE_EVENT_FIELDS.RESPONSE_CREATED_KEY]) {
          responseCreated = json[SSE_EVENT_FIELDS.RESPONSE_CREATED_KEY];
        } else if (
          json[SSE_EVENT_FIELDS.RESPONSE]?.[SSE_EVENT_FIELDS.CREATED]
        ) {
          responseCreated =
            json[SSE_EVENT_FIELDS.RESPONSE]?.[SSE_EVENT_FIELDS.CREATED];
        }

        if (responseCreated) {
          const chatId = responseCreated[SSE_EVENT_FIELDS.CHAT_ID];
          const responseId = responseCreated[SSE_EVENT_FIELDS.RESPONSE_ID];

          if (isNewChat && !conversationIdCaptured && chatId) {
            conversationIdCaptured = true;
            if (onSessionCreated) {
              onSessionCreated(chatId);
            }
            if (onMetadata) {
              onMetadata({ conversation_id: chatId });
            }
          }

          if (!parentIdCaptured && responseId) {
            parentIdCaptured = true;
            capturedParentId = responseId;
            if (onMetadata) {
              onMetadata({ parent_message_id: responseId });
            }
          }
        }

        // Handle delta content
        const delta = json[SSE_EVENT_FIELDS.CHOICES]?.[0]?.[SSE_EVENT_FIELDS.DELTA];
        if (delta) {
          const reasoningContent = delta[SSE_EVENT_FIELDS.REASONING_CONTENT];
          const content = delta[SSE_EVENT_FIELDS.CONTENT];

          if (reasoningContent && onThinking) {
            onThinking(reasoningContent);
          }

          if (content) {
            thinkingParser.feed(content);
          }
        }
      } catch (e) {
        logger.warn('[Qwen] Failed to parse SSE line:', e);
      }
    }
  }

  thinkingParser.flush();

  if (capturedParentId && onMetadata) {
    onMetadata({ last_parent_id: capturedParentId });
  }

  return { capturedParentId, totalChunksProcessed };
}