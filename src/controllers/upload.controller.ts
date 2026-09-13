/**
 * ------------------------------------------------------------------
 * Upload Controller
 * ------------------------------------------------------------------
 * Xử lý request upload file lên provider AI (hỗ trợ file attachments
 * cho các model hỗ trợ đa phương thức).
 *
 * Main functions:
 * - uploadFile() : Upload file lên provider và trả về file_id
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import { isProviderEnabled } from '../services/provider.service';
import { getAccountById } from '../services/account.service';
import { uploadFileToProvider } from '../services/upload.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('UploadController');

// ─── Controller ─────────────────────────────────────────────────────────

export const uploadFile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { accountId } = req.params;
    const file = req.file;
    if (!file) {
      logger.warn(`[Upload] No file provided | accountId=${accountId}`);
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const account = getAccountById(accountId);
    if (!account) {
      logger.warn(`[Upload] Account not found | accountId=${accountId}`);
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const providerId = account.provider_id;
    if (!(await isProviderEnabled(providerId))) {
      logger.warn(
        `[Upload] Provider disabled | accountId=${accountId} | providerId=${providerId}`,
      );
      res.status(403).json({ error: `Provider ${providerId} is disabled` });
      return;
    }

    try {
      if (account.credential === null) {
        logger.warn(
          `[Upload] No credential configured | accountId=${accountId} | providerId=${providerId}`,
        );
        res.status(400).json({ error: 'Account has no credential configured' });
        return;
      }

      const result = await uploadFileToProvider(
        providerId,
        account.credential,
        file,
      );

      const responseData: any = {
        filename: file.originalname,
        ...result,
      };

      res.status(200).json({ success: true, data: responseData });
    } catch (err: any) {
      logger.error(
        `[Upload] Error uploading to ${providerId} | accountId=${accountId} | filename=${file?.originalname}`,
        {
          error: err.message,
          stack: err.stack,
          code: err.code,
        },
      );
      res.status(500).json({ error: `Upload failed: ${err.message}` });
    }
  } catch (error: any) {
    logger.error(
      `[Upload] Unexpected error in uploadFile | accountId=${req.params.accountId}`,
      {
        error: error.message,
        stack: error.stack,
      },
    );
    res.status(500).json({ error: error.message });
  }
};
