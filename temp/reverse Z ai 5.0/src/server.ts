import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { ZChat } from '../z';
import { MappingService } from './services/MappingService';
import { zenRouter } from './routes/zen';
import { webuiRouter } from './routes/webui';
import { adminRouter } from './routes/admin';
import { ProxyManager } from './services/ProxyManager';
import { proxyRouter } from './routes/proxy';

// ============================================================
// server.ts — Bootstrap only
// Khởi tạo dependencies, mount routes, start listening.
// Logic nghiệp vụ đã được tách vào:
//   src/services/MappingService.ts  — conversation mapping
//   src/utils/sanitizer.ts          — token sanitization
//   src/utils/sse.ts                — SSE helpers
//   src/routes/zen.ts               — /v1/* (Zen API)
//   src/routes/webui.ts             — /api/* (Z.AI Web UI mock)
//   src/routes/admin.ts             — /rate-limit-*
//   src/services/ProxyManager.ts    — local proxy configurations
//   src/services/Socks5Forwarder.ts — HTTP to SOCKS5 tunnel auth
//   src/routes/proxy.ts             — proxy config settings route
// ============================================================

const app = express();
const port = parseInt(process.env.PORT || '8888', 10);

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, '../DOC')));

// ---- Root route (Z.AI Web UI) ----
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../DOC/Z.ai - Free AI Chatbot & Agent powered by GLM-5.1 & GLM-5.html'));
});

// ---- Dependencies ----
const chatEngine = new ZChat();
const mappingService = new MappingService();
const proxyManager = new ProxyManager();

// Link proxy manager to core WebSocket engine
chatEngine.proxyManager = proxyManager;

// ---- Initialization state ----
let isInitialized = false;
let initError: string | null = null;

const getInitStatus = () => ({ isInitialized, initError });

// ---- Mount routes ----
app.use(zenRouter(chatEngine, mappingService, getInitStatus));
app.use(webuiRouter(chatEngine, getInitStatus));
app.use(adminRouter(chatEngine.rateLimiter));
app.use(proxyRouter(proxyManager, (config) => {
    chatEngine.broadcastProxyConfig(config);
}));

// ---- Initialize SOCKS5 Proxy Forwarder & Browser session ----
(async () => {
    try {
        console.log('[Server] Starting proxy forwarder check...');
        await proxyManager.ensureForwarder();
        
        console.log('[Server] Starting ZChat browser session...');
        await chatEngine.initBrowser();
        isInitialized = true;
        console.log('[Server] ZChat browser session initialized and ready.');
    } catch (e: any) {
        console.error('[Server] Failed to initialize ZChat browser:', e);
        initError = e.message || String(e);
    }
})();

// ---- Start HTTP server ----
app.listen(port, () => {
    console.log(`\n============================================================`);
    console.log(`[Server] Standalone Z.AI server listening at http://localhost:${port}`);
    console.log(`[Server] Bypassing elara-server. Ready for direct connection from Zen.`);
    console.log(`============================================================\n`);
});
