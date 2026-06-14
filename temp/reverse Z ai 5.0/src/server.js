"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
const z_1 = require("../z");
const MappingService_1 = require("./services/MappingService");
const zen_1 = require("./routes/zen");
const webui_1 = require("./routes/webui");
const admin_1 = require("./routes/admin");
const ProxyManager_1 = require("./services/ProxyManager");
const proxy_1 = require("./routes/proxy");
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
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT || '8888', 10);
// ---- Middleware ----
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
app.use(express_1.default.static(path.join(__dirname, '../DOC')));
// ---- Root route (Z.AI Web UI) ----
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../DOC/Z.ai - Free AI Chatbot & Agent powered by GLM-5.1 & GLM-5.html'));
});
// ---- Dependencies ----
const chatEngine = new z_1.ZChat();
const mappingService = new MappingService_1.MappingService();
const proxyManager = new ProxyManager_1.ProxyManager();
// Link proxy manager to core WebSocket engine
chatEngine.proxyManager = proxyManager;
// ---- Initialization state ----
let isInitialized = false;
let initError = null;
const getInitStatus = () => ({ isInitialized, initError });
// ---- Mount routes ----
app.use((0, zen_1.zenRouter)(chatEngine, mappingService, getInitStatus));
app.use((0, webui_1.webuiRouter)(chatEngine, getInitStatus));
app.use((0, admin_1.adminRouter)(chatEngine.rateLimiter));
app.use((0, proxy_1.proxyRouter)(proxyManager, (config) => {
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
    }
    catch (e) {
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
