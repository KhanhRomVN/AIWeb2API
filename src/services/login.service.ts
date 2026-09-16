/**
 * ------------------------------------------------------------------
 * Login Service
 * ------------------------------------------------------------------
 * Service login cho các provider sử dụng CDP (Chrome DevTools Protocol)
 * để capture cookies/tokens từ browser.
 *
 * Main functions:
 * - captureCredentialsViaCDP() : Mở browser CDP, chờ đăng nhập, capture cookies/email
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ── Repositories ──
import { findProviderById } from '../repositories/provider.repository';

// ── Services ──
import { createCDPService } from './cdp.service';
import { browserInstanceManager } from './browser-instance-manager';
import { proxyEvents } from './proxy.service';

// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';
// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('LoginService');

// ─── Types ──────────────────────────────────────────────────────────────

export interface LoginOptions {
  providerId: string;
  loginUrl: string;
  partition?: string;
  timeout?: number;
  keepBrowserOpen?: boolean;
  cookieEvent?: string;
  headerEvent?: string;
  infoEvent?: string;
  extraEvents?: string[];
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

export interface ProviderLoginOptions {
  method?: 'basic' | 'google';
}

export interface ProviderLoginResult {
  email?: string;
  cookies?: string;
  headers?: any;
  pending?: boolean;
  tempSessionId?: string;
  user_data_dir?: string;
}

// ─── Class ──────────────────────────────────────────────────────────────

export class LoginService extends EventEmitter {
  private activeSessions: Map<
    string,
    { cdpService: any; browserProcess: any }
  > = new Map();

  async captureCredentialsViaCDP(
    options: LoginOptions,
  ): Promise<{ cookies: string; email?: string; headers?: any }> {
    const {
      providerId,
      loginUrl,
      timeout = 300000,
      validate,
      cookieEvent,
      infoEvent,
    } = options;
    const sessionId = `${providerId}-${Date.now()}`;

    const cdpService = createCDPService(sessionId);
    let capturedCookies = '';
    let capturedEmail = '';
    let resolvePromise:
      | ((value: { cookies: string; email?: string; headers?: any }) => void)
      | null = null;
    let rejectPromise: ((reason: any) => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    // Track mimeTypes to filter JSON responses
    const responseMimeTypes = new Map<string, string>();

    const resultPromise = new Promise<{
      cookies: string;
      email?: string;
      headers?: any;
    }>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Extra fields forwarded from proxy events (e.g. refreshToken, headers)
    let capturedExtra: Record<string, any> = {};

    // Function to check validation and resolve login if valid
    let isValidating = false;
    const checkValidation = async () => {
      if (!validate || (!capturedCookies && !capturedEmail)) return;
      if (!resolvePromise || isValidating) return;

      isValidating = true;
      try {
        const validation = await validate({
          cookies: capturedCookies,
          email: capturedEmail,
          ...capturedExtra,
        });

        if (validation?.isValid && resolvePromise) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          await cdpService.close();
          this.activeSessions.delete(sessionId);

          // Cleanup proxy event listeners
          cleanup();

          const result = {
            cookies: validation.cookies || capturedCookies,
            email: validation.email || capturedEmail,
          };

          const resolve = resolvePromise;
          resolvePromise = null;
          rejectPromise = null;
          resolve(result);
        }
      } catch (validationError: any) {
        logger.error(
          `[LoginService] Validation threw error: ${validationError.message}`,
        );
      } finally {
        isValidating = false;
      }
    };

    // Listen to proxy events for custom cookie/email capture (e.g., DeepSeek, Freebuff)
    const cookieEventListener = async (data: any) => {
      if (typeof data === 'string' && data.length > 0) {
        capturedCookies = data;
      } else if (
        data &&
        typeof data.cookies === 'string' &&
        data.cookies.length > 0
      ) {
        capturedCookies = data.cookies;
      }
      if (data && data.email) {
        capturedEmail = data.email;
      }
      // Forward any extra fields (e.g. refreshToken, headers) to validate
      if (data && typeof data === 'object') {
        const { cookies, email, ...extra } = data;
        if (Object.keys(extra).length > 0) {
          capturedExtra = { ...capturedExtra, ...extra };
        }
      }
      await checkValidation();
    };

    const infoEventListener = async (data: any) => {
      if (data && data.email) {
        capturedEmail = data.email;
      }
      await checkValidation();
    };

    // Register proxy event listeners if events are specified
    if (cookieEvent) {
      proxyEvents.on(cookieEvent, cookieEventListener);
    }
    if (infoEvent) {
      proxyEvents.on(infoEvent, infoEventListener);
    }

    let cookiePollInterval: NodeJS.Timeout | null = null;

    // Cleanup function to remove listeners
    const cleanup = () => {
      if (cookiePollInterval) {
        clearInterval(cookiePollInterval);
        cookiePollInterval = null;
      }
      if (cookieEvent) {
        proxyEvents.off(cookieEvent, cookieEventListener);
      }
      if (infoEvent) {
        proxyEvents.off(infoEvent, infoEventListener);
      }
    };

    // Listen to outgoing requests to capture Cookie headers
    cdpService.on('request', async (req: any) => {
      try {
        const cookieHeader = req.headers?.['Cookie'] || req.headers?.['cookie'];
        if (
          cookieHeader &&
          typeof cookieHeader === 'string' &&
          cookieHeader.length > 0
        ) {
          let host = '';
          try {
            host = new URL(loginUrl).host;
          } catch {}

          if (!host || (req.url && req.url.includes(host))) {
            if (
              !capturedCookies ||
              capturedCookies.length < cookieHeader.length
            ) {
              capturedCookies = cookieHeader;
              await checkValidation();
            }
          }
        }
      } catch {}
    });

    cdpService.on('response', async (response: any) => {
      // Store mimeType for later use
      if (response.id && response.mimeType) {
        responseMimeTypes.set(response.id, response.mimeType);
      }

      if (response.headers?.['set-cookie']) {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          capturedCookies += cookies + '; ';
          await checkValidation();
        }
      }
    });

    cdpService.on('response-body', async (data: any) => {
      // Only try to parse if mimeType indicates JSON
      const mimeType = responseMimeTypes.get(data.id) || '';
      const isJson =
        mimeType.includes('application/json') || mimeType.includes('text/json');

      if (!isJson) {
        return; // Skip non-JSON responses silently
      }

      try {
        const body = data.isBinary
          ? Buffer.from(data.body, 'base64').toString()
          : data.body;

        const json = JSON.parse(body);

        // Extract email from various JSON structures
        if (json.email) {
          capturedEmail = json.email;
        }
        if (json.user?.email) {
          capturedEmail = json.user.email;
        }
        if (json.data?.biz_data?.user?.email) {
          capturedEmail = json.data.biz_data.user.email;
        }

        // Extract tokens from various JSON structures (for DeepSeek and similar providers)
        if (json.data?.biz_data?.user?.token) {
          const token = json.data.biz_data.user.token;
          capturedCookies = token;

          // Also capture email from same structure if available
          if (json.data.biz_data.user.email && !capturedEmail) {
            capturedEmail = json.data.biz_data.user.email;
          }
        }

        // Check for common auth token fields in JSON root
        // Always override with JWT token — takes priority over browser cookies
        const tokenFields = [
          'token',
          'access_token',
          'accessToken',
          'authToken',
          'auth_token',
          'jwt',
          'DS-AUTH-TOKEN',
        ];
        for (const field of tokenFields) {
          const val = json[field] || json.data?.[field];
          if (val && typeof val === 'string' && val.startsWith('eyJ')) {
            // JWT token — always override browser cookies
            capturedCookies = val;
            break;
          }
          if (val && typeof val === 'string' && !capturedCookies) {
            capturedCookies = val;
          }
          if (
            json.data?.[field] &&
            typeof json.data[field] === 'string' &&
            !capturedCookies
          ) {
            capturedCookies = json.data[field];
          }
        }

        // Extract refreshToken if present and forward as extra field
        const refreshTokenVal =
          json['refreshToken'] ||
          json['refresh_token'] ||
          json.data?.['refreshToken'] ||
          json.data?.['refresh_token'];
        if (refreshTokenVal && typeof refreshTokenVal === 'string') {
          capturedExtra = { ...capturedExtra, refreshToken: refreshTokenVal };
        }
      } catch (e) {}

      await checkValidation();
    });

    cdpService.on('browser-exit', () => {
      logger.warn(
        `[LoginService] Browser exit event triggered for ${providerId}`,
      );

      if (rejectPromise) {
        logger.error(
          `[LoginService] Browser closed unexpectedly for ${providerId}`,
        );

        // Cleanup proxy event listeners
        cleanup();

        const error = new Error('Browser closed unexpectedly');
        (error as any).code = 'BROWSER_CLOSED';
        rejectPromise(error);

        // Clear references
        resolvePromise = null;
        rejectPromise = null;
      }
    });

    const launched = await cdpService.launchBrowser(loginUrl);

    if (!launched) {
      logger.error(`[LoginService] Failed to launch browser for ${providerId}`);
      return { cookies: '', email: undefined };
    }

    this.activeSessions.set(sessionId, { cdpService, browserProcess: null });

    // Periodically query browser cookies & evaluate session via CDP
    cookiePollInterval = setInterval(async () => {
      if (!resolvePromise) {
        if (cookiePollInterval) {
          clearInterval(cookiePollInterval);
          cookiePollInterval = null;
        }
        return;
      }

      try {
        // 1. Try evaluating /api/auth/session inside the active browser page
        const evalResult = await cdpService.evaluate(`
          (async () => {
            try {
              const res = await window.fetch('/api/auth/session');
              if (res.ok) {
                const data = await res.json();
                if (data && data.user && data.user.email) {
                  return { loggedIn: true, user: data.user };
                }
              }
            } catch (e) {}
            return null;
          })()
        `);

        // 2. Query all browser cookies across Freebuff domains
        const browserCookies = await cdpService.getAllCookies();
        if (browserCookies && browserCookies.length > 0) {
          const cookieStr = browserCookies
            .map((c: any) => `${c.name}=${c.value}`)
            .join('; ');

          if (cookieStr.length > 10) {
            capturedCookies = cookieStr;
            if (evalResult?.loggedIn && evalResult?.user?.email) {
              capturedEmail = evalResult.user.email;
            }
            await checkValidation();
          }
        }
      } catch {}
    }, 1200);

    timeoutId = setTimeout(async () => {
      logger.warn(
        `[LoginService] Timeout triggered after ${timeout}ms for ${providerId}`,
      );

      if (resolvePromise) {
        await cdpService.close();
        this.activeSessions.delete(sessionId);

        // Cleanup proxy event listeners
        cleanup();

        resolvePromise({
          cookies: capturedCookies,
          email: capturedEmail || undefined,
        });

        // Clear references
        resolvePromise = null;
        rejectPromise = null;
      }
    }, timeout);

    return resultPromise;
  }

  async captureBrowserProfileViaCDP(
    providerId: string,
    loginUrl: string,
    profileName?: string,
  ): Promise<{ user_data_dir: string }> {
    const provider = findProviderById(providerId);
    let extensionPath: string | null = null;

    if (provider?.browser_extension_folder) {
      extensionPath = path.join(
        __dirname,
        '../../extensions',
        provider.browser_extension_folder,
      );
    }

    const tempSessionId = uuidv4();
    const tempDir = path.join(
      os.homedir(),
      '.aiweb2api',
      'temp',
      tempSessionId,
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const cdpService = createCDPService(`${providerId}-${tempSessionId}`);

    let capturedEmail = '';
    cdpService.on('response', (response: any) => {
      if (!capturedEmail && response?.body) {
        try {
          const json = JSON.parse(response.body);
          const email =
            json.email || json.user?.email || json.data?.biz_data?.user?.email;
          if (email) capturedEmail = email;
        } catch {
          // ignore non-JSON body
        }
      }
    });

    const launched = await cdpService.launchBrowser(
      loginUrl,
      tempDir,
      extensionPath || undefined,
    );
    if (!launched) {
      logger.error(`[LoginService] Failed to launch browser for ${providerId}`);
      throw new Error('Failed to launch browser');
    }

    return new Promise<{ user_data_dir: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cdpService.close().catch((e: any) => {
          logger.warn(
            '[LoginService] Failed to close CDP service after timeout:',
            e,
          );
        });
        logger.error(
          `[LoginService] Browser session timeout for ${providerId}`,
        );
        reject(new Error('Browser session timeout'));
      }, 600000);

      cdpService.on('browser-exit', () => {
        clearTimeout(timeout);

        const finalProfileName = capturedEmail || `profile_${Date.now()}`;
        const finalUserDataDir = browserInstanceManager.getProfilePath(
          providerId,
          finalProfileName,
        );

        const finalDir = path.dirname(finalUserDataDir);
        if (!fs.existsSync(finalDir)) {
          fs.mkdirSync(finalDir, { recursive: true });
        }

        if (fs.existsSync(tempDir)) {
          fs.renameSync(tempDir, finalUserDataDir);
        }

        resolve({ user_data_dir: finalUserDataDir });
      });
    });
  }
}

/**
 * Login qua provider
 */
export async function loginWithProvider(
  providerId: string,
  options: ProviderLoginOptions,
): Promise<ProviderLoginResult> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  if (!provider.login) {
    throw new Error(`Provider ${providerId} does not support browser login`);
  }

  const result = await provider.login({
    method: options.method || 'basic',
  });

  return result as ProviderLoginResult;
}

export const loginService = new LoginService();
