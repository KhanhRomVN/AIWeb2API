import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { createCDPService } from './login/cdp.service';
import { browserInstanceManager } from './browser-instance-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  insertAccount,
  findAccountById,
  updateAccountCredential,
  updateAccountUserDataDir,
} from '../repositories/account.repository';
import { ensureProviderExists } from '../repositories/provider.repository';

const logger = createLogger('BrowserSessionService');

// Store pending sessions waiting for email
interface PendingSession {
  tempDir: string;
  providerId: string;
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

const pendingSessions = new Map<string, PendingSession>();

const getTempDir = (): string => {
  return path.join(os.homedir(), '.elara', 'temp');
};

// Login via CDP - open browser, wait for close, then ask for email
export const loginViaCDP = async (
  providerId: string,
  loginUrl: string,
  profileName?: string,
): Promise<{ pending: boolean; tempSessionId: string }> => {
  logger.info(
    `[BrowserSession] Starting browser session for ${providerId} at ${loginUrl}`,
  );

  // Create temp directory for this session
  const tempSessionId = uuidv4();
  const tempDir = path.join(getTempDir(), tempSessionId);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Launch browser with temp profile
  const cdpService = createCDPService(`${providerId}-${tempSessionId}`);
  
  // Launch browser with temp user data dir
  const launched = await cdpService.launchBrowser(loginUrl, tempDir);
  if (!launched) {
    throw new Error('Failed to launch browser');
  }
  
  logger.info(`[BrowserSession] Browser launched for ${providerId}, temp dir: ${tempDir}`);
  
  // Return a promise that waits for browser close
  return new Promise<{ pending: boolean; tempSessionId: string }>((resolve, reject) => {
    // Set timeout for browser session (e.g., 10 minutes)
    const timeout = setTimeout(() => {
      if (pendingSessions.has(tempSessionId)) {
        pendingSessions.delete(tempSessionId);
        cdpService.close().catch(() => {});
        reject(new Error('Browser session timeout'));
      }
    }, 600000); // 10 minutes

    // Store pending session info
    pendingSessions.set(tempSessionId, {
      tempDir,
      providerId,
      resolve: (value: any) => resolve(value),
      reject,
      timeout,
    });

    // Listen for browser close - then resolve the promise
    cdpService.on('browser-exit', () => {
      logger.info(`[BrowserSession] Browser closed for ${providerId}, returning pending info`);
      clearTimeout(timeout);
      resolve({ pending: true, tempSessionId });
    });
  });
};

// Complete a pending session with email
export const completePendingSession = async (
  tempSessionId: string,
  email: string,
): Promise<any> => {
  const pending = pendingSessions.get(tempSessionId);
  if (!pending) {
    throw new Error(`Pending session not found: ${tempSessionId}`);
  }

  clearTimeout(pending.timeout);
  pendingSessions.delete(tempSessionId);

  // Move temp directory to final profile location
  const finalProfileName = `profile_${Date.now()}`;
  const finalUserDataDir = browserInstanceManager.getProfilePath(
    pending.providerId,
    finalProfileName,
  );

  // Ensure parent directory exists
  const finalDir = path.dirname(finalUserDataDir);
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  // Move temp directory to final location
  if (fs.existsSync(pending.tempDir)) {
    fs.renameSync(pending.tempDir, finalUserDataDir);
    logger.info(`[BrowserSession] Moved temp profile to: ${finalUserDataDir}`);
  }

  // Create account record (credential is null for browser-based accounts)
  const accountId = uuidv4();
  insertAccount({
    id: accountId,
    provider_id: pending.providerId,
    email: email,
    credential: null, // Browser accounts don't have credentials
    user_data_dir: finalUserDataDir,
  });
  
  ensureProviderExists(pending.providerId.toLowerCase(), pending.providerId);

  const account = findAccountById(accountId);
  
  pending.resolve(account);
  return account;
};