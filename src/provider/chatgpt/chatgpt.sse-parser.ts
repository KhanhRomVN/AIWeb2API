/**
 * ------------------------------------------------------------------
 * ChatGPT SSE Parser
 * ------------------------------------------------------------------
 * Parse SSE stream từ `/backend-api/conversation`. ChatGPT gửi các
 * event JSON có shape `{ message: { author, content, status } }`,
 * không streaming từng ký tự như DeepSeek mà gửi snapshot đầy đủ
 * mỗi lần content thay đổi.
 *
 * Vì vậy parser phải so sánh độ dài để chỉ emit phần delta.
 *
 * Main functions:
 * - parseChatGPTSseStream() : Async iterate stream, emit content/thinking
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  ConversationSSEEvent,
  ParsedConversationSSE,
} from './chatgpt.types';

// ── Constants ──
import {
  SSE_PROTOCOL,
  SSE_CONTENT_TYPES,
  SSE_MESSAGE_STATUS,
  ROLE_VALUES,
} from './chatgpt.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ChatGPTSseParser');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseChatGPTOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: Record<string, unknown>) => void;
  onRaw?: (data: string) => void;
  conversationId?: string;
}

export interface ParseChatGPTResult {
  conversationId: string | null;
  assistantMessageId: string | null;
  accumulatedContent: string;
  status: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Kiểm tra 1 part có phải text thường. */
function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  const chunks: string[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      chunks.push(part);
    } else if (part && typeof part === 'object') {
      // Multimodal parts thường có shape `{ content_type, asset_pointer }`
      // cho ảnh — bỏ qua vì không phải text.
      const obj = part as Record<string, unknown>;
      if (typeof obj.text === 'string') chunks.push(obj.text);
    }
  }
  return chunks.join('');
}

/** Trích text từ một event message của ChatGPT. */
function extractMessageText(event: ConversationSSEEvent): {
  text: string;
  isThoughts: boolean;
} {
  const content = event.message?.content;
  if (!content) return { text: '', isThoughts: false };

  const contentType = String(content.content_type || '');
  const text = extractTextFromParts(content.parts);
  const isThoughts = contentType === SSE_CONTENT_TYPES.THOUGHTS;

  return { text, isThoughts };
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse response body của ChatGPT conversation SSE.
 *
 * ChatGPTSseStream emit event dạng snapshot — mỗi event có message với
 * `content.parts` là mảng đầy đủ. Parser so sánh với nội dung đã emit
 * để chỉ gửi phần mới (delta).
 */
export async function parseChatGPTSseStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseChatGPTOptions,
): Promise<ParseChatGPTResult> {
  const { onContent, onThinking, onMetadata, onRaw } = opts;

  let buffer = '';
  let conversationId: string | null = null;
  let assistantMessageId: string | null = null;
  let status = '';
  // Tách biệt 2 buffer vì thinking và content đến từ 2 message khác nhau
  let emittedThinkingLen = 0;
  let emittedContentLen = 0;
  let accumulatedContent = '';
  let done = false;

  for await (const chunk of responseBody) {
    const chunkStr = chunk.toString();
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith(SSE_PROTOCOL.DATA_PREFIX)) continue;

      const jsonStr = line.substring(SSE_PROTOCOL.DATA_PREFIX.length).trim();
      if (!jsonStr) continue;
      if (jsonStr === SSE_PROTOCOL.DONE) {
        done = true;
        break;
      }

      let event: ConversationSSEEvent;
      try {
        event = JSON.parse(jsonStr) as ConversationSSEEvent;
      } catch (e) {
        const err = e as Error;
        logger.warn(
          `[ChatGPT SSE] Failed to parse event: ${err.message} | preview="${jsonStr.slice(
            0,
            200,
          )}"`,
        );
        continue;
      }

      if (event.error) {
        throw new Error(`ChatGPT stream error: ${event.error}`);
      }

      if (event.conversation_id && event.conversation_id !== conversationId) {
        conversationId = event.conversation_id;
        if (onMetadata) {
          onMetadata({ conversation_id: conversationId });
        }
      }

      const message = event.message;
      if (!message) continue;

      const authorRole = String(message.author?.role || '');
      if (authorRole !== ROLE_VALUES.ASSISTANT) continue;

      if (message.id) {
        assistantMessageId = message.id;
      }

      const { text, isThoughts } = extractMessageText(event);
      if (!text) {
        if (message.status) status = String(message.status);
        continue;
      }

      if (isThoughts) {
        // Emit thinking delta
        if (text.length > emittedThinkingLen) {
          const delta = text.slice(emittedThinkingLen);
          emittedThinkingLen = text.length;
          if (onThinking) onThinking(delta);
          else onContent(delta);
        }
      } else {
        // Emit content delta
        if (text.length > emittedContentLen) {
          const delta = text.slice(emittedContentLen);
          emittedContentLen = text.length;
          accumulatedContent += delta;
          onContent(delta);
        }
      }

      if (message.status) {
        status = String(message.status);
      }
    }

    if (done) break;
  }

  if (
    status === SSE_MESSAGE_STATUS.FINISHED_SUCCESSFULLY ||
    status === SSE_MESSAGE_STATUS.FINISHED_PARTIAL_COMPLETION
  ) {
    if (onMetadata) {
      onMetadata({
        status,
        response_message_id: assistantMessageId,
      });
    }
  }

  return {
    conversationId,
    assistantMessageId,
    accumulatedContent,
    status,
  };
}