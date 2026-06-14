import { Router } from 'express';
import {
    listSessions,
    getActiveSession,
    createSession,
    loginSession,
    createProfile,
    activateSessionHandler,
    updateSession,
    deleteSession,
    touchSessionHandler,
    completeSession,
} from '../../controllers/browser-session.controller';

const router = Router();

// GET /v1/browser-sessions
router.get('/', listSessions);

// GET /v1/browser-sessions/active/:providerId (deprecated, returns most recent)
router.get('/active/:providerId', getActiveSession);

// POST /v1/browser-sessions
router.post('/', createSession);

// POST /v1/browser-sessions/login
router.post('/login', loginSession);

// POST /v1/browser-sessions/profile
router.post('/profile', createProfile);

// POST /v1/browser-sessions/complete/:tempSessionId
router.post('/complete/:tempSessionId', completeSession);

// PUT /v1/browser-sessions/:sessionId/activate (deprecated)
router.put('/:sessionId/activate', activateSessionHandler);

// PATCH /v1/browser-sessions/:sessionId (deprecated)
router.patch('/:sessionId', updateSession);

// POST /v1/browser-sessions/:sessionId/touch
router.post('/:sessionId/touch', touchSessionHandler);

// DELETE /v1/browser-sessions/:sessionId
router.delete('/:sessionId', deleteSession);

export default router;