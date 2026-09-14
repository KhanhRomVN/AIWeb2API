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

// ── Thinking Parser ──
import { createQwenThinkingParser } from './qwen.thinking-parser';

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

export class QwenStreamingThinkingParser {
  private inThinking = false;
  private currentCloseTag = '';
  private buffer = '';
  private onContent: (chunk: string) => void;
  private onThinking?: (chunk: string) => void;
  private chunkCounter = 0;

  // Use char codes to avoid XML parsing issues with angle brackets
  private readonly LT = String.fromCharCode(60);  // <
  private readonly GT = String.fromCharCode(62);  // >
  
  private get openTags() {
    return [
      this.LT + 'thinking' + this.GT,
      this.LT + 'think' + this.GT,
    ];
  }
  
  private get tagPairs(): Record<string, string> {
    return {
      [this.LT + 'thinking' + this.GT]: this.LT + '/thinking' + this.GT,
      [this.LT + 'think' + this.GT]: this.LT + '/think' + this.GT,
    };
  }

  constructor(
    onContent: (chunk: string) => void,
    onThinking?: (chunk: string) => void,
  ) {
    this.onContent = onContent;
    this.onThinking = onThinking;
  }

  feed(chunk: string) {
    this.chunkCounter++;    
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (!this.inThinking) {
        let earliestPos = -1;
        let matchedOpenTag = '';

        for (const tag of this.openTags) {
          const pos = this.buffer.indexOf(tag);
          if (pos !== -1 && (earliestPos === -1 || pos < earliestPos)) {
            earliestPos = pos;
            matchedOpenTag = tag;
          }
        }

        if (earliestPos === -1) {
          let possiblePartial = false;
          for (const tag of this.openTags) {
            for (let i = 1; i < tag.length; i++) {
              if (this.buffer.endsWith(tag.slice(0, i))) {
                const safePart = this.buffer.slice(0, this.buffer.length - i);
                if (safePart) {
                  this.onContent(safePart);
                }
                this.buffer = this.buffer.slice(this.buffer.length - i);
                possiblePartial = true;
                break;
              }
            }
            if (possiblePartial) break;
          }
          if (!possiblePartial) {
            this.onContent(this.buffer);
            this.buffer = '';
          }
          break;
        } else {
          const beforeTag = this.buffer.slice(0, earliestPos);
          if (beforeTag) {
            this.onContent(beforeTag);
          }
          this.inThinking = true;
          this.currentCloseTag = this.tagPairs[matchedOpenTag];
          this.buffer = this.buffer.slice(earliestPos + matchedOpenTag.length);
        }
      } else {
        const endPos = this.buffer.indexOf(this.currentCloseTag);
        if (endPos === -1) {
          let possiblePartial = false;
          for (let i = 1; i < this.currentCloseTag.length; i++) {
            if (this.buffer.endsWith(this.currentCloseTag.slice(0, i))) {
              const safePart = this.buffer.slice(0, this.buffer.length - i);
              if (safePart && this.onThinking) {
                this.onThinking(safePart);
              }
              this.buffer = this.buffer.slice(this.buffer.length - i);
              possiblePartial = true;
              break;
            }
          }
          if (!possiblePartial) {
            if (this.onThinking) {
              this.onThinking(this.buffer);
            }
            this.buffer = '';
          }
          break;
        } else {
          const thinkingText = this.buffer.slice(0, endPos);
          if (thinkingText && this.onThinking) {
            this.onThinking(thinkingText);
          }
          this.inThinking = false;
          this.buffer = this.buffer.slice(endPos + this.currentCloseTag.length);
          if (this.buffer.startsWith('\n')) {
            this.buffer = this.buffer.slice(1);
          }
          this.currentCloseTag = '';
        }
      }
    }
  }

  flush() {
    if (this.buffer) {
      if (this.inThinking && this.onThinking) {
        this.onThinking(this.buffer);
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
  const thinkingParser = new QwenStreamingThinkingParser(onContent, onThinking);
  const normalizedThinkingParser = createQwenThinkingParser();
  let totalChunksProcessed = 0;
  let isInThinkingPhase = false;

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
          const phase = delta[SSE_EVENT_FIELDS.PHASE];
          const extra = delta[SSE_EVENT_FIELDS.EXTRA];
          const status = delta[SSE_EVENT_FIELDS.STATUS];

          // Handle thinking summary phase (when phase = "thinking_summary")
          if (phase === 'thinking_summary') {
            isInThinkingPhase = true;
            
            if (extra) {
              const summaryTitle = extra[SSE_EVENT_FIELDS.SUMMARY_TITLE];
              const summaryThought = extra[SSE_EVENT_FIELDS.SUMMARY_THOUGHT];
              
              // Feed to normalized parser
              const normalizedThinking = normalizedThinkingParser.feedSummary({
                title: summaryTitle?.content,
                thought: summaryThought?.content,
              });
              
              if (normalizedThinking && onThinking) {
                onThinking(normalizedThinking);
              }
            }

            // End thinking phase when status is "finished"
            if (status === 'finished') {
              const closingTag = normalizedThinkingParser.end();
              if (onThinking) {
                onThinking(closingTag);
              }
              isInThinkingPhase = false;
            }
          }

          // Handle reasoning_content field (backward compatibility)
          if (reasoningContent) {
            if (!isInThinkingPhase) {
              isInThinkingPhase = true;
            }
            const normalizedThinking = normalizedThinkingParser.feed(reasoningContent);
            if (onThinking) {
              onThinking(normalizedThinking);
            }
          }

          // Handle regular content (answer phase)
          if (content && phase === 'answer') {
            // End thinking phase if we were in it
            if (isInThinkingPhase) {
              const closingTag = normalizedThinkingParser.end();
              if (onThinking) {
                onThinking(closingTag);
              }
              isInThinkingPhase = false;
            }
            
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