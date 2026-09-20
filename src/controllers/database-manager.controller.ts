/**
 * ------------------------------------------------------------------
 * Database Manager Controller
 * ------------------------------------------------------------------
 * Endpoint CRUD + test connection cho database manager.
 *
 * Main handlers:
 * - listManagersHandler()    : GET    /v1/database-managers
 * - createManagerHandler()   : POST   /v1/database-managers
 * - updateManagerHandler()   : PUT    /v1/database-managers/:id
 * - deleteManagerHandler()   : DELETE /v1/database-managers/:id
 * - testManagerHandler()     : POST   /v1/database-managers/test
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import {
  listDatabaseManagers,
  createDatabaseManager,
  updateDatabaseManager,
  deleteDatabaseManager,
  testDatabaseManager,
} from '../services/database-manager.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

const logger = createLogger('DatabaseManagerController');

// ─── Handlers ───────────────────────────────────────────────────────────

// ─── GET /v1/database-managers ──────────────────────────────────────
export const listManagersHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const rows = listDatabaseManagers();
    res.status(200).json({
      success: true,
      data: rows,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('Error listing database managers', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list database managers',
      error: { code: 'INTERNAL_ERROR', details: error.message },
    });
  }
};

// ─── POST /v1/database-managers ─────────────────────────────────────
export const createManagerHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await createDatabaseManager(req.body || {});
    if (result.error) {
      res.status(result.status).json({
        success: false,
        message: result.error,
        error: { code: 'INVALID_INPUT' },
      });
      return;
    }
    res.status(result.status).json({
      success: true,
      message: 'Database manager created',
      data: result.row,
    });
  } catch (error: any) {
    logger.error('Error creating database manager', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create database manager',
      error: { code: 'INTERNAL_ERROR', details: error.message },
    });
  }
};

// ─── PUT /v1/database-managers/:id ──────────────────────────────────
export const updateManagerHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await updateDatabaseManager(id, req.body || {});
    if (result.error) {
      res.status(result.status).json({
        success: false,
        message: result.error,
        error: { code: 'INVALID_INPUT' },
      });
      return;
    }
    res.status(result.status).json({
      success: true,
      message: 'Database manager updated',
      data: result.row,
    });
  } catch (error: any) {
    logger.error('Error updating database manager', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update database manager',
      error: { code: 'INTERNAL_ERROR', details: error.message },
    });
  }
};

// ─── DELETE /v1/database-managers/:id ───────────────────────────────
export const deleteManagerHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = deleteDatabaseManager(id);
    if (!result.success) {
      res.status(result.status).json({
        success: false,
        message: 'Not found',
        error: { code: 'NOT_FOUND' },
      });
      return;
    }
    res.status(200).json({ success: true, message: 'Database manager deleted' });
  } catch (error: any) {
    logger.error('Error deleting database manager', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete database manager',
      error: { code: 'INTERNAL_ERROR', details: error.message },
    });
  }
};

// ─── POST /v1/database-managers/test ────────────────────────────────
export const testManagerHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { result, status } = await testDatabaseManager(req.body || {});
    res.status(status).json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    logger.error('Error testing database manager', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test connection',
      error: { code: 'INTERNAL_ERROR', details: error.message },
    });
  }
};