/**
 * ------------------------------------------------------------------
 * DeepSeek Thinking Parser
 * ------------------------------------------------------------------
 * Parse thinking content từ DeepSeek SSE stream và chuẩn hóa
 * thành format chung: <thinking>...</thinking>
 *
 * DeepSeek thinking format:
 * - Fragment type: "THINK"
 * - Content: raw thinking text
 * - Elapsed time: fragments[].elapsed_secs
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface DeepSeekThinkingChunk {
  type: 'thinking';
  content: string;
}

export interface DeepSeekThinkingMetadata {
  elapsed_secs?: number;
}

// ─── Thinking Parser ────────────────────────────────────────────────────

export class DeepSeekThinkingParser {
  private buffer = '';
  private isThinkingStarted = false;
  private isThinkingEnded = false;

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
      const output = '<thinking>' + chunk;
      return output;
    }

    // Subsequent chunks: just append
    this.buffer += chunk;
    return chunk;
  }

  /**
   * End thinking phase
   * Emit closing tag
   */
  end(metadata?: DeepSeekThinkingMetadata): string {
    if (this.isThinkingEnded) {
      return '';
    }
    this.isThinkingEnded = true;

    let result = '</thinking>';

    // Add metadata as XML tag with rounded value
    if (metadata?.elapsed_secs) {
      const roundedTime = metadata.elapsed_secs.toFixed(1);
      result += `\n<thinking_elapsed>${roundedTime}</thinking_elapsed>`;
    }

    return result;
  }

  /**
   * Get accumulated thinking content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = '';
    this.isThinkingStarted = false;
    this.isThinkingEnded = false;
  }
}

/**
 * Create normalized thinking parser for DeepSeek
 * Returns standardized <thinking>content</thinking> format
 */
export function createDeepSeekThinkingParser() {
  return new DeepSeekThinkingParser();
}
