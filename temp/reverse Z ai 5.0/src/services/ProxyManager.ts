// ProxyManager.ts - Manages proxy configuration and local Socks5Forwarder
import * as fs from 'fs';
import * as path from 'path';
import { Socks5Forwarder } from './Socks5Forwarder';

export interface ProxyConfig {
    enabled: boolean;
    type: 'http' | 'https' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
    // Runtime properties (not persisted)
    forwarderActive?: boolean;
    forwarderPort?: number;
}

export class ProxyManager {
    private configPath: string;
    private config: ProxyConfig;
    private forwarder: Socks5Forwarder | null = null;

    constructor() {
        this.configPath = path.join(__dirname, '../../proxy-config.json');
        this.config = this.loadConfig();
    }

    private loadConfig(): ProxyConfig {
        const defaultConfig: ProxyConfig = {
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
        } catch (e) {
            console.error('[ProxyManager] Error loading proxy config:', e);
        }
        return defaultConfig;
    }

    public getConfig(stripForwarder: boolean = true): ProxyConfig {
        if (stripForwarder) {
            const { forwarderActive, forwarderPort, ...rest } = this.config;
            return rest as ProxyConfig;
        }
        return this.config;
    }

    public saveConfig(newConfig: Partial<ProxyConfig>) {
        // Strip runtime config before saving to disk
        const { forwarderActive, forwarderPort, ...persistConfig } = { ...this.config, ...newConfig };
        this.config = { ...this.config, ...newConfig };
        
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(persistConfig, null, 2), 'utf8');
            console.log('[ProxyManager] Proxy config saved to disk.');
        } catch (e) {
            console.error('[ProxyManager] Error saving proxy config:', e);
        }
    }

    public needsForwarder(config: ProxyConfig): boolean {
        // We need the local SOCKS5 forwarder only if proxy is SOCKS5 with auth credentials
        return config.enabled && config.type === 'socks5' && !!config.username;
    }

    public async ensureForwarder(): Promise<void> {
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
            } else {
                console.log('[ProxyManager] Starting local Socks5Forwarder...');
                this.forwarder = new Socks5Forwarder(forwarderConfig);
                try {
                    const activePort = await this.forwarder.start(10809);
                    this.config.forwarderActive = true;
                    this.config.forwarderPort = activePort;
                    console.log(`[ProxyManager] Socks5Forwarder active on port ${activePort}`);
                } catch (e) {
                    console.error('[ProxyManager] Failed to start Socks5Forwarder:', e);
                    this.config.forwarderActive = false;
                    this.forwarder = null;
                }
            }
        } else {
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

    public async stopForwarder() {
        if (this.forwarder) {
            await this.forwarder.stop();
            this.forwarder = null;
        }
    }
}
