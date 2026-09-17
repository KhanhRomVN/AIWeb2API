/**
 * ------------------------------------------------------------------
 * Grok Build CLI Thinking Parser
 * ------------------------------------------------------------------
 * Parse thinking content từ Grok Build SSE stream và chuẩn hóa
 * thành format chung: <thinking>...</thinking>
 *
 * Grok Build thinking format:
 * - Event type: response.reasoning_summary_text.delta
 * - Field: data.delta (string chunk)
 * - Kết thúc: event response.reasoning_summary_text.done
 *
 * Elapsed time: wall-clock timer (Grok không trả về elapsed natively).
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ThinkingTimer } from '../../utils/thinking-timer';

// ─── Types ──────────────────────────────────────────────────────────────

export interface GrokBuildThinkingMetadata {
  /** Tổng số token reasoning (từ usage.output_tokens_details.reasoning_tokens) */
  reasoning_tokens?: number;
}

// ─── Thinking Parser ────────────────────────────────────────────────────

export class GrokBuildThinkingParser {
  private buffer = '';
  private isThinkingStarted = false;
  private isThinkingEnded = false;
  private readonly timer = new ThinkingTimer();

  /**
   * Feed một thinking chunk từ response.reasoning_summary_text.delta.
   * Chunk đầu tiên tự động emit opening tag <thinking> và bắt đầu timer.
   */
  feed(chunk: string): string {
    if (!chunk) return '';

    if (!this.isThinkingStarted) {
      this.isThinkingStarted = true;
      this.timer.start();
      this.buffer = chunk;
      return '<thinking>' + chunk;
    }

    this.buffer += chunk;
    return chunk;
  }

  /**
   * Kết thúc thinking phase (event response.reasoning_summary_text.done).
   * Emit closing tag </thinking> với elapsed time và optional reasoning_tokens.
   */
  end(metadata?: GrokBuildThinkingMetadata): string {
    if (this.isThinkingEnded) return '';
    if (!this.isThinkingStarted) return '';

    this.isThinkingEnded = true;
    const elapsed = this.timer.stop();

    let result = '</thinking>';

    if (elapsed !== null) {
      result += `\n<thinking_elapsed>${ThinkingTimer.format(elapsed)}</thinking_elapsed>`;
    }

    if (metadata?.reasoning_tokens) {
      result += `\n<thinking_tokens>${metadata.reasoning_tokens}</thinking_tokens>`;
    }

    return result;
  }

  /** Trả về toàn bộ thinking content đã tích lũy (không có tags). */
  getBuffer(): string {
    return this.buffer;
  }

  /** Reset về trạng thái ban đầu để tái sử dụng. */
  reset(): void {
    this.buffer = '';
    this.isThinkingStarted = false;
    this.isThinkingEnded = false;
    this.timer.reset();
  }
}

/** Factory function — tạo một parser mới cho mỗi request. */
export function createGrokBuildThinkingParser(): GrokBuildThinkingParser {
  return new GrokBuildThinkingParser();
}
