import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../utils/logger';
import { proxyService } from './proxy.service';
import { proxyEvents } from './proxy-events';

const logger = createLogger('LoginService');

interface LoginOptions {
  providerId: string;
  loginUrl: string;
  partition: string;
  cookieEvent?: string;
  headerEvent?: string;
  infoEvent?: string;
  extraEvents?: string[]; // Additional provider-specific events
  skipProxy?: boolean;
  validate?: (data: {
    cookies: string;
    headers?: any;
    email?: string;
  }) => Promise<{
    isValid: boolean;
    email?: string | null;
    cookies?: string;
    headers?: any;
  }>;
}

const getUserDataPath = () => {
  try {
    // In Tauri sidecar, we don't have electron. Falling back to .elara
    return path.join(os.homedir(), '.elara');
  } catch (e) {
    return path.join(os.tmpdir(), 'elara-login');
  }
};

export class LoginService {
  private activeProcesses: Map<string, ChildProcess> = new Map();

  private findChrome(): string | null {
    const commonPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) return p;
    }

    try {
      const output = execSync('which google-chrome || which chromium', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      if (output.trim()) return output.trim();
    } catch (e) {
      // ignore
    }

    return null;
  }

  async login(
    options: LoginOptions,
  ): Promise<{ cookies: string; email?: string; headers?: any }> {
    const chromePath = this.findChrome();
    if (!chromePath) {
      throw new Error('Chrome or Chromium not found. Please install it.');
    }

    const profileFolderName = options.partition.replace('persist:', '');
    const userDataPath = getUserDataPath();
    const profilePath = path.join(userDataPath, 'profiles', profileFolderName);

    // Cleanup profile for fresh login
    try {
      if (fs.existsSync(profilePath)) {
        logger.info(`Cleaning profile: ${profilePath}`);
        fs.rmSync(profilePath, { recursive: true, force: true });
      }
    } catch (e) {
      logger.error('Failed to clean profile:', e);
    }

    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    // Ensure proxy is running
    await proxyService.start();

    const proxyConfig = proxyService.getConfig();
    const proxyUrl = `127.0.0.1:${proxyConfig.port}`;

    const args = [
      '--ignore-certificate-errors',
      `--user-data-dir=${profilePath}`,
      '--disable-http2',
      '--disable-quic',
      '--no-first-run',
      '--no-default-browser-check',
      `--class=${options.providerId.toLowerCase()}-browser`,
      options.loginUrl,
    ];

    if (!options.skipProxy) {
      args.unshift(
        `--proxy-server=http=${proxyUrl};https=${proxyUrl}`,
        '--proxy-bypass-list=localhost,127.0.0.1',
      );
    }

    logger.info(`Spawning Chrome for ${options.providerId}...`);
    const chromeProcess = spawn(chromePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.activeProcesses.set(options.providerId, chromeProcess);

    return new Promise((resolve, reject) => {
      let resolved = false;
      let capturedCookies = '';
      let capturedEmail = '';
      let capturedHeaders = {};

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          try {
            chromeProcess.kill();
          } catch (e) {}
          this.activeProcesses.delete(options.providerId);

          if (options.cookieEvent)
            proxyEvents.off(options.cookieEvent, onCookie);
          if (options.headerEvent)
            proxyEvents.off(options.headerEvent, onHeader);
          if (options.infoEvent) proxyEvents.off(options.infoEvent, onInfo);

          // Remove extra event listeners
          if (options.extraEvents) {
            for (const eventName of options.extraEvents) {
              proxyEvents.off(eventName, onExtraEvent);
            }
          }
        }
      };

      const resolveIfReady = async () => {
        if (capturedCookies && !resolved) {
          // Special handling for Qwen: wait for real bxUa and bxUmidToken headers (not fallback)
          if (options.providerId === 'qwen') {
            const hasBxUa = (capturedHeaders as any)['bx-ua'];
            const hasBxUmidToken = (capturedHeaders as any)['bx-umidtoken'];
            
            // Check if headers exist and are real (starts with 231!, not fallback)
            const isRealBxUa = hasBxUa && 
              typeof hasBxUa === 'string' && 
              hasBxUa.startsWith('231!') && 
              hasBxUa.length > 100 &&
              !hasBxUa.includes('defaultFY');
              
            const isRealBxUmidToken = hasBxUmidToken && 
              typeof hasBxUmidToken === 'string' && 
              hasBxUmidToken.length > 50 && 
              !hasBxUmidToken.includes('defaultFY');
            
            logger.debug(`[Login] Qwen headers status - bxUa: ${!!hasBxUa} (real: ${isRealBxUa}, len: ${hasBxUa?.length || 0}), bxUmidToken: ${!!hasBxUmidToken} (real: ${isRealBxUmidToken}, len: ${hasBxUmidToken?.length || 0})`);
            
            if (!isRealBxUa || !isRealBxUmidToken) {
              logger.debug(`[Login] ⏳ Waiting for real Qwen headers - need real bxUa and bxUmidToken`);
              return; // Don't resolve yet, wait for real headers from /api/v2/chats/ request
            }
            logger.info(`[Login] ✅ Qwen real headers ready - bxUa length: ${hasBxUa?.length}, bxUmidToken length: ${hasBxUmidToken?.length}`);
            logger.debug(`[Login] bxUa preview: ${hasBxUa?.substring(0, 50)}...`);
            logger.debug(`[Login] bxUmidToken preview: ${hasBxUmidToken?.substring(0, 30)}...`);
          }
          
          if (options.validate) {
            try {
              const result = await options.validate({
                cookies: capturedCookies,
                headers: capturedHeaders,
                email: capturedEmail,
              });
              if (result.isValid) {
                logger.info(`Validation success for ${options.providerId}`);
                cleanup();
                resolve({
                  cookies: result.cookies || capturedCookies,
                  email: result.email || capturedEmail,
                  headers: result.headers || capturedHeaders,
                });
              }
            } catch (e) {
              logger.error(`Validation failed for ${options.providerId}:`, e);
            }
          } else {
            cleanup();
            resolve({
              cookies: capturedCookies,
              email: capturedEmail,
              headers: capturedHeaders,
            });
          }
        }
      };

      const onCookie = (data: any) => {
        if (typeof data === 'string') capturedCookies = data;
        else if (data && data.cookies) capturedCookies = data.cookies;

        if (data && data.email) capturedEmail = data.email;
        resolveIfReady();
      };

      const onHeader = (data: any) => {
        capturedHeaders = { ...capturedHeaders, ...data };
        resolveIfReady();
      };

      const onInfo = (data: any) => {
        if (data && data.email) capturedEmail = data.email;
        // Maybe merge metadata too if needed
        resolveIfReady();
      };

      const onExtraEvent = (data: any) => {
        // Handle extra events (provider-specific)
        if (typeof data === 'string') {
          capturedCookies = data;
        } else if (data) {
          if (data.email) capturedEmail = data.email;
          if (data.cookies) capturedCookies = data.cookies;
          // Bridge any other data into headers or info
          capturedHeaders = { ...capturedHeaders, ...data };
        }
        resolveIfReady();
      };

      if (options.cookieEvent) proxyEvents.on(options.cookieEvent, onCookie);
      if (options.headerEvent) proxyEvents.on(options.headerEvent, onHeader);
      if (options.infoEvent) proxyEvents.on(options.infoEvent, onInfo);

      // Register extra event listeners
      if (options.extraEvents) {
        for (const eventName of options.extraEvents) {
          proxyEvents.on(eventName, onExtraEvent);
        }
      }

      // Timeout 5 mins
      setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error('Login timed out'));
        }
      }, 300000);

      chromeProcess.on('close', () => {
        if (!resolved) {
          cleanup();
          reject(new Error('User closed login window'));
        }
      });
    });
  }

  cancelLogin(providerId: string) {
    const process = this.activeProcesses.get(providerId);
    if (process) {
      process.kill();
      this.activeProcesses.delete(providerId);
    }
  }
}

export const loginService = new LoginService();
