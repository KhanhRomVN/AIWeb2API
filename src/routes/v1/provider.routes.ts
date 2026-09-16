/**
 * ------------------------------------------------------------------
 * Provider Routes
 * ------------------------------------------------------------------
 * Routes cho API quản lý provider.
 *
 * Main routes:
 * - GET /v1/providers                 : Lấy danh sách providers
 * - GET /v1/providers/:providerId/models : Lấy models của provider
 * - POST /v1/providers/cache/clear    : Clear provider cache (debug)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import express from 'express';

// ── Controllers ──
import {
  getProviders,
  getProviderModels,
} from '../../controllers/provider.controller';

// ── Services ──
import { invalidateProviderCache } from '../../services/provider.service';

// ─── Router ─────────────────────────────────────────────────────────────

const router = express.Router();

router.get('/', getProviders);
router.get('/:providerId/models', getProviderModels);
router.post('/cache/clear', (req, res) => {
  invalidateProviderCache();
  res.json({ success: true, message: 'Provider cache cleared' });
});

export default router;