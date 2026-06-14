"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyRouter = proxyRouter;
// proxy.ts - API Route for Proxy Management
const express_1 = __importDefault(require("express"));
function proxyRouter(proxyManager, onConfigChanged) {
    const router = express_1.default.Router();
    // GET proxy settings configuration
    router.get('/api/proxy/config', (req, res) => {
        const config = proxyManager.getConfig(false);
        res.json({
            success: true,
            config
        });
    });
    // POST update proxy settings configuration
    router.post('/api/proxy/config', async (req, res) => {
        try {
            const newConfig = req.body;
            proxyManager.saveConfig(newConfig);
            // Ensure Local HTTP CONNECT to SOCKS5 forwarder state
            await proxyManager.ensureForwarder();
            // Retrieve config (including forwarder properties)
            const fullConfig = proxyManager.getConfig(false);
            // Broadcast config change through WS to background worker
            onConfigChanged(fullConfig);
            res.json({
                success: true,
                message: 'Proxy configurations updated successfully.',
                config: fullConfig
            });
        }
        catch (err) {
            console.error('[Proxy Route] Error updating proxy config:', err);
            res.status(500).json({
                success: false,
                error: err.message || String(err)
            });
        }
    });
    return router;
}
