/**
 * ------------------------------------------------------------------
 * Kimi SSE Parser
 * ------------------------------------------------------------------
 * Parse Kimi's gRPC-Web Connect stream frames.
 * Hỗ trợ 5-byte header prefix (1 byte flags + 4 bytes length),
 * thinking mode với StreamingThinkingParser, và multi-stage events.
 *
 * Main functions:
 * - parseKimiSSE() : Parse stream và emit content/thinking/metadata
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { KimiSSEEvent, KimiSSEMetadata } from './kimi.types';

// ── Constants ──
import {
  FRAME_PROTOCOL,
  ENCODINGS,
  SSE_EVENT_FIELDS,
  SSE_STAGES,
  SSE_MESSAGE_STATUSES,
  SSE_MASKS,
} from './kimi.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KimiSSEParser');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: KimiSSEMetadata) => void;
  onError?: (err: Error) => void;
  onRaw?: (data: string) => void;
  conversationId?: string;
}

export interface ParseResult {
  conversationId: string;
  accumulatedContent: string;
  isComplete: boolean;
  error?: string;
}

// ─── Streaming Thinking Parser ─────────────────────────────────────────

class KimiStreamingThinkingParser {
  private inThinking = false;
  private currentCloseTag = '';
  private buffer = '';
  private onContent: (chunk: string) => void;
  private onThinking?: (chunk: string) => void;
  private chunkCounter = 0;

  private readonly openTags = ['\u003cthinking\u003e', '\u003cthink\u003e'];
  private readonly tagPairs: Record<string, string> = {
    '\u003cthinking\u003e': '\u003c/thinking\u003e',
    '\u003cthink\u003e': '\u003c/think\u003e',
  };

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

export async function parseKimiSSE(
  stream: NodeJS.ReadableStream,
  options: ParseOptions,
): Promise<ParseResult> {
  const { onContent, onThinking, onMetadata, onRaw } = options;

  let accumulatedContent = '';
  let accumulatedThinking = '';
  let conversationId = options.conversationId || '';
  let isComplete = false;
  let streamError: string | undefined;

  const thinkingParser = new KimiStreamingThinkingParser(
    (chunk: string) => {
      accumulatedContent += chunk;
      if (onContent) onContent(chunk);
    },
    (chunk: string) => {
      accumulatedThinking += chunk;
      if (onThinking) onThinking(chunk);
    },
  );

  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    stream.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= FRAME_PROTOCOL.HEADER_SIZE) {
        const frameLen = buffer.readUInt32BE(FRAME_PROTOCOL.LENGTH_OFFSET);

        if (buffer.length < FRAME_PROTOCOL.HEADER_SIZE + frameLen) {
          break;
        }

        const frameData = buffer.subarray(
          FRAME_PROTOCOL.HEADER_SIZE,
          FRAME_PROTOCOL.HEADER_SIZE + frameLen,
        );
        buffer = buffer.subarray(FRAME_PROTOCOL.HEADER_SIZE + frameLen);

        const frameStr = frameData.toString(ENCODINGS.UTF8).trim();
        if (!frameStr) continue;

        try {
          const event = JSON.parse(frameStr) as KimiSSEEvent;
          processKimiEvent(event);
        } catch (e) {
          logger.warn('[Kimi] Failed to parse SSE frame:', e);
          if (onRaw) onRaw(frameStr);
        }
      }
    });

    stream.on('end', () => {
      thinkingParser.flush();
      resolve({
        conversationId,
        accumulatedContent,
        isComplete,
        error: streamError,
      });
    });

    stream.on('error', (err) => {
      logger.error('[Kimi] SSE stream error:', err);
      reject(err);
    });

    function processKimiEvent(event: KimiSSEEvent) {
      if (onRaw) onRaw(JSON.stringify(event));

      if (event[SSE_EVENT_FIELDS.DONE] !== undefined) {
        isComplete = true;
        return;
      }

      if (event[SSE_EVENT_FIELDS.HEARTBEAT] !== undefined) {
        return;
      }

      if (event[SSE_EVENT_FIELDS.ERROR]) {
        const errMsg =
          event[SSE_EVENT_FIELDS.ERROR]?.[SSE_EVENT_FIELDS.DETAILS]?.[0]?.[
            SSE_EVENT_FIELDS.DEBUG
          ]?.[SSE_EVENT_FIELDS.LOCALIZED_MESSAGE]?.[SSE_EVENT_FIELDS.MESSAGE] ||
          event[SSE_EVENT_FIELDS.ERROR]?.[SSE_EVENT_FIELDS.MESSAGE] ||
          event[SSE_EVENT_FIELDS.ERROR]?.[SSE_EVENT_FIELDS.CODE] ||
          'Kimi API Error';
        logger.warn('[Kimi] Stream Error event:', errMsg);
        streamError = errMsg;
        if (onMetadata) {
          onMetadata({ error: errMsg });
        }
        return;
      }

      if (
        event[SSE_EVENT_FIELDS.CHAT]?.[SSE_EVENT_FIELDS.LAST_REQUEST]?.[
          SSE_EVENT_FIELDS.ID
        ]
      ) {
        conversationId =
          event[SSE_EVENT_FIELDS.CHAT]?.[SSE_EVENT_FIELDS.LAST_REQUEST]?.[
            SSE_EVENT_FIELDS.ID
          ] || '';
        if (onMetadata) {
          onMetadata({ conversation_id: conversationId });
        }
      } else if (event[SSE_EVENT_FIELDS.CHAT]?.[SSE_EVENT_FIELDS.ID]) {
        conversationId = event[SSE_EVENT_FIELDS.CHAT]?.[SSE_EVENT_FIELDS.ID] || '';
        if (onMetadata) {
          onMetadata({ conversation_id: conversationId });
        }
      }

      const textChunk =
        event[SSE_EVENT_FIELDS.BLOCK]?.[SSE_EVENT_FIELDS.TEXT]?.[
          SSE_EVENT_FIELDS.CONTENT
        ] ??
        (event[SSE_EVENT_FIELDS.MASK] === SSE_MASKS.BLOCK_TEXT_CONTENT
          ? event[SSE_EVENT_FIELDS.BLOCK]?.[SSE_EVENT_FIELDS.TEXT]?.[
              SSE_EVENT_FIELDS.CONTENT
            ]
          : undefined);

      if (textChunk && typeof textChunk === 'string') {
        thinkingParser.feed(textChunk);
      }

      const thinkChunk =
        event[SSE_EVENT_FIELDS.BLOCK]?.[SSE_EVENT_FIELDS.THINK]?.[
          SSE_EVENT_FIELDS.CONTENT
        ] ??
        (event[SSE_EVENT_FIELDS.MASK] === SSE_MASKS.BLOCK_THINK_CONTENT
          ? event[SSE_EVENT_FIELDS.BLOCK]?.[SSE_EVENT_FIELDS.THINK]?.[
              SSE_EVENT_FIELDS.CONTENT
            ]
          : undefined);

      if (thinkChunk && typeof thinkChunk === 'string') {
        accumulatedThinking += thinkChunk;
        if (onThinking) onThinking(thinkChunk);
      }

      if (event[SSE_EVENT_FIELDS.BLOCK]?.[SSE_EVENT_FIELDS.MULTI_STAGE]) {
        const stage =
          event[SSE_EVENT_FIELDS.BLOCK]?.[SSE_EVENT_FIELDS.MULTI_STAGE];
        if (
          stage?.[SSE_EVENT_FIELDS.STAGE] === SSE_STAGES.NAME_THINKING &&
          onMetadata
        ) {
          onMetadata({ thinking_stage: stage[SSE_EVENT_FIELDS.STATUS] });
        }
      }

      if (
        event[SSE_EVENT_FIELDS.MESSAGE]?.[SSE_EVENT_FIELDS.STATUS] ===
          SSE_MESSAGE_STATUSES.COMPLETED &&
        onMetadata
      ) {
        onMetadata({ message_status: 'completed' });
      }
    }
  });
}