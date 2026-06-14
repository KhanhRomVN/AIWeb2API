import { getDb } from '../database';
import { createLogger } from '../utils/logger';

const logger = createLogger('BrowserSessionRepository');

export interface BrowserSessionRow {
    id: string;
    provider_id: string;
    email: string | null;
    user_data_dir: string | null;
    created_at: number;
    last_used_at: number | null;
}

export const findBrowserSessionById = (id: string): BrowserSessionRow | null => {
    const db = getDb();
    return (db.prepare('SELECT * FROM browser_sessions WHERE id = ?').get(id) as BrowserSessionRow) ?? null;
};

export const findAllBrowserSessions = (providerId?: string): BrowserSessionRow[] => {
    const db = getDb();
    if (providerId) {
        return db.prepare('SELECT * FROM browser_sessions WHERE provider_id = ? ORDER BY created_at DESC').all(providerId.toLowerCase()) as BrowserSessionRow[];
    }
    return db.prepare('SELECT * FROM browser_sessions ORDER BY created_at DESC').all() as BrowserSessionRow[];
};

export const insertBrowserSession = (session: {
    id: string;
    provider_id: string;
    email?: string | null;
    user_data_dir?: string | null;
    created_at?: number;
}): void => {
    const db = getDb();
    const now = Date.now();
    db.prepare(`
        INSERT INTO browser_sessions (id, provider_id, email, user_data_dir, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        session.id,
        session.provider_id.toLowerCase(),
        session.email || null,
        session.user_data_dir || null,
        session.created_at || now,
        now,
    );
};

export const updateBrowserSessionLastUsed = (id: string): void => {
    const db = getDb();
    db.prepare('UPDATE browser_sessions SET last_used_at = ? WHERE id = ?').run(Date.now(), id);
};

export const deleteBrowserSession = (id: string): void => {
    const db = getDb();
    db.prepare('DELETE FROM browser_sessions WHERE id = ?').run(id);
};