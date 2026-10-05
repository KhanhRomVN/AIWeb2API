/**
 * ------------------------------------------------------------------
 * Request Limit Middleware
 * ------------------------------------------------------------------
 * Kiểm tra account đã vượt giới hạn request chưa,
 * dựa trên `usagePolicy.requestLimit` và `requestLimitPeriod` của provider.
 *
 * Khi mỗi request thành công (gọi từ chat.controller.ts onDone):
 *   - Tính `usage` (%) và `reset_usage_at` rồi ghi vào DB
 *
 * Flexible: chỉ cần thêm `requestLimit` vào provider constant
 * là middleware tự động pick up — không cần sửa file này.
 *
 * Main functions:
 * - requestLimitMiddleware()      : Middleware kiểm tra giới hạn request
 * - computeResetAt()              : Tính thời điểm reset tiếp theo theo period
 * - incrementRequestCountAndUsage(): Tăng count + ghi usage/reset_usage_at
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { providerRegistry } from '../provider/registry';
import { findAccountById } from '../repositories/account.repository';
import { getDataStore } from '../database';
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('RequestLimitMiddleware');

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Tính ISO string của thời điểm reset tiếp theo dựa theo period.
 * Luôn dùng UTC chuẩn để lưu DB, nhưng "ngày" được tính theo
 * offset UTC+7 (Asia/Ho_Chi_Minh) — tức là reset lúc 17:00 UTC
 * (= 00:00 GMT+7 ngày hôm sau).
 *
 * - 'day'   : 00:00 GMT+7 ngày hôm sau  (= 17:00 UTC hôm nay)
 * - 'week'  : thứ Hai 00:00 GMT+7 tuần tới
 * - 'month' : ngày 1 tháng tới 00:00 GMT+7
 *
 * Kết quả là ISO string UTC (luôn có Z) — lưu thẳng vào DB.
 */
export function computeResetAt(period: 'day' | 'week' | 'month'): string {
  // Offset UTC+7 tính bằng phút
  const TZ_OFFSET_MINUTES = 7 * 60; // 420 phút
  const now = new Date();

  // Lấy "giờ local GMT+7" bằng cách dịch chuyển thời gian
  const localMs = now.getTime() + TZ_OFFSET_MINUTES * 60 * 1000;
  const localDate = new Date(localMs);

  if (period === 'day') {
    // Ngày hôm sau theo GMT+7: lấy ngày UTC của localDate rồi +1
    // Sau đó convert ngược về UTC (trừ 7 giờ)
    const next = new Date(
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        localDate.getUTCDate() + 1,
        0,
        0,
        0,
        0, // 00:00:00 GMT+7
      ) -
        TZ_OFFSET_MINUTES * 60 * 1000,
    );
    return next.toISOString();
  }
  if (period === 'week') {
    // Thứ Hai đầu tuần tiếp theo theo GMT+7
    const dayOfWeek = localDate.getUTCDay(); // 0=Sun, 1=Mon
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const next = new Date(
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        localDate.getUTCDate() + daysUntilMonday,
        0,
        0,
        0,
        0,
      ) -
        TZ_OFFSET_MINUTES * 60 * 1000,
    );
    return next.toISOString();
  }
  // month: ngày 1 tháng tới 00:00 GMT+7
  const next = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    ) -
      TZ_OFFSET_MINUTES * 60 * 1000,
  );
  return next.toISOString();
}

/**
 * Trả về chuỗi period key để so sánh reset, dựa theo GMT+7.
 * - 'day'   : 'YYYY-MM-DD' (ngày theo GMT+7)
 * - 'week'  : 'YYYY-Www'   (ISO week, thứ Hai GMT+7)
 * - 'month' : 'YYYY-MM'    (tháng theo GMT+7)
 */
