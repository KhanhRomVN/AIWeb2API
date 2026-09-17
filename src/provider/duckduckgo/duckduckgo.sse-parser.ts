/**
 * ------------------------------------------------------------------
 * DuckDuckGo SSE Parser
 * ------------------------------------------------------------------
 * Parse SSE/NDJSON stream từ DuckDuckGo duckchat/v1/chat.
 *
 * Duck.ai stream format:
 *   data: {"role":"assistant","message":"..."}   ← partial text chunk
 *   data: {"action":"success"}                    ← stream done signal
 *   data: [DONE]                                  ← stream terminated
 *
 * Main exports:
 * - parseDdgDataLine()   : Parse 1 "data: ..." line → raw object
 * - extractDdgContent()  : Extract text content từ parsed object
 * - isDdgDone()          : Kiểm tra line có phải [DONE] không
 * - isDdgSuccess()       : Kiểm tra stream action=success
 * - DdgStreamParser      : Class stateful giữ buffer giữa các chunk
 * ------------------------------------------------------------------
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface DdgChunk {
  /** Text content từ chunk (rỗng nếu không có) */
  content: string;
  /** Đây là chunk cuối (action=success hoặc [DONE]) */
  isDone: boolean;
  /** Là thinking token (từ thinking-parser sẽ detect riêng) */
  isThinking: boolean;
}

export interface DdgParseResult {
  chunks: DdgChunk[];
  /** Phần buffer còn lại chưa đủ 1 line hoàn chỉnh */
  remainingBuffer: string;
}

// ─── Line-level Parsers ──────────────────────────────────────────────────

/**
 * Parse 1 SSE data line ("data: {...}") → object hoặc null.
 * Không throw — lỗi JSON trả về null.
 */
export function parseDdgDataLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) return null;
  const json = trimmed.slice(6).trim();
  if (!json || json === '[DONE]') return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract text content từ parsed DDG chunk object.
 * Duck.ai dùng field "message" hoặc "content".
 */
export function extractDdgContent(data: Record<string, unknown> | null): string {
  if (!data) return '';
  if (typeof data.message === 'string') return data.message;
  if (typeof data.content === 'string') return data.content;
  return '';
}

/**
 * Kiểm tra line có phải terminal [DONE] không.
 */
export function isDdgDone(line: string): boolean {
  return line.trim() === 'data: [DONE]';
}

/**
 * Kiểm tra parsed object có phải success signal không.
 */
export function isDdgSuccess(data: Record<string, unknown> | null): boolean {
  if (!data) return false;
  return data.action === 'success' || data.status === 'complete';
}

// ─── Chunk-level Parser ──────────────────────────────────────────────────

/**
 * Parse 1 line hoàn chỉnh thành DdgChunk.
 * isThinking luôn false ở đây — ThinkingParser sẽ annotate sau.
 */
export function parseDdgLine(line: string): DdgChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Terminal signal
  if (isDdgDone(trimmed)) {
    return { content: '', isDone: true, isThinking: false };
  }

  const data = parseDdgDataLine(trimmed);
  if (!data) return null;

  const content = extractDdgContent(data);
  const isDone = isDdgSuccess(data);

  return { content, isDone, isThinking: false };
}

// ─── Stateful Stream Parser ──────────────────────────────────────────────

/**
 * DdgStreamParser — giữ buffer giữa các chunk binary.
 *
 * Usage:
 * ```ts
 * const parser = new DdgStreamParser();
 *
 * readableStream.on('data', (chunk: Buffer) => {
 *   const { chunks } = parser.feed(chunk.toString());
 *   for (const c of chunks) {
 *     if (c.content) onContent(c.content);
 *     if (c.isDone) onDone();
 *   }
 * });
 *
 * readableStream.on('end', () => {
 *   const { chunks } = parser.flush();
 *   for (const c of chunks) {
 *     if (c.content) onContent(c.content);
 *   }
 * });
 * ```
 */
export class DdgStreamParser {
  private buffer = '';

  /**
   * Feed raw string data vào parser.
   * Trả về danh sách chunks đã parse được từ các lines hoàn chỉnh.
   */
  feed(data: string): DdgParseResult {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    // Dòng cuối có thể chưa đủ — giữ lại trong buffer
    this.buffer = lines.pop() ?? '';

    const chunks: DdgChunk[] = [];
    for (const line of lines) {
      const chunk = parseDdgLine(line);
      if (chunk) chunks.push(chunk);
    }

    return { chunks, remainingBuffer: this.buffer };
  }

  /**
   * Flush buffer còn lại khi stream kết thúc (on 'end').
   * Xử lý nốt phần dang dở.
   */
  flush(): DdgParseResult {
    const remaining = this.buffer;
    this.buffer = '';
    const chunks: DdgChunk[] = [];
    if (remaining.trim()) {
      const chunk = parseDdgLine(remaining);
      if (chunk) chunks.push(chunk);
    }
    return { chunks, remainingBuffer: '' };
  }

  /**
   * Reset parser về trạng thái ban đầu.
   */
  reset(): void {
    this.buffer = '';
  }
}
