/**
 * ------------------------------------------------------------------
 * DeepSeek SSE Parser
 * ------------------------------------------------------------------
 * Parse DeepSeek SSE response stream. Xử lý thinking mode,
 * response content, metadata, và phát hiện response bị truncate.
 *
 * Main features:
 * - parseSSEStream()     : Parse stream và emit content/thinking/metadata
 * - Auto-continue support : Hỗ trợ deduplicate content từ /chat/continue
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { countTokens } from '../../utils/tokenizer';
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  SSEMetadata,
  SSEEventPayload,
  SSEFragment,
  SSEResponseSnapshot,
} from './deepseek.types';

// ── Constants ──
import {
  SSE_PROTOCOL,
  SSE_EVENT_TYPES,
  SSE_FRAGMENT_TYPES,
  SSE_FIELDS,
} from './deepseek.constant';

// ── Thinking Parser ──
import { createDeepSeekThinkingParser } from './deepseek.thinking-parser';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekSSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: SSEMetadata) => void;
  onRaw?: (data: string) => void;
  sessionId: string;
  promptTokens: number;
  completionTokensRef: { value: number };
  currentModeRef: { value: 'THINK' | 'RESPONSE' };
  priorContentLength?: number;
}

export interface ParseSSEResult {
  incomplete: boolean;
  responseMessageId: number | null;
  accumulatedContent: string;
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
    onRaw,
    sessionId,
    promptTokens,
    completionTokensRef,
    currentModeRef,
    priorContentLength = 0,
  } = opts;

  let buffer = '';
  let currentEventType = '';
  let isIncomplete = false;
  let responseMessageId: number | null = null;
  let contentChunkCount = 0;
  let totalBytesProcessed = 0;
  let accumulatedContent = '';
  let snapshotSeenLength = 0;
  let snapshotMode = priorContentLength > 0;
  let thinkingElapsedSecs: number | undefined;

  // Initialize thinking parser
  const thinkingParser = createDeepSeekThinkingParser();

  for await (const chunk of responseBody) {
    const chunkStr = chunk.toString();
    totalBytesProcessed += chunkStr.length;
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith(SSE_PROTOCOL.EVENT_PREFIX)) {
        currentEventType = line
          .substring(SSE_PROTOCOL.EVENT_PREFIX.length)
          .trim();
        continue;
      }

      if (!line.startsWith(SSE_PROTOCOL.DATA_PREFIX)) continue;

      const jsonStr = line.substring(SSE_PROTOCOL.DATA_PREFIX.length).trim();
      if (jsonStr === SSE_PROTOCOL.DONE) {
        return { incomplete: false, responseMessageId, accumulatedContent };
      }

      try {
        const json = JSON.parse(jsonStr) as SSEEventPayload;

        if (currentEventType === SSE_EVENT_TYPES.READY) {
          if (json.response_message_id !== undefined) {
            responseMessageId = json.response_message_id;
            if (onMetadata) {
              onMetadata({
                response_message_id: json.response_message_id,
                conversation_id: sessionId,
              });
            }
          }
          currentEventType = '';
          continue;
        }

        if (currentEventType === SSE_EVENT_TYPES.CLOSE) {
          currentEventType = '';
          continue;
        }

        if (currentEventType === SSE_EVENT_TYPES.HINT) {
          if (json.type === SSE_EVENT_TYPES.HINT_ERROR) {
            const hintMsg =
              json.content || 'Unknown DeepSeek server hint error';
            logger.error(
              `[DeepSeek] Server hint error | session=${sessionId} | message=${hintMsg}`,
            );
            const err: Error = new Error(hintMsg);
            throw err;
          }
          currentEventType = '';
          continue;
        }

        currentEventType = '';

        if (
          json.p === SSE_FIELDS.RESPONSE_STATUS &&
          json.v === SSE_FIELDS.INCOMPLETE
        ) {
          isIncomplete = true;
          continue;
        }

        if (
          json.p === SSE_FIELDS.RESPONSE &&
          json.o === SSE_FIELDS.BATCH &&
          Array.isArray(json.v)
        ) {
          for (const item of json.v as SSEEventPayload[]) {
            if (
              item.p === SSE_FIELDS.QUASI_STATUS &&
              item.v === SSE_FIELDS.INCOMPLETE
            ) {
              isIncomplete = true;
            }
            if (item.p === SSE_FIELDS.ACCUMULATED_TOKEN_USAGE && onMetadata) {
              onMetadata({ total_token: item.v as number });
            }
          }
          continue;
        }

        if (json.choices?.[0]?.delta?.content) {
          const deltaText = json.choices[0].delta.content as string;
          completionTokensRef.value += countTokens(deltaText);
          accumulatedContent += deltaText;
          onContent(deltaText);
          contentChunkCount++;
          if (onMetadata) {
            onMetadata({
              total_token: promptTokens + completionTokensRef.value,
            });
          }
          continue;
        }

        const path = json.p;
        const value = json.v;

        const emitContentChunk = (text: string, fromSnapshot: boolean) => {
          if (fromSnapshot && priorContentLength > 0) {
            const alreadySeen = snapshotSeenLength;
            snapshotSeenLength += text.length;
            if (snapshotSeenLength <= priorContentLength) {
              return;
            }
            if (alreadySeen < priorContentLength) {
              text = text.slice(priorContentLength - alreadySeen);
            }
          }
          completionTokensRef.value += countTokens(text);
          accumulatedContent += text;
          onContent(text);
          contentChunkCount++;
          if (onMetadata) {
            onMetadata({
              total_token: promptTokens + completionTokensRef.value,
            });
          }
        };

        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          (value as SSEResponseSnapshot).response?.fragments
        ) {
          const snapshot = value as SSEResponseSnapshot;
          if (snapshot.response?.message_id != null) {
            responseMessageId = snapshot.response.message_id;
          }
          snapshotMode = true;
          if (snapshotSeenLength === 0) {
            snapshotSeenLength = 0;
          }

          for (const fragment of snapshot.response!.fragments!) {
            if (fragment.type === SSE_FRAGMENT_TYPES.THINK) {
              currentModeRef.value = SSE_FRAGMENT_TYPES.THINK;
              if (fragment.content) {
                const normalizedThinking = thinkingParser.feed(
                  fragment.content,
                );
                if (onThinking) onThinking(normalizedThinking);
                else {
                  onContent(normalizedThinking);
                  contentChunkCount++;
                }
              }
            } else if (fragment.type === SSE_FRAGMENT_TYPES.RESPONSE) {
              // End thinking mode if switching to response
              if (currentModeRef.value === SSE_FRAGMENT_TYPES.THINK) {
                const closingTag = thinkingParser.end({
                  elapsed_secs: thinkingElapsedSecs,
                });
                if (onThinking) onThinking(closingTag);
                else {
                  onContent(closingTag);
                  contentChunkCount++;
                }
              }
              currentModeRef.value = SSE_FRAGMENT_TYPES.RESPONSE;
              if (fragment.content) {
                emitContentChunk(fragment.content, true);
              }
            }
          }
          if (snapshot.response?.status === SSE_FIELDS.INCOMPLETE) {
            isIncomplete = true;
          }
          continue;
        }

        if (Array.isArray(value)) {
          const fragment = value[0] as SSEFragment | undefined;
          if (fragment) {
            if (fragment.type === SSE_FRAGMENT_TYPES.THINK) {
              currentModeRef.value = SSE_FRAGMENT_TYPES.THINK;
              if (fragment.content) {
                const normalizedThinking = thinkingParser.feed(
                  fragment.content,
                );
                if (onThinking) onThinking(normalizedThinking);
                else {
                  onContent(normalizedThinking);
                  contentChunkCount++;
                }
              }
            } else if (fragment.type === SSE_FRAGMENT_TYPES.RESPONSE) {
              // End thinking mode if switching to response
              if (currentModeRef.value === SSE_FRAGMENT_TYPES.THINK) {
                const closingTag = thinkingParser.end({
                  elapsed_secs: thinkingElapsedSecs,
                });
                if (onThinking) onThinking(closingTag);
                else {
                  onContent(closingTag);
                  contentChunkCount++;
                }
              }
              currentModeRef.value = SSE_FRAGMENT_TYPES.RESPONSE;
              if (fragment.content) {
                emitContentChunk(fragment.content, snapshotMode);
              }
            }
          }
          continue;
        }

        if (typeof value === 'string') {
          if (path?.includes(SSE_FIELDS.THINKING_CONTENT)) {
            currentModeRef.value = SSE_FRAGMENT_TYPES.THINK;
            completionTokensRef.value += countTokens(value);
            const normalizedThinking = thinkingParser.feed(value);
            if (onThinking) onThinking(normalizedThinking);
            else {
              onContent(normalizedThinking);
              contentChunkCount++;
            }
            if (onMetadata) {
              onMetadata({
                total_token: promptTokens + completionTokensRef.value,
              });
            }
          } else if (
            path === SSE_FIELDS.RESPONSE_CONTENT ||
            path?.endsWith(SSE_FIELDS.CONTENT_SUFFIX)
          ) {
            if (path === SSE_FIELDS.RESPONSE_CONTENT) {
              // End thinking mode if switching to response
              if (currentModeRef.value === SSE_FRAGMENT_TYPES.THINK) {
                const closingTag = thinkingParser.end({
                  elapsed_secs: thinkingElapsedSecs,
                });
                if (onThinking) onThinking(closingTag);
                else {
                  onContent(closingTag);
                  contentChunkCount++;
                }
              }
              currentModeRef.value = SSE_FRAGMENT_TYPES.RESPONSE;
            }
            if (currentModeRef.value === SSE_FRAGMENT_TYPES.THINK) {
              completionTokensRef.value += countTokens(value);
              const normalizedThinking = thinkingParser.feed(value);
              if (onThinking) onThinking(normalizedThinking);
              else {
                onContent(normalizedThinking);
                contentChunkCount++;
              }
              if (onMetadata) {
                onMetadata({
                  total_token: promptTokens + completionTokensRef.value,
                });
              }
            } else {
              emitContentChunk(value, snapshotMode);
            }
          } else if (!path) {
            if (currentModeRef.value === SSE_FRAGMENT_TYPES.THINK) {
              completionTokensRef.value += countTokens(value);
              const normalizedThinking = thinkingParser.feed(value);
              if (onThinking) onThinking(normalizedThinking);
              else {
                onContent(normalizedThinking);
                contentChunkCount++;
              }
              if (onMetadata) {
                onMetadata({
                  total_token: promptTokens + completionTokensRef.value,
                });
              }
            } else {
              emitContentChunk(value, snapshotMode);
            }
          }
        } else if (
          path?.endsWith(`/${SSE_FIELDS.ELAPSED_SECS}`) ||
          path?.endsWith(SSE_FIELDS.THINKING_ELAPSED_SECS)
        ) {
          // Capture thinking elapsed time
          thinkingElapsedSecs = value as number;
          if (onMetadata) {
            onMetadata({ thinking_elapsed: value as number });
          }
        }
      } catch (e) {
        const err = e as Error;
        logger.error(
          `[DeepSeek] SSE parse error | session=${sessionId} | line="${line.slice(0, 200)}"`,
          {
            message: err?.message || 'Unknown parse error',
            linePreview: line.slice(0, 500),
          },
        );
      }
    }
  }

  return { incomplete: isIncomplete, responseMessageId, accumulatedContent };
}
