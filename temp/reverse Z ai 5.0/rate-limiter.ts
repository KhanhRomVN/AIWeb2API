import * as fs from 'fs';
import * as path from 'path';

/**
 * rate-limiter.ts — Z.AI Rate Limiter
 * Prevents WAF blocking by controlling request frequency
 * 
 * Features:
 * - Sliding window rate limiting (per-minute and per-hour)
 * - Minimum interval enforcement between consecutive requests
 * - WAF block detection with automatic cooldown
 * - Error backoff to prevent rapid retries
 */

export interface RateLimitConfig {
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    minIntervalMs: number;
    cooldownAfterWAFMs: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
    maxRequestsPerMinute: 10,
    maxRequestsPerHour: 59,
    minIntervalMs: 3000,       // 3 seconds between requests
    cooldownAfterWAFMs: 60000, // 1 minute cooldown after WAF block
};

export interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    retryAfterMs?: number;
}

export class RateLimiter {
    private config: RateLimitConfig;
    private minuteTimestamps: number[] = [];
    private hourTimestamps: number[] = [];
    private lastRequestTime: number = 0;
    private wafCooldownUntil: number = 0;
    private statePath: string;

    constructor(config?: Partial<RateLimitConfig>) {
        this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
        
        const isPackaged = typeof (process as any).pkg !== 'undefined';
        let baseDir: string;
        if (isPackaged) {
            baseDir = path.dirname(process.execPath);
        } else {
            const normalizedDir = __dirname.replace(/\\/g, '/');
            if (normalizedDir.endsWith('/dist/server')) {
                baseDir = path.join(__dirname, '../../');
            } else if (normalizedDir.endsWith('/src')) {
                baseDir = path.join(__dirname, '../');
            } else {
                baseDir = __dirname;
            }
        }
        this.statePath = path.join(baseDir, 'rate-limit-state.json');
        this.loadState();
    }

    private loadState(): void {
        try {
            if (fs.existsSync(this.statePath)) {
                const raw = fs.readFileSync(this.statePath, 'utf8');
                const parsed = JSON.parse(raw);
                const now = Date.now();

                // Clean old timestamps immediately when restoring state
                this.minuteTimestamps = (parsed.minuteTimestamps || []).filter((t: number) => now - t < 60000);
                this.hourTimestamps = (parsed.hourTimestamps || []).filter((t: number) => now - t < 3600000);
                this.lastRequestTime = parsed.lastRequestTime || 0;
                this.wafCooldownUntil = parsed.wafCooldownUntil || 0;

                console.log(`[RateLimiter] 💾 State restored: ${this.hourTimestamps.length} requests in the past hour.`);
            }
        } catch (e) {
            console.error('[RateLimiter] Error loading state from disk:', e);
        }
    }

    private saveState(): void {
        try {
            const state = {
                minuteTimestamps: this.minuteTimestamps,
                hourTimestamps: this.hourTimestamps,
                lastRequestTime: this.lastRequestTime,
                wafCooldownUntil: this.wafCooldownUntil
            };
            fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf8');
        } catch (e) {
            console.error('[RateLimiter] Error saving state to disk:', e);
        }
    }

    async acquire(): Promise<RateLimitResult> {
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

    reportWAFBlock(): void {
        this.wafCooldownUntil = Date.now() + this.config.cooldownAfterWAFMs;
        console.log(`[RateLimiter] 🚨 WAF block reported! Cooldown activated until ${new Date(this.wafCooldownUntil).toISOString()}`);
        this.saveState();
    }

    reportError(): void {
        // Small backoff on errors to avoid rapid retries
        const backoffMs = 2000;
        this.lastRequestTime = Math.max(this.lastRequestTime, Date.now() + backoffMs);
        console.log(`[RateLimiter] ⚠️ Error reported. Backoff ${backoffMs}ms applied.`);
    }

    getStatus(): Record<string, any> {
        const now = Date.now();
        // Count without creating intermediate arrays (Issue #8 fix)
        let minuteCount = 0;
        let hourCount = 0;
        for (const t of this.minuteTimestamps) {
            if (now - t < 60000) minuteCount++;
        }
        for (const t of this.hourTimestamps) {
            if (now - t < 3600000) hourCount++;
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

    updateConfig(newConfig: Partial<RateLimitConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('[RateLimiter] 🔄 Config updated:', JSON.stringify(this.config));
    }

    reset(): void {
        this.minuteTimestamps = [];
        this.hourTimestamps = [];
        this.lastRequestTime = 0;
        this.wafCooldownUntil = 0;
        if (fs.existsSync(this.statePath)) {
            try {
                fs.unlinkSync(this.statePath);
            } catch (e) {}
        }
        console.log('[RateLimiter] 🔄 All rate limits reset.');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}