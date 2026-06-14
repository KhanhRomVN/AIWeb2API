import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import * as fs from 'fs';

const logger = createLogger('BrowserInstanceManager');

// Track running browser processes by user data dir
const runningBrowsers = new Map<string, ChildProcess>();

const getUserDataPath = () => {
    try {
        return path.join(os.homedir(), '.elara');
    } catch (e) {
        return path.join(os.tmpdir(), 'elara-browser');
    }
};

const findChrome = (): string | null => {
    const commonPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
    }

    try {
        const { execSync } = require('child_process');
        const output = execSync('which google-chrome || which chromium', {
            encoding: 'utf-8',
            stdio: 'pipe',
        });
        if (output.trim()) return output.trim();
    } catch (e) {
        // ignore
    }

    return null;
};

export const getBrowserStatus = async (userDataDir: string): Promise<{ isRunning: boolean }> => {
    logger.info(`[BrowserInstanceManager] getBrowserStatus called for ${userDataDir}`);
    logger.info(`[BrowserInstanceManager] runningBrowsers Map size: ${runningBrowsers.size}`);
    logger.info(`[BrowserInstanceManager] runningBrowsers keys: ${Array.from(runningBrowsers.keys()).join(', ')}`);
    
    // Normalize path to avoid trailing slash issues
    const normalizedKey = userDataDir.replace(/\/$/, '');
    const process = runningBrowsers.get(normalizedKey);
    
    if (process && !process.killed) {
        // Check if process is still alive
        try {
            process.kill(0); // Signal 0 doesn't kill, just checks
            logger.info(`[BrowserInstanceManager] Process ${process.pid} is running`);
            return { isRunning: true };
        } catch (e) {
            logger.info(`[BrowserInstanceManager] Process ${process.pid} is dead, removing from Map`);
            runningBrowsers.delete(normalizedKey);
            return { isRunning: false };
        }
    }
    
    // Also try to find by partial match (in case of different normalization)
    for (const [key, proc] of runningBrowsers.entries()) {
        if (key.includes(userDataDir) || userDataDir.includes(key)) {
            logger.info(`[BrowserInstanceManager] Found partial match: key="${key}" vs query="${userDataDir}"`);
            try {
                proc.kill(0);
                logger.info(`[BrowserInstanceManager] Process ${proc.pid} is running (partial match)`);
                return { isRunning: true };
            } catch (e) {
                runningBrowsers.delete(key);
                break;
            }
        }
    }
    
    logger.info(`[BrowserInstanceManager] No process found for ${userDataDir}`);
    return { isRunning: false };
};

export const startBrowserForAccount = async (
    userDataDir: string,
    providerId: string,
    loginUrl: string = 'https://chat.z.ai/',
    extensionPath?: string,
): Promise<{ pid: number; userDataDir: string }> => {
    // Check if already running
    const status = await getBrowserStatus(userDataDir);
    if (status.isRunning) {
        logger.info(`[BrowserInstanceManager] Browser already running for ${userDataDir}`);
        return { pid: -1, userDataDir };
    }

    const chromePath = findChrome();
    if (!chromePath) {
        throw new Error('Chrome or Chromium not found. Please install it.');
    }

    // Ensure directory exists
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }

    const args = [
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        loginUrl,
    ];

    // Add extension arguments if extensionPath is provided
    if (extensionPath) {
        args.push(`--disable-extensions-except=${extensionPath}`);
        args.push(`--load-extension=${extensionPath}`);
        logger.info(`[BrowserInstanceManager] Loading extension from: ${extensionPath}`);
    } else {
        args.push('--disable-extensions');
        logger.info(`[BrowserInstanceManager] No extension provided, disabling all extensions`);
    }

    logger.info(`[BrowserInstanceManager] Launching browser for ${providerId} with profile: ${userDataDir}`);
    logger.info(`[BrowserInstanceManager] Browser args: ${args.join(' ')}`);
    
    const chromeProcess = spawn(chromePath, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    runningBrowsers.set(userDataDir, chromeProcess);

    chromeProcess.on('exit', (code, signal) => {
        logger.info(`[BrowserInstanceManager] Browser exited for ${userDataDir} with code: ${code}, signal: ${signal}`);
        runningBrowsers.delete(userDataDir);
    });

    chromeProcess.on('error', (err) => {
        logger.error(`[BrowserInstanceManager] Browser error for ${userDataDir}:`, err);
        runningBrowsers.delete(userDataDir);
    });

    return { pid: chromeProcess.pid!, userDataDir };
};

export const browserInstanceManager = {
    getProfilePath: (providerId: string, profileName: string): string => {
        const basePath = getUserDataPath();
        const profilePath = path.join(basePath, 'profiles', providerId, profileName);
        logger.info(`[BrowserInstanceManager] Profile path for ${providerId}/${profileName}: ${profilePath}`);
        return profilePath;
    },
    
    createProfile: async (providerId: string, profileName: string, email?: string): Promise<{ id: string; userDataDir: string }> => {
        const profilePath = browserInstanceManager.getProfilePath(providerId, profileName);
        
        if (!fs.existsSync(profilePath)) {
            fs.mkdirSync(profilePath, { recursive: true });
            logger.info(`[BrowserInstanceManager] Created profile directory: ${profilePath}`);
        }
        
        return {
            id: `${providerId}_${profileName}_${Date.now()}`,
            userDataDir: profilePath,
        };
    },
};