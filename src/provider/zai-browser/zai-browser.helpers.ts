import { ParsedZaiCredential } from './zai-browser.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ZaiBrowserHelpers');

export const parseZaiBrowserCredential = (credential: string): ParsedZaiCredential | null => {
    // Format: "cookie_string|||user_agent"
    const parts = credential.split('|||');
    if (parts.length < 2) {
        logger.warn(`[ZaiBrowser] Invalid credential format, expected "cookie|||user_agent"`);
        return null;
    }
    return {
        cookie: parts[0],
        userAgent: parts[1],
    };
};

export const extractEmailFromCookie = (cookie: string): string | null => {
    // Try to extract email from cookie
    const match = cookie.match(/email=([^;]+)/);
    if (match) {
        return decodeURIComponent(match[1]);
    }
    return null;
};

export const sanitizeCookieForExtension = (cookie: string): string => {
    // Remove any problematic characters
    return cookie.replace(/\n/g, '').replace(/\r/g, '').trim();
};