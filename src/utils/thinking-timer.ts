/**
 * ------------------------------------------------------------------
 * Thinking Timer
 * ------------------------------------------------------------------
 * Shared wall-clock timer cho thinking phase của mọi provider.
 *
 * Dùng cho các provider không có elapsed_secs native (Qwen, Kimi,
 * Grok Build...) để giả lập thinking time giống DeepSeek.
 *
 * Usage:
 *   const timer = new ThinkingTimer();
 *   timer.start();               // gọi khi nhận chunk thinking đầu tiên
 *   const secs = timer.stop();   // gọi khi thinking kết thúc → số giây
 * ------------------------------------------------------------------
 */

export class ThinkingTimer {
  private startTime: number | null = null;
  private elapsedSecs: number | null = null;

  /** Bắt đầu đếm giờ (gọi khi feed() chunk thinking đầu tiên). */
  start(): void {
    if (this.startTime === null) {
      this.startTime = Date.now();
    }
  }

  /**
   * Dừng đếm và trả về số giây thinking (1 chữ số thập phân).
   * Gọi nhiều lần đều trả về cùng giá trị đã freeze.
   * Trả về null nếu chưa bao giờ start.
   */
  stop(): number | null {
    if (this.startTime === null) return null;
    if (this.elapsedSecs === null) {
      this.elapsedSecs = (Date.now() - this.startTime) / 1000;
    }
    return this.elapsedSecs;
  }

  /** Trả về elapsed hiện tại (không freeze) — dùng để đọc mid-stream. */
  peek(): number | null {
    if (this.startTime === null) return null;
    return (Date.now() - this.startTime) / 1000;
  }

  /** Reset về trạng thái ban đầu. */
  reset(): void {
    this.startTime = null;
    this.elapsedSecs = null;
  }

  /** Format elapsed thành chuỗi "X.Xs" (1 chữ số thập phân). */
  static format(secs: number): string {
    return secs.toFixed(1);
  }
}
