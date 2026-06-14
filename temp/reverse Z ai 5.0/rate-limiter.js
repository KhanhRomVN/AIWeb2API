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
exports.RateLimiter = exports.DEFAULT_RATE_LIMIT_CONFIG = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.DEFAULT_RATE_LIMIT_CONFIG = {
    maxRequestsPerMinute: 10,
    maxRequestsPerHour: 59,
    minIntervalMs: 3000, // 3 seconds between requests
    cooldownAfterWAFMs: 60000, // 1 minute cooldown after WAF block
};
class RateLimiter {
    config;
    minuteTimestamps = [];
    hourTimestamps = [];
    lastRequestTime = 0;
    wafCooldownUntil = 0;
    statePath;
    constructor(config) {
        this.config = { ...exports.DEFAULT_RATE_LIMIT_CONFIG, ...config };
        const isPackaged = typeof process.pkg !== 'undefined';
        let baseDir;
        if (isPackaged) {
            baseDir = path.dirname(process.execPath);
        }
        else {
            const normalizedDir = __dirname.replace(/\\/g, '/');
            if (normalizedDir.endsWith('/dist/server')) {
                baseDir = path.join(__dirname, '../../');
            }
            else if (normalizedDir.endsWith('/src')) {
                baseDir = path.join(__dirname, '../');
            }
            else {
                baseDir = __dirname;
            }
        }
        this.statePath = path.join(baseDir, 'rate-limit-state.json');
        this.loadState();
    }
    loadState() {
        try {
            if (fs.existsSync(this.statePath)) {
                const raw = fs.readFileSync(this.statePath, 'utf8');
                const parsed = JSON.parse(raw);
                const now = Date.now();
                // Clean old timestamps immediately when restoring state
                this.minuteTimestamps = (parsed.minuteTimestamps || []).filter((t) => now - t < 60000);
                this.hourTimestamps = (parsed.hourTimestamps || []).filter((t) => now - t < 3600000);
                this.lastRequestTime = parsed.lastRequestTime || 0;
                this.wafCooldownUntil = parsed.wafCooldownUntil || 0;
                console.log(`[RateLimiter] 💾 State restored: ${this.hourTimestamps.length} requests in the past hour.`);
            }
        }
        catch (e) {
            console.error('[RateLimiter] Error loading state from disk:', e);
        }
    }
    saveState() {
        try {
            const state = {
                minuteTimestamps: this.minuteTimestamps,
                hourTimestamps: this.hourTimestamps,
                lastRequestTime: this.lastRequestTime,
                wafCooldownUntil: this.wafCooldownUntil
            };
            fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf8');
        }
        catch (e) {
            console.error('[RateLimiter] Error saving state to disk:', e);
        }
    }
    async acquire() {
        const now = Date.now();
        // 1. Check WAF cooldown first (highest priority)
        if (now < this.wafCooldownUntil) {
            const retryAfterMs = this.wafCooldownUntil - now;
            console.log(`[RateLimiter] 🚫 WAF cooldown active. ${Math.ceil(retryAfterMs / 1000)}s remaining.`);
            return { allowed: false, reason: 'WAF cooldown active', retryAfterMs };
        }
        // 2. Clean old timestamps (sliding window)
        this.minuteTimestamps = this.minuteTimestamps.filter(t => now - t < 60000);
        this.hourTimestamps = this.hourTimestamps.filter(t => now - t < 3600000);
        // 3. Check per-minute limit
        if (this.minuteTimestamps.length >= this.config.maxRequestsPerMinute) {
            const oldestInMinute = this.minuteTimestamps[0];
            const retryAfterMs = 60000 - (now - oldestInMinute) + 100;
            return { allowed: false, reason: 'Per-minute rate limit exceeded', retryAfterMs };
        }
        // 4. Check per-hour limit
        if (this.hourTimestamps.length >= this.config.maxRequestsPerHour) {
            const oldestInHour = this.hourTimestamps[0];
            const retryAfterMs = 3600000 - (now - oldestInHour) + 100;
            return { allowed: false, reason: 'Per-hour rate limit exceeded', retryAfterMs };
        }
        // 5. Project request execution time and update lastRequestTime eagerly to prevent concurrency race
        const expectedRequestTime = Math.max(Date.now(), this.lastRequestTime + this.config.minIntervalMs);
        const waitMs = expectedRequestTime - Date.now();
        this.lastRequestTime = expectedRequestTime;
        // Record this request
        this.minuteTimestamps.push(expectedRequestTime);
        this.hourTimestamps.push(expectedRequestTime);
        this.saveState();
        // 6. Sleep if minimum interval is not met
        if (waitMs > 0) {
            console.log(`[RateLimiter] ⏳ Minimum interval not met. Waiting ${waitMs}ms...`);
            await this.sleep(waitMs);
        }
        return { allowed: true };
    }
    reportWAFBlock() {
        this.wafCooldownUntil = Date.now() + this.config.cooldownAfterWAFMs;
        console.log(`[RateLimiter] 🚨 WAF block reported! Cooldown activated until ${new Date(this.wafCooldownUntil).toISOString()}`);
        this.saveState();
    }
    reportError() {
        // Small backoff on errors to avoid rapid retries
        const backoffMs = 2000;
        this.lastRequestTime = Math.max(this.lastRequestTime, Date.now() + backoffMs);
        console.log(`[RateLimiter] ⚠️ Error reported. Backoff ${backoffMs}ms applied.`);
    }
    getStatus() {
        const now = Date.now();
        // Count without creating intermediate arrays (Issue #8 fix)
        let minuteCount = 0;
        let hourCount = 0;
        for (const t of this.minuteTimestamps) {
            if (now - t < 60000)
                minuteCount++;
        }
        for (const t of this.hourTimestamps) {
            if (now - t < 3600000)
                hourCount++;
        }
        return {
            requestsThisMinute: minuteCount,
            requestsThisHour: hourCount,
            maxRequestsPerMinute: this.config.maxRequestsPerMinute,
            maxRequestsPerHour: this.config.maxRequestsPerHour,
            minIntervalMs: this.config.minIntervalMs,
            cooldownAfterWAFMs: this.config.cooldownAfterWAFMs,
            wafCooldownActive: now < this.wafCooldownUntil,
            wafCooldownRemainingMs: Math.max(0, this.wafCooldownUntil - now),
            lastRequestTime: this.lastRequestTime,
        };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[RateLimiter] 🔄 Config updated:', JSON.stringify(this.config));
    }
    reset() {
        this.minuteTimestamps = [];
        this.hourTimestamps = [];
        this.lastRequestTime = 0;
        this.wafCooldownUntil = 0;
        if (fs.existsSync(this.statePath)) {
            try {
                fs.unlinkSync(this.statePath);
            }
            catch (e) { }
        }
        console.log('[RateLimiter] 🔄 All rate limits reset.');
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RateLimiter = RateLimiter;
