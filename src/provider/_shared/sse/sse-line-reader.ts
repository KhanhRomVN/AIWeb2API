import { StringDecoder } from 'string_decoder';

const DATA_PREFIX = 'data: ';
const DONE_MARKER = '[DONE]';

export interface SseReadOptions {
  /** Gọi với từng chunk đã giải mã, trước khi tách dòng. */
  onRaw?: (chunk: string) => void;
}

/**
 * Đọc stream SSE kiểu `data: ...`, yield phần payload của từng dòng `data:`.
 * Tự xử lý buffer dòng, trim, giải mã UTF-8 xuyên chunk và dừng ở `[DONE]`.
 */
export async function* readSseData(
  body: AsyncIterable<any> | NodeJS.ReadableStream,
  opts: SseReadOptions = {},
): AsyncGenerator<string, void, undefined> {
  const decoder = new StringDecoder('utf8');
  let buffer = '';

  for await (const chunk of body as AsyncIterable<string | Buffer>) {
    const chunkStr = typeof chunk === 'string' ? chunk : decoder.write(chunk);
    if (!chunkStr) continue;
    if (opts.onRaw) opts.onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith(DATA_PREFIX)) continue;
      const data = trimmed.slice(DATA_PREFIX.length).trim();
      if (data === DONE_MARKER) return;
      yield data;
    }
  }
}

export interface TextLineReadOptions {
  /** Gọi với từng chunk (sau transformChunk), trước khi tách dòng. */
  onRaw?: (chunk: string) => void;
  /** Biến đổi chunk đã giải mã trước khi tách dòng (vd: lọc ký tự NUL). */
  transformChunk?: (chunk: string) => string;
  /** Giữ cả dòng rỗng (vd: ranh giới event của SSE). */
  keepEmptyLines?: boolean;
  /** Yield phần còn lại trong buffer khi stream kết thúc. */
  flushRemainder?: boolean;
}

/**
 * Đọc stream văn bản theo dòng, yield từng dòng không rỗng (giữ nguyên nội dung dòng).
 * Dùng cho định dạng không có prefix `data: ` (NDJSON, `<prefix>:<json>`...).
 */
export async function* readTextLines(
  body: AsyncIterable<any> | NodeJS.ReadableStream,
  opts: TextLineReadOptions = {},
): AsyncGenerator<string, void, undefined> {
  const decoder = new StringDecoder('utf8');
  let buffer = '';

  for await (const chunk of body as AsyncIterable<string | Buffer>) {
    let chunkStr = typeof chunk === 'string' ? chunk : decoder.write(chunk);
    if (opts.transformChunk) chunkStr = opts.transformChunk(chunkStr);
    if (!chunkStr) continue;
    if (opts.onRaw) opts.onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() && !opts.keepEmptyLines) continue;
      yield line;
    }
  }

  if (opts.flushRemainder && buffer.trim()) yield buffer;
}