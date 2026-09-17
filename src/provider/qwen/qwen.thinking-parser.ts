/**
 * ------------------------------------------------------------------
 * Qwen Thinking Parser
 * ------------------------------------------------------------------
 * Parse thinking content từ Qwen SSE stream và chuẩn hóa
 * thành format chung: <thinking>...</thinking>
 *
 * Qwen thinking format:
 * - Phase: "thinking_summary"
 * - Structure: delta.extra.summary_thought.content (array of strings)
 * - Also supports: delta.reasoning_content (backward compatibility)
 *
 * Elapsed time: wall-clock timer (Qwen không trả về elapsed natively).
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ThinkingTimer } from '../../utils/thinking-timer';

// ─── Types ──────────────────────────────────────────────────────────────

export interface QwenThinkingChunk {
  type: 'thinking';
  content: string;
}

export interface QwenThinkingSummary {
  title?: string[];
  thought?: string[];
}

// ─── Thinking Parser ────────────────────────────────────────────────────

export class QwenThinkingParser {
  private buffer = '';
  private isThinkingStarted = false;
  private isThinkingEnded = false;
  private summaryTitle: string[] = [];
  private summaryThought: string[] = [];
  private readonly timer = new ThinkingTimer();

  /**
   * Feed thinking content chunk.
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
   * Feed thinking summary (từ thinking_summary phase).
   * Gọi khi nhận được complete summary object.
   */
  feedSummary(summary: QwenThinkingSummary): string {
    const parts: string[] = [];

    if (summary.title && summary.title.length > 0) {
      this.summaryTitle = summary.title;
      const titleText = summary.title.join('\n');
      if (titleText) {
        parts.push(`### Title\n${titleText}`);
      }
    }

    if (summary.thought && summary.thought.length > 0) {
      this.summaryThought = summary.thought;
      const thoughtText = summary.thought.join('\n');
      if (thoughtText) {
        parts.push(`### Thought\n${thoughtText}`);
      }
    }

    if (parts.length === 0) return '';

    const content = parts.join('\n\n');

    if (!this.isThinkingStarted) {
      this.isThinkingStarted = true;
      this.timer.start();
      this.buffer = content;
      return '<thinking>' + content;
    }

    this.buffer += '\n\n' + content;
    return '\n\n' + content;
  }

  /**
   * Kết thúc thinking phase.
   * Emit closing tag </thinking> với elapsed time.
   */
  end(): string {
    if (this.isThinkingEnded) return '';
    this.isThinkingEnded = true;

    const elapsed = this.timer.stop();
    let result = '</thinking>';

    if (elapsed !== null) {
      result += `\n<thinking_elapsed>${ThinkingTimer.format(elapsed)}</thinking_elapsed>`;
    }

    return result;
  }

  /** Trả về toàn bộ thinking content đã tích lũy. */
  getBuffer(): string {
    return this.buffer;
  }

  /** Trả về summary data. */
  getSummary(): QwenThinkingSummary {
    return {
      title: this.summaryTitle,
      thought: this.summaryThought,
    };
  }

  /** Reset parser state. */
  reset(): void {
    this.buffer = '';
    this.isThinkingStarted = false;
    this.isThinkingEnded = false;
    this.summaryTitle = [];
    this.summaryThought = [];
    this.timer.reset();
  }
}

/**
 * Create normalized thinking parser for Qwen.
 * Returns standardized <thinking>content</thinking> format.
 */
export function createQwenThinkingParser() {
  return new QwenThinkingParser();
}
