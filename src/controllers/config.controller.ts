/**
 * ------------------------------------------------------------------
 * Config Controller
 * ------------------------------------------------------------------
 * Endpoint đọc/ghi cấu hình toàn cục (đường dẫn database + profile
 * Chromium). Được Zen gọi khi user thay đổi trong Settings > General.
 *
 * Main functions:
 * - getConfigHandler()          : GET /v1/config
 * - putConfigHandler()          : PUT /v1/config
 * - scanProfileDirHandler()     : POST /v1/config/scan-profile-dir
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

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
    const { chromium_profile_dir, chromium_profile_subpath } = req.body || {};

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

    if (
      chromium_profile_subpath !== undefined &&
      chromium_profile_subpath !== null &&
      typeof chromium_profile_subpath !== 'string'
    ) {
      res.status(400).json({
        success: false,
        message: 'chromium_profile_subpath must be a string or null',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const config = await setAppConfig({
      chromium_profile_dir,
      chromium_profile_subpath,
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

// ─── POST /v1/config/scan-profile-dir ───────────────────────────────
/**
 * Quét cấu trúc thư mục profile để phát hiện relative subpath.
 *
 * Body: { profile_dir: string }
 *
 * Trả về:
 * - subpaths: string[] — Danh sách relative path duy nhất từ [profile_email]/ tới
 *   folder chứa Default/ (không bao gồm "Default" trong path).
 *   Mảng rỗng nghĩa là cấu trúc mặc định ([profile_email]/Default/).
 *
 * Thuật toán:
 * 1. Lấy danh sách các folder con trực tiếp của profile_dir (= email folders).
 * 2. Với mỗi email folder, kiểm tra xem có Default/ trực tiếp không (subpath = "").
 * 3. Nếu không, quét sâu thêm 1 cấp để tìm folder chứa Default/ (subpath = tên folder con).
 * 4. Gom nhóm các subpath unique.
 */
export const scanProfileDirHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { profile_dir } = req.body || {};

    if (!profile_dir || typeof profile_dir !== 'string') {
      res.status(400).json({
        success: false,
        message: 'profile_dir is required and must be a string',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (!fs.existsSync(profile_dir)) {
      res.status(404).json({
        success: false,
        message: 'profile_dir does not exist',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const subpathSet = new Set<string>();

    // Lấy danh sách email folders
    let emailFolders: string[];
    try {
      emailFolders = fs
        .readdirSync(profile_dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      emailFolders = [];
    }

    for (const emailFolder of emailFolders) {
      const emailPath = path.join(profile_dir, emailFolder);

      // Kiểm tra Default/ trực tiếp trong email folder → subpath rỗng
      if (fs.existsSync(path.join(emailPath, 'Default'))) {
        subpathSet.add('');
        continue;
      }

      // Quét sâu thêm 1 cấp (ví dụ: chrome/, chromium/)
      let subFolders: string[];
      try {
        subFolders = fs
          .readdirSync(emailPath, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
      } catch {
        subFolders = [];
      }

      for (const sub of subFolders) {
        if (fs.existsSync(path.join(emailPath, sub, 'Default'))) {
          subpathSet.add(sub);
        }
      }
    }

    const subpaths = Array.from(subpathSet);

    res.status(200).json({
      success: true,
      message: 'Scan completed',
      data: { subpaths },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('Error scanning profile dir', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scan profile dir',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};
