// proxy.ts - API Route for Proxy Management
import express from 'express';
import { ProxyManager } from '../services/ProxyManager';

export function proxyRouter(
    proxyManager: ProxyManager,
    onConfigChanged: (config: any) => void
): express.Router {
    const router = express.Router();

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
        } catch (err: any) {
            console.error('[Proxy Route] Error updating proxy config:', err);
            res.status(500).json({
                success: false,
                error: err.message || String(err)
            });
        }
    });

    return router;
}
