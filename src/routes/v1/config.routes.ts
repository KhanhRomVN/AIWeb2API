/**
 * ------------------------------------------------------------------
 * Config Routes
 * ------------------------------------------------------------------
 * Routes cho API cấu hình toàn cục.
 *
 * Main routes:
 * - GET /v1/config : Lấy cấu hình hiện tại
 * - PUT /v1/config : Cập nhật cấu hình (partial)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import {
  getConfigHandler,
  putConfigHandler,
} from '../../controllers/config.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.get('/', getConfigHandler);
router.put('/', putConfigHandler);

export default router;