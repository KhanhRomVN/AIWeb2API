/**
 * ------------------------------------------------------------------
 * Chat Routes
 * ------------------------------------------------------------------
 * Routes cho API gửi tin nhắn chat.
 *
 * Main routes:
 * - POST /v1/accounts/messages              : Gửi tin nhắn (accountId trong body)
 * - POST /v1/accounts/:accountId/messages   : Gửi tin nhắn (accountId trong params)
 *
 * Middleware chain:
 * 1. requestLimitMiddleware : Kiểm tra giới hạn request theo period (provider dùng requestLimit)
 * 2. timeBlockMiddleware    : Chặn theo khung giờ UTC (DeepSeek: 10-11h và 2-4h VN)
 * 3. sendMessage            : Xử lý request chính
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import express from 'express';

// ── Controllers ──
import { sendMessage } from '../../controllers/chat.controller';

// ── Middleware ──
import { timeBlockMiddleware } from '../../middleware/time-block.middleware';
import { requestLimitMiddleware } from '../../middleware/request-limit.middleware';

// ─── Router ─────────────────────────────────────────────────────────────

const router = express.Router();

router.post(
  '/accounts/messages',
  requestLimitMiddleware,
  timeBlockMiddleware,
  sendMessage,
);
router.post(
  '/accounts/:accountId/messages',
  requestLimitMiddleware,
  timeBlockMiddleware,
  sendMessage,
);

export default router;
