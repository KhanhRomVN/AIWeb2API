/**
 * ------------------------------------------------------------------
 * Config Routes
 * ------------------------------------------------------------------
 * Routes cho API cấu hình toàn cục.
 *
 * Main routes:
 * - GET  /v1/config                    : Lấy cấu hình hiện tại
 * - PUT  /v1/config                    : Cập nhật cấu hình (partial)
 * - POST /v1/config/scan-profile-dir   : Quét cấu trúc thư mục profile
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import {
  getConfigHandler,
  putConfigHandler,
  scanProfileDirHandler,
} from '../../controllers/config.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.get('/', getConfigHandler);
router.put('/', putConfigHandler);
router.post('/scan-profile-dir', scanProfileDirHandler);

export default router;
