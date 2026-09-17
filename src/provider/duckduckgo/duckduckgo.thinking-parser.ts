/**
 * ------------------------------------------------------------------
 * DuckDuckGo Thinking Parser
 * ------------------------------------------------------------------
 * Detect và tách thinking tokens từ content stream của duck.ai.
 *
 * Duck.ai không có "thinking" field riêng — thay vào đó Claude
 * Haiku 4.5 và gpt-oss-120b emit thinking trong content stream
 * wrapped bằng XML-like tags:
 *
 *   <thinking>
 *   ... internal reasoning ...
 *   </thinking>
 *   Final answer here.
 *
 * ThinkingParser giữ state machine để:
 * 1. Detect khi nào đang trong <thinking>...</thinking> block
 * 2. Tách thinking content khỏi final answer content
 * 3. Emit đúng callback (onThinking vs onContent)
 *
 * Main exports:
 * - ThinkingParserState    : State machine enum
 * - ThinkingParser         : Stateful parser class
 * - stripThinkingTags()    : One-shot strip tags từ full string
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ThinkingTimer } from '../../utils/thinking-timer';

// ─── Constants ───────────────────────────────────────────────────────────

export const THINKING_OPEN_TAG = '<thinking>';
export const THINKING_CLOSE_TAG = '</thinking>';

// ─── State Machine ────────────────────────────────────────────────────────

export enum ThinkingParserState {
  /** Đang nhận content bình thường */
  NORMAL = 'NORMAL',
  /** Đang trong <thinking> block */
  THINKING = 'THINKING',
  /** Đang buffer để detect partial open tag */
  BUFFERING_OPEN = 'BUFFERING_OPEN',
  /** Đang buffer để detect partial close tag */
  BUFFERING_CLOSE = 'BUFFERING_CLOSE',
}

// ─── Result Types ────────────────────────────────────────────────────────

export interface ThinkingParseResult {
  /** Text thuộc về final answer — emit cho user */
  content: string;
  /** Text thuộc về internal reasoning — có thể hiện dưới dạng collapsible */
  thinking: string;
}

// ─── Utility Functions ───────────────────────────────────────────────────

/**
 * One-shot strip thinking tags từ string đã hoàn chỉnh.
 * Dùng khi cần clean output sau khi stream đã xong.
 *
 * @param text - Full text có thể chứa <thinking>...</thinking>
 * @returns { content, thinking } đã tách
 */
export function stripThinkingTags(text: string): ThinkingParseResult {
  let content = '';
  let thinking = '';

  let remaining = text;
  while (remaining.length > 0) {
    const openIdx = remaining.indexOf(THINKING_OPEN_TAG);
    if (openIdx === -1) {
      // Không còn thinking block nào
      content += remaining;
      break;
    }
    // Phần trước open tag là content
    content += remaining.slice(0, openIdx);
    remaining = remaining.slice(openIdx + THINKING_OPEN_TAG.length);

    // Tìm close tag
    const closeIdx = remaining.indexOf(THINKING_CLOSE_TAG);
    if (closeIdx === -1) {
      // Không có close tag — toàn bộ còn lại là thinking (malformed)
      thinking += remaining;
      break;
    }
    thinking += remaining.slice(0, closeIdx);
    remaining = remaining.slice(closeIdx + THINKING_CLOSE_TAG.length);
  }

  return { content: content.trimStart(), thinking };
}

/**
 * Kiểm tra model có support thinking không.
 * Dựa theo MODEL_CAPABILITIES trong constant.
 */
export function modelSupportsThinking(model: string): boolean {
  // Các model có reasoningEffort != "none"
  return model === 'claude-haiku-4-5' || model === 'tinfoil/gpt-oss-120b';
}

// ─── Stateful Parser ─────────────────────────────────────────────────────

/**
 * ThinkingParser — xử lý streaming content có thể chứa thinking blocks.
 *
 * Vấn đề của streaming: tag <thinking> có thể bị split giữa nhiều chunks.
 * Parser cần buffer phần cuối chunk để detect partial tags.
 *
 * Usage:
 * ```ts
 * const parser = new ThinkingParser({ enabled: true });
 *
 * // Khi nhận content từ SSE parser
 * const { content, thinking } = parser.feed('<thinking>Let me think...');
 * // → content: '', thinking: 'Let me think...'
 *
 * const { content: c2 } = parser.feed('</thinking>Here is my answer');
 * // → content: 'Here is my answer', thinking: ''
 *
 * // Khi stream kết thúc, flush buffer còn lại
 * const { content: c3 } = parser.flush();
 * ```
 */
export class ThinkingParser {
  private state: ThinkingParserState = ThinkingParserState.NORMAL;
  private tagBuffer = '';
  private readonly enabled: boolean;
  private readonly timer = new ThinkingTimer();

  constructor(options: { enabled: boolean }) {
    this.enabled = options.enabled;
  }

