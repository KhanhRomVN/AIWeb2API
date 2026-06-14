import { Request, Response } from 'express';
import {
    getAllBrowserSessions,
    createBrowserSession,
    deleteBrowserSessionById,
    loginViaCDP,
    touchSession,
} from '../services/browser-session.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('BrowserSessionController');

// GET /v1/browser-sessions
export const listSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const { provider_id } = req.query;
        const sessions = getAllBrowserSessions(provider_id as string);
        res.status(200).json({
            success: true,
            data: sessions,
            meta: { timestamp: new Date().toISOString() },
        });
    } catch (error: any) {
        logger.error('Error listing browser sessions', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list browser sessions',
            error: { code: 'INTERNAL_ERROR', details: error.message },
        });
    }
};

// GET /v1/browser-sessions/active/:providerId - returns most recent session
export const getActiveSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { providerId } = req.params;
        const sessions = getAllBrowserSessions(providerId);
        if (sessions.length === 0) {
            res.status(404).json({
                success: false,
                message: `No browser session found for provider: ${providerId}`,
            });
            return;
        }
        // Return the most recent session
        const session = sessions[0];
        res.status(200).json({
            success: true,
            data: session,
        });
    } catch (error: any) {
        logger.error('Error getting session', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get session',
            error: { code: 'INTERNAL_ERROR', details: error.message },
        });
    }
};

// POST /v1/browser-sessions
export const createSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { provider_id, email, user_data_dir } = req.body;

        if (!provider_id) {
            res.status(400).json({
                success: false,
                message: 'Missing provider_id',
            });
            return;
        }

        if (!user_data_dir) {
            res.status(400).json({
                success: false,
                message: 'Missing user_data_dir',
            });
            return;
        }

        const session = await createBrowserSession({
            providerId: provider_id,
            email,
            userDataDir: user_data_dir,
        });

        res.status(201).json({
            success: true,
            data: session,
        });
    } catch (error: any) {
        logger.error('Error creating browser session', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create browser session',
            error: { code: 'INTERNAL_ERROR', details: error.message },
        });
    }
};

// POST /v1/browser-sessions/login
export const loginSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { provider_id, login_url, profile_name } = req.body;

        if (!provider_id) {
            res.status(400).json({
                success: false,
                message: 'Missing provider_id',
            });
            return;
        }

        const defaultLoginUrls: Record<string, string> = {
            'zai-browser': 'https://chat.z.ai/',
        };
        const loginUrl = login_url || defaultLoginUrls[provider_id];

        if (!loginUrl) {
            res.status(400).json({
                success: false,
                message: `Missing login_url for provider ${provider_id}`,
            });
            return;
        }

        const session = await loginViaCDP(provider_id, loginUrl, profile_name);

        res.status(201).json({
            success: true,
            message: 'Login successful, browser session created',
            data: session,
        });
    } catch (error: any) {
        logger.error('Error during CDP login', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to login via browser',
            error: { code: 'LOGIN_FAILED', details: error.message },
        });
    }
};

// POST /v1/browser-sessions/profile
export const createProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { provider_id, profile_name, email } = req.body;

        if (!provider_id || !profile_name) {
            res.status(400).json({
                success: false,
                message: 'Missing provider_id or profile_name',
            });
            return;
        }

        const session = await createProfileAndSession(provider_id, profile_name, email);

        res.status(201).json({
            success: true,
            message: 'Profile created successfully',
            data: session,
        });
    } catch (error: any) {
        logger.error('Error creating profile', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create profile',
            error: { code: 'INTERNAL_ERROR', details: error.message },
        });
    }
};

// PUT /v1/browser-sessions/:sessionId/activate - Deprecated
export const activateSessionHandler = async (req: Request, res: Response): Promise<void> => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Sessions are managed by user_data_dir only.',
    });
};

// PATCH /v1/browser-sessions/:sessionId - Deprecated
export const updateSession = async (req: Request, res: Response): Promise<void> => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Sessions are immutable except last_used_at.',
    });
};

// DELETE /v1/browser-sessions/:sessionId
export const deleteSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const session = getBrowserSessionById(sessionId);
        if (!session) {
            res.status(404).json({
                success: false,
                message: `Session not found: ${sessionId}`,
            });
            return;
        }

        deleteBrowserSessionById(sessionId);

        res.status(200).json({
            success: true,
            message: `Session ${sessionId} deleted`,
        });
    } catch (error: any) {
        logger.error('Error deleting session', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete session',
            error: { code: 'INTERNAL_ERROR', details: error.message },
        });
    }
};

// POST /v1/browser-sessions/:sessionId/touch
export const touchSessionHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const session = getBrowserSessionById(sessionId);
        if (!session) {
            res.status(404).json({
                success: false,
                message: `Session not found: ${sessionId}`,
            });
            return;
        }

        touchSession(sessionId);

        res.status(200).json({
            success: true,
            message: 'Session touched',
        });
    } catch (error: any) {
        logger.error('Error touching session', error);
        res.status(500).json({
            success: false,
            message: 'Failed to touch session',
            error: { code: 'INTERNAL_ERROR', details: error.message },
        });
    }
};

// Helper imports
import { getBrowserSessionById as getSessionById, createProfileAndSession } from '../services/browser-session.service';
const getBrowserSessionById = getSessionById;