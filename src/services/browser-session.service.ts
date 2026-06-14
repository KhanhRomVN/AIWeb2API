import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
    findBrowserSessionById,
    findAllBrowserSessions,
    insertBrowserSession,
    updateBrowserSessionLastUsed,
    deleteBrowserSession,
    BrowserSessionRow,
} from '../repositories/browser-session.repository';
import { createLogger } from '../utils/logger';
import { cdpLoginService } from './login/cdp-login.service';

const logger = createLogger('BrowserSessionService');

export interface CreateBrowserSessionOptions {
    providerId: string;
    email?: string;
    userDataDir?: string;
}

export interface BrowserSession {
    id: string;
    providerId: string;
    email: string | null;
    userDataDir: string | null;
    createdAt: number;
    lastUsedAt: number | null;
}

const toSession = (row: BrowserSessionRow): BrowserSession => ({
    id: row.id,
    providerId: row.provider_id,
    email: row.email,
    userDataDir: row.user_data_dir,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
});

export const createBrowserSession = async (options: CreateBrowserSessionOptions): Promise<BrowserSession> => {
    const id = uuidv4();

    insertBrowserSession({
        id,
        provider_id: options.providerId,
        email: options.email,
        user_data_dir: options.userDataDir,
    });

    logger.info(`[BrowserSession] Created session ${id} for provider ${options.providerId}`);
    return getBrowserSessionById(id)!;
};

export const getBrowserSessionById = (id: string): BrowserSession | null => {
    const row = findBrowserSessionById(id);
    return row ? toSession(row) : null;
};

export const getAllBrowserSessions = (providerId?: string): BrowserSession[] => {
    const rows = findAllBrowserSessions(providerId);
    return rows.map(toSession);
};

export const touchSession = (id: string): void => {
    updateBrowserSessionLastUsed(id);
};

export const deleteBrowserSessionById = (id: string): void => {
    deleteBrowserSession(id);
    logger.info(`[BrowserSession] Deleted session ${id}`);
};

// Login via CDP - create session automatically
export const loginViaCDP = async (providerId: string, loginUrl: string, profileName?: string): Promise<BrowserSession> => {
    logger.info(`[BrowserSession] Starting CDP login for ${providerId} at ${loginUrl}`);

    // Import browserInstanceManager dynamically to avoid circular dependency
    const { browserInstanceManager } = await import('./browser-instance-manager');
    
    const finalProfileName = profileName || 'default';
    const userDataDir = browserInstanceManager.getProfilePath(providerId, finalProfileName);
    
    return new Promise(async (resolve, reject) => {
        let capturedEmail = '';

        const result = await cdpLoginService.login({
            providerId,
            loginUrl,
            timeout: 120000,
            validate: async (captured: any) => {
                if (captured.cookies && captured.cookies.trim()) {
                    capturedEmail = captured.email || '';
                    logger.info(`[BrowserSession] Login successful for ${providerId}`);
                    return { isValid: true, cookies: captured.cookies, email: capturedEmail };
                }
                return { isValid: false };
            },
        });

        if (result.success) {
            const session = await createBrowserSession({
                providerId,
                email: result.email || capturedEmail,
                userDataDir: userDataDir,
            });

            resolve(session);
        } else {
            reject(new Error(result.error || 'CDP login failed'));
        }
    });
};

export const createProfileAndSession = async (
    providerId: string, 
    profileName: string, 
    email?: string
): Promise<BrowserSession> => {
    const { browserInstanceManager } = await import('./browser-instance-manager');
    
    // Create profile directory
    const { id: profileId, userDataDir } = await browserInstanceManager.createProfile(
        providerId, 
        profileName, 
        email
    );
    
    // Create browser session
    const session = await createBrowserSession({
        providerId,
        email: email || null,
        userDataDir: userDataDir,
    });
    
    return session;
};