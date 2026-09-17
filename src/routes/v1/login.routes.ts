/**
 * ------------------------------------------------------------------
 * Login Routes
 * ------------------------------------------------------------------
 * Routes cho API đăng nhập qua browser.
 *
 * Route chính:
 * - POST   /v1/accounts/login/:provider : Đăng nhập qua browser
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import { login, pollLogin } from '../../controllers/login.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.post('/:provider', login);
router.post('/:provider/poll', pollLogin);

export default router;
