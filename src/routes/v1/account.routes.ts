/**
 * ------------------------------------------------------------------
 * Account Routes
 * ------------------------------------------------------------------
 * Routes cho API quản lý tài khoản provider.
 *
 * Main routes:
 * - POST   /v1/accounts/import         : Import danh sách tài khoản
 * - POST   /v1/accounts                : Thêm một tài khoản
 * - GET    /v1/accounts                : Lấy danh sách tài khoản
 * - DELETE /v1/accounts/:id            : Xóa tài khoản
 * - POST   /v1/accounts/:id/presence   : Heartbeat presence (chat view đang dùng account)
 * - DELETE /v1/accounts/:id/presence   : Giải phóng presence khi rời chat
 * - POST   /v1/accounts/:id/session-cleanup : Xóa toàn bộ conversation phía provider
 * - POST   /v1/accounts/:id/refresh-token : Refresh token từ browser
 * - GET    /v1/accounts/:id/browser/status : Trạng thái browser
 * - POST   /v1/accounts/:id/browser/start : Khởi động browser
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import {
  importAccounts,
  previewImport,
  overrideAccount,
  addAccount,
  updateAccountHandler,
  getAccounts,
  getAccountByIdHandler,
  deleteAccount,
  refreshAccountToken,
  getAccountBrowserStatus,
  startAccountBrowser,
  heartbeatAccountPresence,
  releaseAccountPresence,
  deleteAllAccountSessions,
} from '../../controllers/account.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.post('/import/preview', previewImport);
router.post('/import', importAccounts);
router.post('/override', overrideAccount);
router.post('/', addAccount);
router.get('/', getAccounts);
router.get('/:id', getAccountByIdHandler);
router.put('/:id', updateAccountHandler);
router.delete('/:id', deleteAccount);
router.post('/:id/presence', heartbeatAccountPresence);
router.delete('/:id/presence', releaseAccountPresence);
router.post('/:id/session-cleanup', deleteAllAccountSessions);
router.post('/:id/refresh-token', refreshAccountToken);
router.get('/:id/browser/status', getAccountBrowserStatus);
router.post('/:id/browser/start', startAccountBrowser);

export default router;