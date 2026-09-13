/**
 * ------------------------------------------------------------------
 * Upload Service
 * ------------------------------------------------------------------
 * Business logic upload file lên provider AI.
 *
 * Main functions:
 * - uploadFileToProvider() : Upload file qua provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('UploadService');

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface UploadResult {
  file_id?: string;
  token_usage?: number;
  raw?: any;
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Upload file qua provider
 */
export async function uploadFileToProvider(
  providerId: string,
  credential: string,
  file: Express.Multer.File,
): Promise<UploadResult> {
  logger.info(`[UploadService] Starting upload | providerId=${providerId} | filename=${file.originalname} | size=${file.size}`);

  const provider = providerRegistry.getProvider(providerId);

  if (!provider) {
    logger.error(`[UploadService] Provider not found | providerId=${providerId}`);
    throw new Error(`Provider ${providerId} not supported`);
  }

  logger.info(`[UploadService] Provider found | providerId=${providerId} | hasUploadMethod=${!!provider.uploadFile}`);

  if (!provider.uploadFile) {
    logger.error(`[UploadService] Provider does not support upload | providerId=${providerId}`);
    throw new Error(`Provider ${providerId} does not support file upload`);
  }

  try {
    logger.info(`[UploadService] Calling provider uploadFile | providerId=${providerId} | filename=${file.originalname}`);
    const result = await provider.uploadFile(credential, file);
    
    logger.info(`[UploadService] Provider uploadFile completed | providerId=${providerId} | resultType=${typeof result}`);
    logger.debug(`[UploadService] Raw result | providerId=${providerId} | result=${JSON.stringify(result)}`);

    // Normalize result format
    if (typeof result === 'string') {
      logger.info(`[UploadService] Result is string file_id | providerId=${providerId} | file_id=${result}`);
      return { file_id: result };
    } else if (result && typeof result === 'object' && 'id' in result) {
      logger.info(`[UploadService] Result is object with id | providerId=${providerId} | file_id=${result.id} | token_usage=${(result as any).token_usage}`);
      return {
        file_id: result.id,
        token_usage: (result as any).token_usage,
      };
    } else {
      logger.warn(`[UploadService] Result format unexpected | providerId=${providerId} | resultType=${typeof result}`);
      return { raw: result };
    }
  } catch (error: any) {
    logger.error(`[UploadService] Upload failed | providerId=${providerId} | filename=${file.originalname}`, {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });
    throw error;
  }
}