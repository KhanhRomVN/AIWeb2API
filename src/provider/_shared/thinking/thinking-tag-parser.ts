/**
 * ------------------------------------------------------------------
 * Base Thinking Parser
 * ------------------------------------------------------------------
 * Máy trạng thái chuẩn hóa thinking content thành format:
 *    *   optional: <thinking_elapsed>X.X</thinking_elapsed>
 *   optional: <thinking_tokens>N</thinking_tokens>
 *
 * Gom logic lặp ở 6 provider: deepseek, freebuff, grok-build-cli,
 * kiro, kimi, qwen.
 *
 * Options:
 * - trackElapsed=true → tự dùng ThinkingTimer (freebuff, grok, kimi, qwen)
 * - trackElapsed=false → không timer, elapsed phải truyền qua metadata (deepseek)
 *                        hoặc không emit elapsed (kiro)
 * ------------------------------------------------------------------
 */

import { ThinkingTimer } from '../../../utils/thinking-timer';
import { THINKING_TAGS } from '../constants/thinking.constants';

export interface ThinkingEndMeta {
  /** Elapsed seconds từ server (deepseek). Bỏ qua nếu trackElapsed=true. */
  elapsedSecs?: number;
  /** Số token reasoning (grok-build-cli). */
  reasoningTokens?: number;
}

export interface ThinkingParserOptions {
  /** Dùng wall-clock timer thay vì nhận elapsedSecs từ metadata. */
  trackElapsed?: boolean;
}

export class ThinkingTagParser {
  protected buffer = '';
  protected isStarted = false;
  protected isEnded = false;
  protected readonly timer: ThinkingTimer | null;
  private readonly trackElapsed: boolean;

  constructor(opts: ThinkingParserOptions = {}) {
    this.trackElapsed = opts.trackElapsed ?? false;
    this.timer = this.trackElapsed ? new ThinkingTimer() : null;
  }

  /**
   * Feed một chunk thinking content.
   * Chunk đầu tiên tự động prepend OPEN tag; các chunk sau trả nguyên văn.
   * Buffer được tích luỹ để phục vụ getBuffer()/reset().
   */
  feed(chunk: string): string {
    if (this.isEnded) return '';
    if (!chunk) return '';

    this.buffer += chunk;

    if (!this.isStarted) {
      this.isStarted = true;
      return THINKING_TAGS.OPEN + chunk;
    }
    return chunk;
  }

  /**
   * Kết thúc stream thinking — emit CLOSE tag + optional elapsed/tokens.
   */
  end(meta?: ThinkingEndMeta): string {
    if (this.isEnded) return '';
    if (!this.isStarted) {
      this.isEnded = true;
      return '';
    }

    this.isEnded = true;

    let result = THINKING_TAGS.CLOSE;

    // Elapsed time
    let elapsedStr: string | null = null;
    if (this.trackElapsed && this.timer) {
      const elapsed = this.timer.stop();
      if (elapsed !== null) {
        elapsedStr = ThinkingTimer.format(elapsed);
      }
    } else if (meta?.elapsedSecs != null) {
      elapsedStr = meta.elapsedSecs.toFixed(1);
    }

    if (elapsedStr !== null) {
      result += `\n${THINKING_TAGS.ELAPSED_OPEN}${elapsedStr}${THINKING_TAGS.ELAPSED_CLOSE}`;
    }

    // Reasoning tokens (optional)
    if (meta?.reasoningTokens != null) {
      result += `\n${THINKING_TAGS.TOKENS_OPEN}${meta.reasoningTokens}${THINKING_TAGS.TOKENS_CLOSE}`;
    }

    return result;
  }

  isActive(): boolean {
    return this.isStarted && !this.isEnded;
  }

  getBuffer(): string {
    return this.buffer;
  }

  reset(): void {
    this.buffer = '';
    this.isStarted = false;
    this.isEnded = false;
    this.timer?.reset();
  }
}

export function createThinkingParser(
  opts: ThinkingParserOptions = {},
): ThinkingTagParser {
  return new ThinkingTagParser(opts);
}