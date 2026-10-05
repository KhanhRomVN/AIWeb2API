/**
 * ------------------------------------------------------------------
 * Time Block Middleware
 * ------------------------------------------------------------------
 * Chặn request đến provider trong các khung giờ bị cấm,
 * dựa trên `usagePolicy.blockedTimeRanges` của từng provider.
 *
 * Flexible: chỉ cần thêm `blockedTimeRanges` vào provider constant
 * là middleware tự động pick up — không cần sửa file này.
 *
 * Nếu provider hỗ trợ `deleteAllSessions()` thì tự động xóa toàn bộ
 * conversation của account bị chặn (fire-and-forget, không block response).
 *
 * Main functions:
 * - timeBlockMiddleware() : Middleware Express kiểm tra giờ cấm
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { providerRegistry } from '../provider/registry';
import { findAccountById } from '../repositories/account.repository';
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('TimeBlockMiddleware');

// ─── Helpers ────────────────────────────────────────────────────────────

function getCurrentUTCHour(): number {
  return new Date().getUTCHours();
}

/**
 * Fire-and-forget: xóa toàn bộ session của account khi bị time-block.
 * Không throw, không chờ — không ảnh hưởng response về client.
 */
async function triggerDeleteAllSessions(
  providerId: string,
  accountId: string,
): Promise<void> {
  try {
    const provider = providerRegistry.getProvider(providerId);
    if (!provider?.deleteAllSessions) return;

    const account = await findAccountById(accountId);
    if (!account?.credential) {
      logger.warn(
        `[TimeBlock] deleteAllSessions skipped — no credential for account=${accountId}`,
      );
      return;
    }

    const ok = await provider.deleteAllSessions(account.credential);
    if (ok) {
    } else {
      logger.warn(
        `[TimeBlock] deleteAllSessions returned false for account=${accountId}`,
      );
    }
  } catch (e: any) {
    logger.error(
      `[TimeBlock] deleteAllSessions unexpected error for account=${accountId}:`,
      e?.message || e,
    );
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────

/**
 * Kiểm tra giờ UTC hiện tại với `blockedTimeRanges` của provider.
 * Nếu không có `usagePolicy.blockedTimeRanges` → cho qua.
 * Nếu đang trong khung giờ bị cấm → trả lỗi và tự động xóa toàn bộ
 * session của account (nếu provider hỗ trợ).
 */
export function timeBlockMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const providerId: string | undefined = req.body?.providerId;
  if (!providerId) {
    next();
    return;
  }

  const provider = providerRegistry.getProvider(providerId);
  const ranges = provider?.usagePolicy?.blockedTimeRanges;

  if (!ranges || ranges.length === 0) {
    next();
    return;
  }

  const hour = getCurrentUTCHour();
  const blocked = ranges.find((r) => hour >= r.startTime && hour < r.endTime);

  if (!blocked) {
    next();
    return;
  }

  // Build label theo UTC vì backend không biết timezone của client
  const fmtUTC = (h: number) => `${String(h).padStart(2, '0')}:00 UTC`;
  const allRangesLabel = ranges
    .map((r) => `${fmtUTC(r.startTime)}–${fmtUTC(r.endTime)}`)
    .join(' và ');
  const blockedLabel = `${fmtUTC(blocked.startTime)}–${fmtUTC(blocked.endTime)}`;

  logger.warn(
    `[TimeBlock] provider=${providerId} blocked — UTC hour=${hour} in range ${blockedLabel}`,
  );

  // Fire-and-forget: xóa toàn bộ session của account bị chặn
  const accountId = req.params.accountId || req.body?.accountId;
  if (accountId && provider?.deleteAllSessions) {
    triggerDeleteAllSessions(providerId, accountId).catch(() => {});
  }

  const errorMsg =
    `Provider "${providerId}" bị chặn trong khung giờ ${allRangesLabel}. ` +
    `Hiện tại đang trong khung ${blockedLabel}. Vui lòng thử lại sau.`;

  const stream = req.body?.stream !== false;
  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(
      `data: ${JSON.stringify({ error: errorMsg, error_code: 'TIME_BLOCKED' })}\n\n`,
    );
    res.end();
  } else {
    res.status(403).json({
      success: false,
      message: errorMsg,
      error: { code: 'TIME_BLOCKED' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
}
