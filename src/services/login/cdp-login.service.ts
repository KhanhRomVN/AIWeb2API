import { EventEmitter } from 'events';
import { createCDPService } from './cdp.service';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CDPLoginService');

export interface CDPLoginOptions {
  providerId: string;
  loginUrl: string;
  partition?: string;
  timeout?: number;
  validate?: (captured: any) => Promise<{ isValid: boolean; cookies?: string; email?: string }>;
  extraEvents?: string[];
  keepBrowserOpen?: boolean;
}

export interface CDPLoginResult {
  success: boolean;
  cookies?: string;
  email?: string;
  error?: string;
}

export class CDPLoginService extends EventEmitter {
  private activeSessions: Map<string, { cdpService: any; browserProcess: any }> = new Map();

  async login(options: CDPLoginOptions): Promise<CDPLoginResult> {
    const { providerId, loginUrl, timeout = 120000, validate, extraEvents = [], keepBrowserOpen = false } = options;
    const sessionId = `${providerId}-${Date.now()}`;

    logger.info(`[CDP Login] Starting login for ${providerId} with URL ${loginUrl}`);

    const cdpService = createCDPService(sessionId);
    let capturedCookies = '';
    let capturedEmail = '';
    let resolvePromise: ((value: CDPLoginResult) => void) | null = null;
    let rejectPromise: ((reason: any) => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const resultPromise = new Promise<CDPLoginResult>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const cleanup = async () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      if (!keepBrowserOpen) {
        await cdpService.close();
      }
      this.activeSessions.delete(sessionId);
    };

    const checkLoginStatus = async () => {
      if (!validate) return;
      try {
        const activeCookies = await cdpService.getCookies();
        const cookiesToValidate = activeCookies || capturedCookies;
        
        if (cookiesToValidate || capturedEmail) {
          const validation = await validate({ cookies: cookiesToValidate, email: capturedEmail });
          if (validation.isValid) {
            logger.info(`[CDP Login] Validation successful for ${providerId}`);
            if (resolvePromise) {
              const res = resolvePromise;
              resolvePromise = null;
              rejectPromise = null;
              await cleanup();
              res({
                success: true,
                cookies: validation.cookies || cookiesToValidate,
                email: validation.email || capturedEmail,
              });
            }
          }
        }
      } catch (e: any) {
        logger.error(`[CDP Login] Error in validation check for ${providerId}:`, e.message);
      }
    };

    // Listen for cookie changes via Network events
    cdpService.on('response', async (response: any) => {
      // Look for Set-Cookie headers
      if (response.headers?.['set-cookie']) {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          capturedCookies += cookies + '; ';
        }
      }
      checkLoginStatus();
    });

    cdpService.on('response-body', async (data: any) => {
      try {
        const body = data.isBinary ? Buffer.from(data.body, 'base64').toString() : data.body;
        const json = JSON.parse(body);
        
        if (json.email) {
          capturedEmail = json.email;
        }
        if (json.user?.email) {
          capturedEmail = json.user.email;
        }
      } catch (e) {
        // Not JSON
      }

      checkLoginStatus();
    });

    cdpService.on('browser-exit', async () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      this.activeSessions.delete(sessionId);
      if (rejectPromise) {
        const rej = rejectPromise;
        resolvePromise = null;
        rejectPromise = null;
        rej({ success: false, error: 'Browser closed unexpectedly' });
      }
    });

    // Launch browser and navigate to login URL
    const launched = await cdpService.launchBrowser(loginUrl);
    if (!launched) {
      return { success: false, error: 'Failed to launch browser' };
    }

    this.activeSessions.set(sessionId, { cdpService, browserProcess: null });

    // Set timeout
    timeoutId = setTimeout(async () => {
      if (resolvePromise) {
        logger.warn(`[CDP Login] Timeout after ${timeout}ms for ${providerId}`);
        const res = resolvePromise;
        resolvePromise = null;
        rejectPromise = null;
        await cleanup();
        res({ success: false, error: `Login timeout after ${timeout}ms` });
      }
    }, timeout);

    // Set up periodic cookie checking
    intervalId = setInterval(checkLoginStatus, 1500);

    // Wait for user to login manually or auto-fill credentials
    logger.info(`[CDP Login] Browser opened at ${loginUrl}. Waiting for login...`);

    return resultPromise;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      await session.cdpService.close();
      this.activeSessions.delete(sessionId);
    }
  }

  async closeAllSessions(): Promise<void> {
    for (const [id, session] of this.activeSessions) {
      await session.cdpService.close();
      this.activeSessions.delete(id);
    }
  }
}

export const cdpLoginService = new CDPLoginService();