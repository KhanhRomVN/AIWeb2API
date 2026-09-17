/**
 * ------------------------------------------------------------------
 * Kimi Thinking Parser
 * ------------------------------------------------------------------
 * Parse thinking content từ Kimi connect+json stream và chuẩn hóa
 * thành format chung: <thinking>...</thinking>
 *
 * Kimi thinking format (trong response stream):
 * - Bắt đầu: op="set", mask="block.multiStage"
 *     → block.multiStage.stages[].name = "STAGE_NAME_THINKING"
 *     → block.multiStage.stages[].status = "STAGE_STATUS_START"
 * - Stage block: op="set", mask="block.stage"
 *     → block.stage.name = "STAGE_NAME_THINKING"
 * - Nội dung thinking (chunk đầu): op="set", mask="block.think"
 *     → block.think.content = <first_chunk>
 * - Nội dung thinking (tiếp theo): op="append", mask="block.think.content"
 *     → block.think.content = <next_chunk>
 * - Kết thúc: op="set", mask="block.multiStage"
 *     → block.multiStage.stages[].name = "STAGE_NAME_THINKING"
 *     → block.multiStage.stages[].status = "STAGE_STATUS_END"
 *
 * Request options:
 * - Thinking ON:  options.reasoning_effort = "REASONING_EFFORT_LOW" | "REASONING_EFFORT_HIGH"
 * - Thinking OFF: options.reasoning_effort = "REASONING_EFFORT_NONE"
 * - Search ON:    tools chứa { type: "TOOL_TYPE_SEARCH", search: {} }
 *
 * Elapsed time: wall-clock timer (Kimi không trả về elapsed natively).
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ThinkingTimer } from '../../utils/thinking-timer';

// ─── Constants ───────────────────────────────────────────────────────────

const STAGE_NAME_THINKING = 'STAGE_NAME_THINKING';
const STAGE_STATUS_START  = 'STAGE_STATUS_START';
const STAGE_STATUS_END    = 'STAGE_STATUS_END';

// ─── Types ──────────────────────────────────────────────────────────────

export interface KimiThinkingChunk {
  type: 'thinking';
  content: string;
}

// ─── Thinking Parser ────────────────────────────────────────────────────

export class KimiThinkingParser {
  private buffer = '';
  private isThinkingStarted = false;
  private isThinkingEnded = false;
  private readonly timer = new ThinkingTimer();

  /**
   * Feed một chunk thinking content.
   * Gọi khi nhận được:
   *   - op="set",    mask="block.think"         → block.think.content
   *   - op="append", mask="block.think.content" → block.think.content
   *
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
   * Kết thúc thinking phase.
   * Gọi khi nhận được op="set", mask="block.multiStage"
   * với stages[].status = "STAGE_STATUS_END".
   *
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

  /**
   * Kiểm tra xem event JSON có phải là bắt đầu thinking stage không.
   */
  static isThinkingStart(event: any): boolean {
    if (event?.mask !== 'block.multiStage') return false;
    const stages: any[] = event?.block?.multiStage?.stages ?? [];
    return stages.some(
      (s) => s.name === STAGE_NAME_THINKING && s.status === STAGE_STATUS_START,
    );
  }

  /**
   * Kiểm tra xem event JSON có phải là kết thúc thinking stage không.
   */
  static isThinkingEnd(event: any): boolean {
    if (event?.mask !== 'block.multiStage') return false;
    const stages: any[] = event?.block?.multiStage?.stages ?? [];
    return stages.some(
      (s) => s.name === STAGE_NAME_THINKING && s.status === STAGE_STATUS_END,
    );
  }

  /**
   * Trích xuất thinking content từ event JSON.
   * Xử lý cả 2 case:
   *   - op="set",    mask="block.think"         → block.think.content
   *   - op="append", mask="block.think.content" → block.think.content
   * Trả về null nếu event không chứa thinking content.
   */
  static extractThinkingContent(event: any): string | null {
    const mask: string = event?.mask ?? '';
    if (mask === 'block.think' || mask === 'block.think.content') {
      const content = event?.block?.think?.content;
      return typeof content === 'string' ? content : null;
    }
    return null;
  }

  /** Get accumulated thinking content (không bao gồm tags). */
  getBuffer(): string {
    return this.buffer;
  }

  /** Reset parser state. */
  reset(): void {
    this.buffer = '';
    this.isThinkingStarted = false;
    this.isThinkingEnded = false;
    this.timer.reset();
  }
}

/**
 * Create normalized thinking parser for Kimi.
 * Returns standardized <thinking>content</thinking> format.
 */
export function createKimiThinkingParser() {
  return new KimiThinkingParser();
}
