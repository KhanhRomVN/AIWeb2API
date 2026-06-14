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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyManager = void 0;
// ProxyManager.ts - Manages proxy configuration and local Socks5Forwarder
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Socks5Forwarder_1 = require("./Socks5Forwarder");
class ProxyManager {
    configPath;
    config;
    forwarder = null;
    constructor() {
        this.configPath = path.join(__dirname, '../../proxy-config.json');
        this.config = this.loadConfig();
    }
    loadConfig() {
        const defaultConfig = {
            enabled: false,
            type: 'http',
            host: '',
            port: 80,
            username: '',
            password: ''
        };
        try {
            if (fs.existsSync(this.configPath)) {
                const raw = fs.readFileSync(this.configPath, 'utf8');
                const parsed = JSON.parse(raw);
                return { ...defaultConfig, ...parsed };
            }
        }
        catch (e) {
            console.error('[ProxyManager] Error loading proxy config:', e);
        }
        return defaultConfig;
    }
    getConfig(stripForwarder = true) {
        if (stripForwarder) {
            const { forwarderActive, forwarderPort, ...rest } = this.config;
            return rest;
        }
        return this.config;
    }
    saveConfig(newConfig) {
        // Strip runtime config before saving to disk
        const { forwarderActive, forwarderPort, ...persistConfig } = { ...this.config, ...newConfig };
        this.config = { ...this.config, ...newConfig };
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(persistConfig, null, 2), 'utf8');
            console.log('[ProxyManager] Proxy config saved to disk.');
        }
        catch (e) {
            console.error('[ProxyManager] Error saving proxy config:', e);
        }
    }
    needsForwarder(config) {
        // We need the local SOCKS5 forwarder only if proxy is SOCKS5 with auth credentials
        return config.enabled && config.type === 'socks5' && !!config.username;
    }
    async ensureForwarder() {
        const wantsForwarder = this.needsForwarder(this.config);
        if (wantsForwarder) {
            const forwarderConfig = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                password: this.config.password
            };
            if (this.forwarder) {
                // Update active forwarder credentials
                this.forwarder.updateConfig(forwarderConfig);
                this.config.forwarderActive = true;
                this.config.forwarderPort = this.forwarder.getPort();
            }
            else {
                console.log('[ProxyManager] Starting local Socks5Forwarder...');
                this.forwarder = new Socks5Forwarder_1.Socks5Forwarder(forwarderConfig);
                try {
                    const activePort = await this.forwarder.start(10809);
                    this.config.forwarderActive = true;
                    this.config.forwarderPort = activePort;
                    console.log(`[ProxyManager] Socks5Forwarder active on port ${activePort}`);
                }
                catch (e) {
                    console.error('[ProxyManager] Failed to start Socks5Forwarder:', e);
                    this.config.forwarderActive = false;
                    this.forwarder = null;
                }
            }
        }
        else {
            // Stop forwarder if not needed
            if (this.forwarder) {
                console.log('[ProxyManager] Stopping local Socks5Forwarder...');
                await this.forwarder.stop();
                this.forwarder = null;
            }
            this.config.forwarderActive = false;
            delete this.config.forwarderPort;
        }
    }
    async stopForwarder() {
        if (this.forwarder) {
            await this.forwarder.stop();
            this.forwarder = null;
        }
    }
}
exports.ProxyManager = ProxyManager;
