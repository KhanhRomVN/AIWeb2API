import express from 'express';
import { RateLimiter } from '../../rate-limiter';

// ============================================================
// admin.ts — Rate limit management endpoints
// Tách từ server.ts (lines 232–244).
// ============================================================

export function adminRouter(zaiRateLimiter: RateLimiter): express.Router {
    const router = express.Router();

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
