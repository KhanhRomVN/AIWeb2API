/**
 * ------------------------------------------------------------------
 * Database Manager Routes
 * ------------------------------------------------------------------
 * CRUD + test connection cho database manager.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import {
  listManagersHandler,
  createManagerHandler,
  updateManagerHandler,
  deleteManagerHandler,
  testManagerHandler,
} from '../../controllers/database-manager.controller';

const router = Router();

router.get('/', listManagersHandler);
router.post('/', createManagerHandler);
router.post('/test', testManagerHandler);
router.put('/:id', updateManagerHandler);
router.delete('/:id', deleteManagerHandler);

export default router;