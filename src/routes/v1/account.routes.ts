import { Router } from 'express';
import {
  importAccounts,
  addAccount,
  getAccounts,
  deleteAccount,
  login,
  switchAccount,
  getAccountMemory,
  updateAccountMemoryController,
  getAccountBrowserStatus,
  startAccountBrowser,
} from '../../controllers/account.controller';

const router = Router();

// Nhập hàng loạt tài khoản (phát hiện trùng lặp)
router.post('/import', importAccounts);

// Thêm hoặc cập nhật credential của một tài khoản
router.post('/', addAccount);

// Lấy danh sách tài khoản (phân trang, lọc, sắp xếp)
router.get('/', getAccounts);

// Xóa tài khoản
router.delete('/:id', deleteAccount);

// Đăng nhập qua trình duyệt (Chrome + MITM proxy)
router.post('/login/:provider', login);

// POST Chuyển đổi tài khoản đang hoạt động
router.post('/:id/switch', switchAccount);

// GET Lấy trạng thái memory của account
router.get('/:id/memory', getAccountMemory);

// PUT Cập nhật trạng thái memory của account
router.put('/:id/memory', updateAccountMemoryController);

// Browser session management for browser-based providers
router.get('/:id/browser/status', getAccountBrowserStatus);
router.post('/:id/browser/start', startAccountBrowser);

export default router;
