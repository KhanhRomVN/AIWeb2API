/**
 * ------------------------------------------------------------------
 * Kiro Thinking Parser
 * ------------------------------------------------------------------
 * Parse và chuẩn hóa thinking/reasoning content từ Kiro stream
 * thành format chung: <thinking>...</thinking>
 *
 * Kiro có 2 nguồn reasoning:
 * 1. reasoningContentEvent (native adaptive thinking) — raw reasoning text
 *    đến từ frame riêng, không có tag.
 * 2. Inline <thinking>…</thinking> trong assistantResponseEvent.content —
 *    khi <thinking_mode>enabled</thinking_mode> trong system prompt với
 *    Claude models. Đây được split bởi splitInlineThinking() trong sse-parser.
 *
 * KiroThinkingParser xử lý nguồn #1: wrap raw reasoning text thành
 * <thinking>content</thinking> format — nhất quán với DeepSeek, DuckDuckGo.
 *
 * Pattern giống deepseek.thinking-parser.ts:
 * - feed(chunk)  → emit '<thinking>' khi bắt đầu, sau đó raw text
 * - end()        → emit '</thinking>'
 * - reset()      → reset state cho request mới
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface KiroThinkingChunk {
  type: 'thinking';
  content: string;
}

// ─── Thinking Parser ────────────────────────────────────────────────────

export class KiroThinkingParser {
  private isStarted = false;
  private isEnded = false;

  /**
   * Feed một chunk reasoning text.
   * Tự động wrap trong <thinking> khi gặp chunk đầu tiên.
   *
   * @returns String sẵn sàng để emit qua onThinking callback.
   */
  feed(chunk: string): string {
    if (!chunk) return '';

    // Chunk đầu tiên: emit opening tag trước
    if (!this.isStarted) {
      this.isStarted = true;
      return '<thinking>' + chunk;
    }

    return chunk;
  }

  /**
   * Kết thúc thinking phase, emit closing tag.
   * Idempotent — gọi nhiều lần chỉ emit tag lần đầu.
   *
   * @returns '</thinking>' hoặc '' nếu đã end rồi hoặc chưa bắt đầu.
   */
  end(): string {
    if (this.isEnded || !this.isStarted) return '';
    this.isEnded = true;
    return '</thinking>';
  }

  /**
   * Kiểm tra đang trong thinking phase chưa.
   */
  isActive(): boolean {
    return this.isStarted && !this.isEnded;
  }

  /**
   * Reset về trạng thái ban đầu cho request mới.
   */
  reset(): void {
    this.isStarted = false;
    this.isEnded = false;
  }
}

/**
 * Factory function — tạo KiroThinkingParser mới.
 * API nhất quán với createDeepSeekThinkingParser().
 */
export function createKiroThinkingParser(): KiroThinkingParser {
  return new KiroThinkingParser();
}