export function periodKey(
  period: 'day' | 'week' | 'month',
  date: Date,
): string {
  // Chuyển date sang "view GMT+7"
  const TZ_OFFSET_MINUTES = 7 * 60;
  const localMs = date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000;
  const localDate = new Date(localMs);

  if (period === 'day') return localDate.toISOString().slice(0, 10);
  if (period === 'week') {
    // ISO week: thứ Hai là ngày đầu tuần
    const d = new Date(
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        localDate.getUTCDate(),
      ),
    );
    const dayOfWeek = d.getUTCDay() || 7; // 1=Mon, 7=Sun
    d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // tới thứ Năm của tuần đó
    const year = d.getUTCFullYear();
    const weekNo = Math.ceil(
      ((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7,
    );
    return `${year}-W${String(weekNo).padStart(2, '00')}`;
  }
  return localDate.toISOString().slice(0, 7); // YYYY-MM
}

/**
 * Parse reset_usage_at từ DB (SQLite lưu dạng "YYYY-MM-DD HH:MM:SS.sssZ"
 * hoặc "YYYY-MM-DD HH:MM:SS" — thiếu T và Z) về Date UTC đúng.
 */
export function parseResetAt(raw: string): Date {
  // Nếu đã có T → ISO hợp lệ, parse thẳng
  if (raw.includes('T')) return new Date(raw);
  // SQLite format: "YYYY-MM-DD HH:MM:SS" → thêm T và Z để parse UTC
  return new Date(raw.replace(' ', 'T') + 'Z');
}

/**
 * Tính lại `usage` (%) và `reset_usage_at` mới nhất từ dữ liệu DB hiện tại,
 * đối chiếu với period hiện tại (GMT+7).
 *
 * Gọi mỗi khi GET /accounts để luôn trả về usage up-to-date mà không cần
 * thêm DB write — chỉ tính lại trên dữ liệu đã có sẵn.
 *
 * Logic:
 * - `reset_usage_at` là thời điểm reset KẾ TIẾP — nếu còn trong tương lai
 *   → vẫn trong period hiện tại → giữ nguyên usage.
 * - Nếu `reset_usage_at` đã qua (period cũ) → usage = 0, tính reset mới.
 * - Nếu `reset_usage_at` null → coi như period cũ → usage = 0.
 */
export function computeLiveUsageFields(
  rawUsage: number | null,
  rawResetAt: string | null,
  requestLimit: number,
  period: 'day' | 'week' | 'month',
): { usage: number | null; reset_usage_at: string } {
  const now = new Date();
  const nextResetAt = computeResetAt(period);

  // reset_usage_at còn trong tương lai → vẫn trong period hiện tại
  const isSamePeriod =
    rawResetAt !== null &&
    (() => {
      try {
        return parseResetAt(rawResetAt).getTime() > now.getTime();
      } catch {
        return false;
      }
    })();

  if (isSamePeriod) {
    // Cùng period → usage vẫn còn hiệu lực, cập nhật reset_usage_at sang kỳ tiếp mới nhất
    return {
      usage: rawUsage ?? 0,
      reset_usage_at: nextResetAt,
    };
  }

  // Period mới → reset usage về 0
  return {
    usage: 0,
    reset_usage_at: nextResetAt,
  };
}

/**
 * Tăng request count cho account sau khi request thành công.
 * Tự động reset count khi sang period mới.
 * Tính và ghi `usage` (%) + `reset_usage_at` vào DB.
 *
 * Gọi fire-and-forget từ chat.controller.ts onDone.
 */
export async function incrementRequestCountAndUsage(
  accountId: string,
  requestLimit: number,
  period: 'day' | 'week' | 'month',
): Promise<void> {
  try {
    const db = getDataStore().kysely;
    const now = new Date();
    const currentPeriodKey = periodKey(period, now);
    const resetAt = computeResetAt(period);

    // Đọc usage + reset_usage_at hiện tại để tính count
    const row = await db
      .selectFrom('accounts')
      .select(['usage', 'reset_usage_at'])
      .where('id', '=', accountId)
      .executeTakeFirst();

    if (!row) return;

    // Kiểm tra có cùng period không dựa trên reset_usage_at
    const lastResetAt = (row as any).reset_usage_at as string | null;
    const isSamePeriod =
      lastResetAt !== null &&
      periodKey(period, parseResetAt(lastResetAt)) === currentPeriodKey;

    // Tính lại count từ usage % (reverse: count = round(usage * requestLimit / 100))
    const currentUsagePct = isSamePeriod
      ? (((row as any).usage as number | null) ?? 0)
      : 0;
    const currentCount = isSamePeriod
      ? Math.round((currentUsagePct / 100) * requestLimit)
      : 0;
    const newCount = currentCount + 1;

    // Tính usage % mới
    const usagePct = Math.min((newCount / requestLimit) * 100, 100);

    await db
      .updateTable('accounts')
      .set({
        usage: usagePct,
        reset_usage_at: resetAt,
      } as any)
      .where('id', '=', accountId)
      .execute();
  } catch (err: any) {
    logger.warn(
      `[RequestLimit] incrementRequestCountAndUsage failed: ${err.message}`,
    );
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────

/**
 * Kiểm tra giới hạn request từ `usagePolicy.requestLimit` của provider.
 * Nếu provider không có field này → bỏ qua.
 */
export async function requestLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const providerId: string | undefined = req.body?.providerId;
  if (!providerId) {
    next();
    return;
  }

  const provider = providerRegistry.getProvider(providerId);
  const requestLimit = provider?.usagePolicy?.requestLimit;

  // Provider không có requestLimit → bỏ qua
  if (requestLimit === undefined || requestLimit === null) {
    next();
    return;
  }

  const period: 'day' | 'week' | 'month' =
    provider?.usagePolicy?.requestLimitPeriod ?? 'day';

  const accountId = req.params.accountId || req.body?.accountId;
  if (!accountId) {
    next();
    return;
  }

  try {
    const account = await findAccountById(accountId);
    if (!account) {
      next();
      return;
    }

    const now = new Date();
    const currentPeriodKey = periodKey(period, now);
    const lastResetAt = (account as any).reset_usage_at as string | null;
    const isSamePeriod =
      lastResetAt !== null &&
      periodKey(period, parseResetAt(lastResetAt)) === currentPeriodKey;
    const currentUsagePct = isSamePeriod
      ? (((account as any).usage as number | null) ?? 0)
      : 0;
    const currentCount = Math.round((currentUsagePct / 100) * requestLimit);

    if (currentCount >= requestLimit) {
      const periodLabel =
        period === 'day' ? 'ngày' : period === 'week' ? 'tuần' : 'tháng';
      logger.warn(
        `[RequestLimit] provider=${providerId} account=${accountId} exceeded limit — requests=${currentCount}/${requestLimit} period=${period}`,
      );

      const resetAt = computeResetAt(period);
      const resetLabel = new Date(resetAt).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const errorMsg =
        `Tài khoản đã đạt giới hạn ${requestLimit.toLocaleString()} request/${periodLabel} cho provider "${providerId}". ` +
        `Đã dùng: ${currentCount.toLocaleString()} request. Thử lại sau: ${resetLabel} (GMT+7).`;

      const stream = req.body?.stream !== false;
      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(
          `data: ${JSON.stringify({ error: errorMsg, error_code: 'REQUEST_LIMIT_EXCEEDED' })}\n\n`,
        );
        res.end();
      } else {
        res.status(429).json({
          success: false,
          message: errorMsg,
          error: { code: 'REQUEST_LIMIT_EXCEEDED' },
          meta: {
            requests: currentCount,
            limit: requestLimit,
            period,
            resets_at: resetAt,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return;
    }

    next();
  } catch (err: any) {
    logger.error(`[RequestLimit] Error checking request limit: ${err.message}`);
    next();
  }
}
