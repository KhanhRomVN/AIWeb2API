/**
 * ------------------------------------------------------------------
 * Config Controller
 * ------------------------------------------------------------------
 * Endpoint đọc/ghi cấu hình toàn cục (đường dẫn database + profile
 * Chromium). Được Zen gọi khi user thay đổi trong Settings > General.
 *
 * Main functions:
 * - getConfigHandler()  : GET /v1/config
 * - putConfigHandler()  : PUT /v1/config
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import { getAppConfig, setAppConfig } from '../services/config.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ConfigController');

// ─── Handlers ───────────────────────────────────────────────────────────

// ─── GET /v1/config ─────────────────────────────────────────────────
export const getConfigHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const config = await getAppConfig();
    res.status(200).json({
      success: true,
      message: 'Config retrieved successfully',
      data: config,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('Error fetching config', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch config',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// ─── PUT /v1/config ─────────────────────────────────────────────────
export const putConfigHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { chromium_profile_dir } = req.body || {};

    if (
      chromium_profile_dir !== undefined &&
      chromium_profile_dir !== null &&
      typeof chromium_profile_dir !== 'string'
    ) {
      res.status(400).json({
        success: false,
        message: 'chromium_profile_dir must be a string or null',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const config = await setAppConfig({
      chromium_profile_dir,
    });

    res.status(200).json({
      success: true,
      message: 'Config updated successfully',
      data: config,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('Error updating config', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update config',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};
