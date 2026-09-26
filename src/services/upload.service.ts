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
  conversation_id?: string; // Trả về để client dùng đúng convId khi gửi message
  url?: string;
  token_usage?: number;
  raw?: any;
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Upload file qua provider
 * @param conversationId UUID conversation — bắt buộc với Claude (file gắn với conversation cụ thể)
 */
export async function uploadFileToProvider(
  providerId: string,
  credential: string,
  file: Express.Multer.File,
  conversationId?: string,
): Promise<UploadResult> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider) {
    logger.error(
      `[UploadService] Provider not found | providerId=${providerId}`,
    );
    throw new Error(`Provider ${providerId} not supported`);
  }

  if (!provider.uploadFile) {
    logger.error(
      `[UploadService] Provider does not support upload | providerId=${providerId}`,
    );
    throw new Error(`Provider ${providerId} does not support file upload`);
  }

  try {
    const result = await provider.uploadFile(credential, file, conversationId);
    // Normalize result format
    if (typeof result === 'string') {
      return { file_id: result };
    } else if (result && typeof result === 'object' && 'id' in result) {
      const normalized = {
        file_id: (result as any).id,
        url: (result as any).url,
        token_usage: (result as any).token_usage,
      };

      return normalized;
    } else if (result && typeof result === 'object' && 'file_uuid' in result) {
      // Claude returns { file_uuid, conversation_id } — map to file_id, preserve conversation_id
      const normalized: UploadResult = {
        file_id: (result as any).file_uuid,
        raw: result,
      };
      if ((result as any).conversation_id) {
        normalized.conversation_id = (result as any).conversation_id;
      }

      return normalized;
    } else {
      logger.warn(
        `[UploadService] Result format unexpected | providerId=${providerId} | resultType=${typeof result} | keys=${result && typeof result === 'object' ? Object.keys(result).join(',') : 'N/A'} | raw=${JSON.stringify(result).slice(0, 300)}`,
      );
      return { raw: result };
    }
  } catch (error: any) {
    logger.error(
      `[UploadService] Upload failed | providerId=${providerId} | filename=${file.originalname}`,
      {
        error: error.message,
        stack: error.stack,
        code: error.code,
      },
    );
    throw error;
  }
}
