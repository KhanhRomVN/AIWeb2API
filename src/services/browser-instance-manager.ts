import * as fs from 'fs';
import * as path from 'os';
import { createLogger } from '../utils/logger';
import { createCDPService } from './login/cdp.service';
import { EventEmitter } from 'events';

const logger = createLogger('BrowserInstanceManager');

export interface BrowserInstance {
    id: string;
    providerId: string;
    profileName: string;
    userDataDir: string;
    cdpService: any;
    isActive: boolean;
    createdAt: number;
    lastUsedAt: number;
}

const ELARA_DATA_DIR = `${process.env.HOME}/.khanhromvn-elara-server`;
const PROFILES_DIR = `${ELARA_DATA_DIR}/profiles`;

class BrowserInstanceManager extends EventEmitter {
    private instances: Map<string, BrowserInstance> = new Map();

    constructor() {
        super();
        this.ensureDirectories();
    }

    private ensureDirectories(): void {
        if (!fs.existsSync(ELARA_DATA_DIR)) {
            fs.mkdirSync(ELARA_DATA_DIR, { recursive: true });
            logger.info(`[BrowserInstance] Created data dir: ${ELARA_DATA_DIR}`);
        }
        if (!fs.existsSync(PROFILES_DIR)) {
            fs.mkdirSync(PROFILES_DIR, { recursive: true });
            logger.info(`[BrowserInstance] Created profiles dir: ${PROFILES_DIR}`);
        }
    }

    getProfilePath(providerId: string, profileName: string): string {
        // Sanitize profile name
        const safeName = profileName.replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${PROFILES_DIR}/${providerId}_${safeName}`;
    }

    async createProfile(providerId: string, profileName: string, email?: string): Promise<{ id: string; userDataDir: string }> {
        const userDataDir = this.getProfilePath(providerId, profileName);
        const id = `${providerId}_${profileName}_${Date.now()}`;

        // Create directory if not exists
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        logger.info(`[BrowserInstance] Created profile: ${id} at ${userDataDir}`);
        
        // Store profile info in a metadata file
        const metadataPath = `${userDataDir}/.elara-profile.json`;
        const metadata = {
            id,
            providerId,
            profileName,
            email: email || null,
            createdAt: Date.now(),
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return { id, userDataDir };
    }

    async launchInstance(profileId: string, providerId: string, profileName: string, loginUrl: string): Promise<BrowserInstance> {
        const userDataDir = this.getProfilePath(providerId, profileName);
        
        // Check if instance already exists and is alive
        const existing = this.instances.get(profileId);
        if (existing && existing.isActive && existing.cdpService?.isConnectedToBrowser()) {
            logger.info(`[BrowserInstance] Reusing existing instance: ${profileId}`);
            existing.lastUsedAt = Date.now();
            return existing;
        }

        // Create new instance
        const cdpService = createCDPService(profileId);
        
        // Launch browser with persistent user data dir
        const launched = await cdpService.launchBrowser(loginUrl, userDataDir);
        if (!launched) {
            throw new Error(`Failed to launch browser for profile ${profileId}`);
        }

        const instance: BrowserInstance = {
            id: profileId,
            providerId,
            profileName,
            userDataDir,
            cdpService,
            isActive: true,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
        };

        this.instances.set(profileId, instance);

        // Handle browser exit
        cdpService.on('browser-exit', () => {
            logger.warn(`[BrowserInstance] Browser exited for ${profileId}`);
            instance.isActive = false;
            this.instances.delete(profileId);
            this.emit('instance-exit', { profileId });
        });

        logger.info(`[BrowserInstance] Launched instance ${profileId} with user data dir ${userDataDir}`);
        return instance;
    }

    async getInstance(profileId: string): Promise<BrowserInstance | null> {
        const instance = this.instances.get(profileId);
        if (instance && instance.isActive && instance.cdpService?.isConnectedToBrowser()) {
            instance.lastUsedAt = Date.now();
            return instance;
        }
        return null;
    }

    async closeInstance(profileId: string): Promise<void> {
        const instance = this.instances.get(profileId);
        if (instance) {
            await instance.cdpService.close();
            this.instances.delete(profileId);
            logger.info(`[BrowserInstance] Closed instance ${profileId}`);
        }
    }

    async closeAllInstances(): Promise<void> {
        for (const [id, instance] of this.instances) {
            await instance.cdpService.close();
            this.instances.delete(id);
        }
        logger.info('[BrowserInstance] Closed all instances');
    }

    listInstances(): BrowserInstance[] {
        return Array.from(this.instances.values());
    }

    async ensureExtensionLoaded(profileId: string, extensionPath: string): Promise<void> {
        const instance = await this.getInstance(profileId);
        if (!instance) {
            throw new Error(`Instance ${profileId} not found or not active`);
        }
        // Extension is loaded via browser args, no additional action needed
        // But we can check if extension is ready by waiting for a specific condition
        logger.info(`[BrowserInstance] Extension path ${extensionPath} should be loaded for ${profileId}`);
    }
}

export const browserInstanceManager = new BrowserInstanceManager();