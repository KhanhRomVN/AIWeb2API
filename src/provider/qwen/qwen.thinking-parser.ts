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
 * ------------------------------------------------------------------
 */

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

  /**
   * Feed thinking content chunk
   * Automatically wrap trong <thinking> tags
   */
  feed(chunk: string): string {
    if (!chunk) return '';

    // First chunk: emit opening tag
    if (!this.isThinkingStarted) {
      this.isThinkingStarted = true;
      this.buffer = chunk;
      return '<thinking>' + chunk;
    }

    // Subsequent chunks: just append
    this.buffer += chunk;
    return chunk;
  }

  /**
   * Feed thinking summary (từ thinking_summary phase)
   * This is called when we receive the complete summary object
   */
  feedSummary(summary: QwenThinkingSummary): string {
    const parts: string[] = [];

    // Add title if available
    if (summary.title && summary.title.length > 0) {
      this.summaryTitle = summary.title;
      const titleText = summary.title.join('\n');
      if (titleText) {
        parts.push(`### Title\n${titleText}`);
      }
    }

    // Add thought content
    if (summary.thought && summary.thought.length > 0) {
      this.summaryThought = summary.thought;
      const thoughtText = summary.thought.join('\n');
      if (thoughtText) {
        parts.push(`### Thought\n${thoughtText}`);
      }
    }

    if (parts.length === 0) return '';

    const content = parts.join('\n\n');

    // First summary: emit opening tag
    if (!this.isThinkingStarted) {
      this.isThinkingStarted = true;
      this.buffer = content;
      return '<thinking>' + content;
    }

    // Subsequent summaries: just append
    this.buffer += '\n\n' + content;
    return '\n\n' + content;
  }

  /**
   * End thinking phase
   * Emit closing tag
   */
  end(): string {
    if (this.isThinkingEnded) return '';
    this.isThinkingEnded = true;

    return '</thinking>';
  }

  /**
   * Get accumulated thinking content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Get summary data
   */
  getSummary(): QwenThinkingSummary {
    return {
      title: this.summaryTitle,
      thought: this.summaryThought,
    };
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = '';
    this.isThinkingStarted = false;
    this.isThinkingEnded = false;
    this.summaryTitle = [];
    this.summaryThought = [];
  }
}

/**
 * Create normalized thinking parser for Qwen
 * Returns standardized <thinking>content</thinking> format
 */
export function createQwenThinkingParser() {
  return new QwenThinkingParser();
}
