/**
 * ------------------------------------------------------------------
 * Freebuff Thinking Parser
 * ------------------------------------------------------------------
 * Parse thinking content từ Freebuff SSE stream và chuẩn hóa
 * thành format chung: <thinking>...</thinking>
 *
 * Freebuff thinking format:
 * - Khi model có thinking (vd: glm-5.3-flash với ảnh):
 *   {"type":"reasoning_delta","text":"..."}  → thinking chunks
 *   {"type":"delta","text":"..."}            → content thông thường
 * - Khi model không có thinking (vd: solar-pro4):
 *   Chỉ có {"type":"delta","text":"..."}     → không có reasoning_delta
 *
 * Phân cách thinking: dựa vào event type trong SSE stream.
 * Thinking bắt đầu khi gặp reasoning_delta, kết thúc khi stream
 * reasoning_delta kết thúc (delta content bắt đầu xuất hiện).
 *
 * Elapsed time: wall-clock timer (Freebuff không trả về elapsed natively).
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ThinkingTimer } from '../../utils/thinking-timer';

// ─── Types ──────────────────────────────────────────────────────────────

export interface FreebuffThinkingChunk {
  type: 'thinking';
  content: string;
}

// ─── Thinking Parser ────────────────────────────────────────────────────

export class FreebuffThinkingParser {
  private buffer = '';
  private isThinkingStarted = false;
  private isThinkingEnded = false;
  private readonly timer = new ThinkingTimer();

  /**
   * Feed một reasoning_delta chunk vào parser.
   * Chunk đầu tiên sẽ tự động emit opening tag <thinking> và bắt đầu timer.
   */
  feed(chunk: string): string {
    if (!chunk) return '';

    // Chunk đầu tiên: emit opening tag và start timer
    if (!this.isThinkingStarted) {
      this.isThinkingStarted = true;
      this.timer.start();
      this.buffer = chunk;
      return '<thinking>' + chunk;
    }

    // Các chunk tiếp theo: append trực tiếp
    this.buffer += chunk;
    return chunk;
  }

  /**
   * Kết thúc thinking phase — emit closing tag </thinking> với elapsed time.
   * Gọi khi stream reasoning_delta kết thúc (delta content bắt đầu).
   */
  end(): string {
    if (this.isThinkingEnded) {
      return '';
    }

    // Nếu không có thinking nào được feed, không emit gì cả
    if (!this.isThinkingStarted) {
      this.isThinkingEnded = true;
      return '';
    }

    this.isThinkingEnded = true;

    const elapsed = this.timer.stop();
    let result = '</thinking>';

    if (elapsed !== null) {
      result += `\n<thinking_elapsed>${ThinkingTimer.format(elapsed)}</thinking_elapsed>`;
    }

    return result;
  }

  /**
   * Kiểm tra xem thinking có đang active không.
   */
  isActive(): boolean {
    return this.isThinkingStarted && !this.isThinkingEnded;
  }

  /**
   * Lấy toàn bộ thinking content đã tích lũy.
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Reset parser về trạng thái ban đầu.
   */
  reset(): void {
    this.buffer = '';
    this.isThinkingStarted = false;
    this.isThinkingEnded = false;
    this.timer.reset();
  }
}

/**
 * Factory function tạo FreebuffThinkingParser mới.
 */
export function createFreebuffThinkingParser(): FreebuffThinkingParser {
  return new FreebuffThinkingParser();
}