  /**
   * Feed một đoạn text từ stream.
   * Trả về { content, thinking } đã tách cho đoạn này.
   */
  feed(text: string): ThinkingParseResult {
    // Nếu thinking bị tắt hoặc model không support → pass through
    if (!this.enabled) {
      return { content: text, thinking: '' };
    }

    let content = '';
    let thinking = '';
    let remaining = text;

    while (remaining.length > 0) {
      switch (this.state) {
        case ThinkingParserState.NORMAL: {
          // Tìm open tag hoặc partial open tag ở cuối
          const openIdx = remaining.indexOf(THINKING_OPEN_TAG);
          if (openIdx !== -1) {
            // Tìm thấy full open tag
            content += remaining.slice(0, openIdx);
            remaining = remaining.slice(openIdx + THINKING_OPEN_TAG.length);
            this.state = ThinkingParserState.THINKING;
            this.tagBuffer = '';
            this.timer.start(); // bắt đầu đếm giờ thinking
          } else {
            // Kiểm tra partial open tag ở cuối chunk (tránh miss split)
            const partialLen = this.longestSuffixMatch(remaining, THINKING_OPEN_TAG);
            if (partialLen > 0) {
              // Flush phần safe, buffer phần partial
              content += remaining.slice(0, remaining.length - partialLen);
              this.tagBuffer = remaining.slice(remaining.length - partialLen);
              this.state = ThinkingParserState.BUFFERING_OPEN;
              remaining = '';
            } else {
              content += remaining;
              remaining = '';
            }
          }
          break;
        }

        case ThinkingParserState.BUFFERING_OPEN: {
          // Combine buffered + new data và re-process
          remaining = this.tagBuffer + remaining;
          this.tagBuffer = '';
          this.state = ThinkingParserState.NORMAL;
          // Re-loop với NORMAL state
          break;
        }

        case ThinkingParserState.THINKING: {
          // Tìm close tag
          const closeIdx = remaining.indexOf(THINKING_CLOSE_TAG);
          if (closeIdx !== -1) {
            thinking += remaining.slice(0, closeIdx);
            remaining = remaining.slice(closeIdx + THINKING_CLOSE_TAG.length);
            this.state = ThinkingParserState.NORMAL;
            // Gắn elapsed time vào cuối thinking block
            const elapsed = this.timer.stop();
            if (elapsed !== null) {
              thinking += `</thinking>\n<thinking_elapsed>${ThinkingTimer.format(elapsed)}</thinking_elapsed>`;
            } else {
              thinking += '</thinking>';
            }
            // Đã emit close tag trong thinking string — caller không cần emit lại
            // nhưng để consistent với interface, state về NORMAL
          } else {
            // Kiểm tra partial close tag ở cuối
            const partialLen = this.longestSuffixMatch(remaining, THINKING_CLOSE_TAG);
            if (partialLen > 0) {
              thinking += remaining.slice(0, remaining.length - partialLen);
              this.tagBuffer = remaining.slice(remaining.length - partialLen);
              this.state = ThinkingParserState.BUFFERING_CLOSE;
              remaining = '';
            } else {
              thinking += remaining;
              remaining = '';
            }
          }
          break;
        }

        case ThinkingParserState.BUFFERING_CLOSE: {
          // Combine buffered + new data và re-process
          remaining = this.tagBuffer + remaining;
          this.tagBuffer = '';
          this.state = ThinkingParserState.THINKING;
          // Re-loop với THINKING state
          break;
        }
      }
    }

    return { content, thinking };
  }

  /**
   * Flush buffer còn lại khi stream kết thúc.
   * Xử lý nốt partial tags chưa resolve.
   */
  flush(): ThinkingParseResult {
    let content = '';
    let thinking = '';

    if (this.tagBuffer) {
      const buf = this.tagBuffer;
      this.tagBuffer = '';

      if (this.state === ThinkingParserState.BUFFERING_OPEN) {
        // Partial open tag không được complete → treat as content
        content += buf;
      } else if (this.state === ThinkingParserState.BUFFERING_CLOSE) {
        // Partial close tag không được complete → còn trong thinking
        thinking += buf;
      }
    }

    // Nếu vẫn đang trong THINKING state khi stream kết thúc → malformed
    // Không có gì cần làm thêm, state sẽ reset khi parser được tái sử dụng

    this.reset();
    return { content, thinking };
  }

  /**
   * Kiểm tra parser đang trong thinking block không.
   */
  isInThinkingBlock(): boolean {
    return (
      this.state === ThinkingParserState.THINKING ||
      this.state === ThinkingParserState.BUFFERING_CLOSE
    );
  }

  /**
   * Reset về trạng thái ban đầu.
   */
  reset(): void {
    this.state = ThinkingParserState.NORMAL;
    this.tagBuffer = '';
    this.timer.reset();
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  /**
   * Tìm độ dài dài nhất của suffix của `text` mà là prefix của `tag`.
   * Dùng để detect partial tag ở cuối chunk.
   *
   * Ví dụ: text="...<anth", tag="<thinking>" → trả về 6
   */
  private longestSuffixMatch(text: string, tag: string): number {
    const maxCheck = Math.min(text.length, tag.length - 1);
    for (let len = maxCheck; len >= 1; len--) {
      const suffix = text.slice(text.length - len);
      const prefix = tag.slice(0, len);
      if (suffix === prefix) return len;
    }
    return 0;
  }
}
