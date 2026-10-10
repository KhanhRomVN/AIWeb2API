/**
 * ------------------------------------------------------------------
 * Gemini CLI SSE Parser
 * ------------------------------------------------------------------
 * Parse SSE (Server-Sent Events) stream từ Code Assist API.
 * Code Assist API trả về SSE theo format:
 *   data: {"response": {...gemini response...}}
 *   data: {"response": {...gemini response...}}
 *   data: [DONE]
 *
 * Mỗi chunk có "response" wrapper cần được unwrap để ra
 * GeminiResponse chuẩn trước khi chuyển sang OpenAI format.
 *
 * Main exports:
 * - parseSSELine()   : Parse 1 dòng SSE text → SSEChunk
 * - parseSSEStream() : Parse async stream → yield SSEChunk[]
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────

import {
  SSEChunk,
  GeminiResponse,
  CodeAssistResponse,
} from './gemini-cli.types';
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────

const logger = createLogger('GeminiCliSSEParser');

const SSE_DATA_PREFIX = 'data: ';
const SSE_DONE_MARKER = '[DONE]';

// ─── Parse Functions ────────────────────────────────────────────────────

/**
 * Parse một dòng SSE text thành SSEChunk.
 *
 * @param line - Dòng text SSE (ví dụ: `data: {"response":{...}}`)
 * @returns SSEChunk hoặc null nếu không phải dòng data hợp lệ
 */
export function parseSSELine(line: string): SSEChunk | null {
  const trimmed = line.trim();

  // Bỏ qua dòng trống
  if (!trimmed) return null;

  // Chỉ xử lý dòng bắt đầu bằng "data: "
  if (!trimmed.startsWith(SSE_DATA_PREFIX)) return null;

  const payload = trimmed.slice(SSE_DATA_PREFIX.length).trim();

  // Marker kết thúc stream
  if (payload === SSE_DONE_MARKER) {
    return { type: 'done' };
  }

  // Parse JSON
  try {
    const parsed: CodeAssistResponse = JSON.parse(payload);

    // Unwrap "response" wrapper từ Code Assist API
    let geminiData: GeminiResponse;

    if (parsed.response && typeof parsed.response === 'object') {
      // Format chuẩn: { response: { candidates: [...], usageMetadata: {...} } }
      geminiData = parsed.response;
    } else if (parsed.candidates || parsed.usageMetadata) {
      // Đã là Gemini format trực tiếp (không có wrapper)
      geminiData = parsed as GeminiResponse;
    } else {
      // Vẫn trả về data để caller quyết định
      geminiData = parsed as GeminiResponse;
    }

    return {
      type: 'data',
      data: geminiData,
      raw: payload,
    };
  } catch (e) {
    logger.warn(
      `[GeminiCliSSEParser] Failed to parse SSE JSON: ${payload.slice(0, 200)}`,
    );
    return {
      type: 'error',
      message: `JSON parse error: ${(e as Error).message}`,
    };
  }
}

/**
 * Parse async stream của bytes/strings thành SSEChunk.
 *
 * Stream có thể là:
 * - ReadableStream<Uint8Array> (Node.js fetch response.body)
 * - AsyncIterable<Buffer | string>
 *
 * Yields SSEChunk cho mỗi dòng `data: ...` hợp lệ.
 *
 * @param stream - Async iterable stream
 */
