/**
 * ------------------------------------------------------------------
 * Freebuff Upload Handler
 * ------------------------------------------------------------------
 * Upload ảnh lên Freebuff thông qua POST /api/chat/upload
 * (multipart/form-data).
 *
 * API Response:
 * {
 *   kind: "image",
 *   storageId: string,        // dùng trong chat stream request
 *   url: string,
 *   mediaType: string,
 *   name: string,
 *   descriptionStorageId: string  // mô tả ảnh (AI-generated)
 * }
 *
 * Gắn kết quả vào `images` array trong request body của /api/chat/stream.
 * ------------------------------------------------------------------
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import { UPLOAD_URL, FREEBUFF_HEADERS } from './freebuff.constant';
import { FreebuffUploadResponse } from './freebuff.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('FreebuffUpload');

/**
 * Upload một file ảnh lên Freebuff.
 *
 * @param cookies  - Cookie string từ credential
 * @param fileBuffer - Buffer dữ liệu ảnh
 * @param fileName   - Tên file (vd: "image.png")
 * @param mimeType   - MIME type (vd: "image/png")
 * @returns FreebuffUploadResponse chứa storageId và descriptionStorageId
 */
export async function uploadImageToFreebuff(
  cookies: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<FreebuffUploadResponse> {
  const form = new FormData();
  form.append('file', fileBuffer, {
    filename: fileName,
    contentType: mimeType,
  });

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      ...FREEBUFF_HEADERS,
      Cookie: cookies,
      // form-data tự set Content-Type với boundary — không override
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    logger.error(
      `[FreebuffUpload] Upload failed (${response.status}): ${errorText.slice(0, 300)}`,
    );
    throw new Error(
      `Freebuff upload failed (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as FreebuffUploadResponse;

  if (!data?.storageId) {
    throw new Error('Freebuff upload: invalid response — missing storageId');
  }

  return data;
}

/**
 * Extract base64 image data từ OpenAI-style message content parts.
 * Hỗ trợ cả `image_url` (data URI) và các cách encode khác.
 *
 * @returns Array các image objects { buffer, fileName, mimeType }
 */
export function extractImagesFromMessages(messages: any[]): Array<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const images: Array<{ buffer: Buffer; fileName: string; mimeType: string }> =
    [];

  if (!Array.isArray(messages)) return images;

  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.content)) continue;

    for (const part of msg.content) {
      if (!part || part.type !== 'image_url') continue;

      const imageUrl = part.image_url?.url ?? part.url;
      if (!imageUrl || typeof imageUrl !== 'string') continue;

      // Chỉ xử lý data URIs (base64 inline)
      if (!imageUrl.startsWith('data:')) continue;

      try {
        // Format: data:<mimeType>;base64,<data>
        const [meta, base64Data] = imageUrl.split(',');
        if (!meta || !base64Data) continue;

        const mimeMatch = meta.match(/data:([^;]+)/);
        if (!mimeMatch) continue;

        const mimeType = mimeMatch[1]; // vd: "image/png"
        const ext = mimeType.split('/')[1] ?? 'png';
        const fileName = `image.${ext}`;
        const buffer = Buffer.from(base64Data, 'base64');

        images.push({ buffer, fileName, mimeType });
      } catch (err) {
        logger.warn('[FreebuffUpload] Failed to parse image data URI:', err);
      }
    }
  }

  return images;
}
