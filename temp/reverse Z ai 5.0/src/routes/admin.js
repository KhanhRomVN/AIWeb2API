"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = adminRouter;
const express_1 = __importDefault(require("express"));
// ============================================================
// admin.ts — Rate limit management endpoints
// Tách từ server.ts (lines 232–244).
// ============================================================
function adminRouter(zaiRateLimiter) {
    const router = express_1.default.Router();
    /** Lấy trạng thái rate limit hiện tại */
    router.get('/rate-limit-status', (req, res) => {
        res.json(zaiRateLimiter.getStatus());
    });
    /** Cập nhật cấu hình rate limit */
    router.post('/rate-limit-config', (req, res) => {
        zaiRateLimiter.updateConfig(req.body);
        res.json({ success: true, config: zaiRateLimiter.getStatus() });
    });
    /** Reset counters rate limit */
    router.post('/rate-limit-reset', (req, res) => {
        zaiRateLimiter.reset();
        res.json({ success: true, config: zaiRateLimiter.getStatus() });
    });
    return router;
}
