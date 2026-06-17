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

const findBrowser = (): string | null => {
    // Priority: Google Chrome (works best, no snap issues), then Firefox, then Chromium
    const commonPaths = [
        '/usr/bin/google-chrome',      // Google Chrome (primary)
        '/usr/bin/google-chrome-stable',
        '/usr/bin/firefox',           // Non-snap Firefox (apt)
        '/usr/bin/chromium-browser',   // Non-snap Chromium (apt, older Ubuntu)
        '/usr/bin/chromium',           // Non-snap Chromium (apt, newer Ubuntu)
        '/snap/bin/firefox',           // Snap Firefox (fallback)
        '/snap/bin/chromium',          // Snap Chromium (fallback)
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            // Skip snap versions if non-snap is available (already prioritized)
            logger.info(`[BrowserInstanceManager] Found browser at: ${p}`);
            return p;
        }
    }

    try {
        const { execSync } = require('child_process');
        // Try firefox first, then chromium, then google-chrome
        let output = execSync('which firefox', { encoding: 'utf-8', stdio: 'pipe' });
        if (!output.trim()) {
            output = execSync('which chromium', { encoding: 'utf-8', stdio: 'pipe' });
        }
        if (!output.trim()) {
            output = execSync('which google-chrome', { encoding: 'utf-8', stdio: 'pipe' });
        }
        if (output.trim()) return output.trim();
    } catch (e) {
        // ignore
    }

    return null;
};

// Keep alias for backward compatibility
const findChrome = findBrowser;

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

    let browserPath = findBrowser();
    if (!browserPath) {
        throw new Error('No browser found. Please install Firefox, Chromium, or Google Chrome.');
    }
    
    const isFirefox = browserPath.includes('firefox');
    const isGoogleChrome = browserPath.includes('google-chrome') || browserPath.includes('Google Chrome');
    const isChromiumSnap = browserPath.includes('/snap/') || browserPath.includes('chromium-browser') === false && browserPath.includes('chromium');
    // Simplified: if it's not firefox, not google-chrome, and contains chromium, assume it's chromium
    const isChromium = browserPath.includes('chromium') && !isGoogleChrome;

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
        if (isFirefox) {
            // Firefox supports --load-extension directly
            args.push(`--load-extension=${extensionPath}`);
            // Add --new-window to ensure clean start
            if (!args.includes('--new-window')) {
                args.unshift('--new-window');
            }
            logger.info(`[BrowserInstanceManager] Loading extension in Firefox from: ${extensionPath}`);
        } else {
            // For Chrome/Chromium: rely on manually installed extension in profile
            // Do NOT use --load-extension flag (blocked in official Chrome)
            logger.info(`[BrowserInstanceManager] Using Chrome/Chromium with manually installed extension.`);
            logger.info(`[BrowserInstanceManager] Ensure extension is installed at: chrome://extensions (Developer mode -> Load unpacked) -> ${extensionPath}`);
        }
    } else {
        if (!isFirefox) {
            args.push('--disable-extensions');
        }
        logger.info(`[BrowserInstanceManager] No extension provided, disabling all extensions`);
    }

    logger.info(`[BrowserInstanceManager] Launching browser for ${providerId} with profile: ${userDataDir}`);
    logger.info(`[BrowserInstanceManager] Browser args: ${args.join(' ')}`);
    
    // Add logging flags to capture extension errors
    const loggingArgs = [...args];
    if (!loggingArgs.includes('--enable-logging')) {
        loggingArgs.push('--enable-logging=stderr');
    }
    if (!loggingArgs.includes('--v=1')) {
        loggingArgs.push('--v=1');
    }
    
    const chromeProcess = spawn(browserPath, loggingArgs, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    runningBrowsers.set(userDataDir, chromeProcess);

    // Capture stderr for extension loading errors
    chromeProcess.stderr.on('data', (data) => {
        const output = data.toString();
        // Log only relevant lines to avoid flooding
        if (output.includes('extension') || output.includes('Extension') || 
            output.includes('manifest') || output.includes('CRX') ||
            output.includes('Failed to load') || output.includes('error')) {
            logger.info(`[BrowserInstanceManager] Chrome stderr: ${output.trim()}`);
        } else if (process.env.DEBUG_CHROME === 'true') {
            logger.debug(`[BrowserInstanceManager] Chrome stderr: ${output.trim()}`);
        }
    });

    chromeProcess.stdout.on('data', (data) => {
        if (process.env.DEBUG_CHROME === 'true') {
            logger.debug(`[BrowserInstanceManager] Chrome stdout: ${data.toString().trim()}`);
        }
    });

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