export async function* parseSSEStream(
  stream: AsyncIterable<Buffer | string | Uint8Array>,
): AsyncGenerator<SSEChunk> {
  let buffer = '';

  try {
    for await (const chunk of stream) {
      // Convert chunk thành string
      const chunkStr =
        chunk instanceof Buffer || chunk instanceof Uint8Array
          ? new TextDecoder().decode(chunk)
          : (chunk as string);

      buffer += chunkStr;

      // Tách buffer thành các dòng
      const lines = buffer.split('\n');

      // Dòng cuối chưa hoàn chỉnh (không có \n cuối) → giữ lại trong buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const parsed = parseSSELine(line);
        if (!parsed) continue;

        if (parsed.type === 'done') {
          return;
        }

        yield parsed;
      }
    }

    // Xử lý phần còn lại trong buffer sau khi stream kết thúc
    if (buffer.trim()) {
      const parsed = parseSSELine(buffer);
      if (parsed && parsed.type !== 'done') {
        yield parsed;
      }
    }
  } catch (e) {
    logger.error(`[GeminiCliSSEParser] Stream error: ${(e as Error).message}`);
    yield {
      type: 'error',
      message: `Stream error: ${(e as Error).message}`,
    };
  }
}

/**
 * Trích xuất text content từ GeminiResponse.
 * Xử lý thinking parts (thought=true) và regular text parts.
 *
 * @returns { text, thinking } - text thường và thinking content
 */
export function extractContentFromResponse(response: GeminiResponse): {
  text: string;
  thinking: string;
  finishReason: string | undefined;
} {
  let text = '';
  let thinking = '';
  let finishReason: string | undefined;

  const candidates = response.candidates ?? [];
  const candidate = candidates[0];

  if (!candidate) {
    return { text, thinking, finishReason };
  }

  finishReason = candidate.finishReason;

  const parts = candidate.content?.parts ?? [];
  for (const part of parts) {
    if (!part) continue;

    if (typeof part.text === 'string') {
      if (part.thought === true) {
        thinking += part.text;
      } else {
        text += part.text;
      }
    }
  }

  return { text, thinking, finishReason };
}

/**
 * Collect toàn bộ SSE stream thành một GeminiResponse hoàn chỉnh.
 * Dùng cho non-stream mode (gom stream thành 1 response).
 *
 * @param stream - Async iterable SSE stream
 * @returns Merged GeminiResponse
 */
export async function collectSSEStream(
  stream: AsyncIterable<Buffer | string | Uint8Array>,
): Promise<GeminiResponse> {
  const allText: string[] = [];
  const allThinking: string[] = [];
  let usageMetadata: GeminiResponse['usageMetadata'] = undefined;
  let finishReason: string | undefined;
  let safetyRatings: unknown[] = [];
  let hasData = false;

  for await (const chunk of parseSSEStream(stream)) {
    if (chunk.type === 'error') {
      logger.warn(`[GeminiCliSSEParser] SSE error: ${chunk.message}`);
      continue;
    }

    if (chunk.type !== 'data' || !chunk.data) continue;

    hasData = true;
    const {
      text,
      thinking,
      finishReason: fr,
    } = extractContentFromResponse(chunk.data);

    if (text) allText.push(text);
    if (thinking) allThinking.push(thinking);
    if (fr) finishReason = fr;

    if (chunk.data.usageMetadata) {
      usageMetadata = chunk.data.usageMetadata;
    }

    const candidate = chunk.data.candidates?.[0];
    if (candidate?.safetyRatings?.length) {
      safetyRatings = candidate.safetyRatings;
    }
  }

  if (!hasData) {
    return {
      candidates: [
        {
          content: { role: 'model', parts: [{ text: '' }] },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      },
    };
  }

  // Build final parts
  const parts: Array<{ text: string; thought?: boolean }> = [];

  if (allThinking.length > 0) {
    parts.push({ text: allThinking.join(''), thought: true });
  }
  if (allText.length > 0) {
    parts.push({ text: allText.join('') });
  }
  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return {
    candidates: [
      {
        content: { role: 'model', parts },
        finishReason: finishReason ?? 'STOP',
        safetyRatings:
          safetyRatings as GeminiResponse['candidates'] extends Array<infer C>
            ? C extends { safetyRatings?: infer SR }
              ? NonNullable<SR>
              : never[]
            : never[],
      },
    ],
    usageMetadata: usageMetadata ?? {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    },
  };
}
