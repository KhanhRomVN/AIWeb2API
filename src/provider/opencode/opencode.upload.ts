/**
 * ------------------------------------------------------------------
 * OpenCode Upload
 * ------------------------------------------------------------------
 * OpenCode KHÔNG có endpoint upload file. Cơ chế duy nhất là gửi ảnh
 * dưới dạng part `{ type: 'file', mime, url: <data URI>, filename }`
 * trong `session.prompt`. Vì vậy "upload" ở đây chỉ chuyển ảnh thành
 * data URI, không gọi mạng (trừ khi ref là URL http/https).
 *
 * Main functions:
 * - opencodeUploadFile()    : Buffer ảnh -> data URI (trả về cho upload.service)
 * - buildFilePartsFromRefs(): ref_file_ids -> danh sách file part
 * - fetchImageAsDataUri()   : Tải ảnh từ URL http(s) -> data URI
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as crypto from 'crypto';
import fetch from 'node-fetch';

import { createLogger } from '../../utils/logger';

import {
  DEFAULT_IMAGE_FILENAME,
  DEFAULT_IMAGE_MIME,
  IMAGE_FETCH_TIMEOUT_MS,
  IMAGE_MAX_BYTES,
} from './opencode.constant';
import { OpenCodeFilePart, OpenCodeUploadResponse } from './opencode.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('OpenCodeUpload');

const DATA_URI_PREFIX = 'data:';
const IMAGE_MIME_PREFIX = 'image/';

// ─── Input Types ────────────────────────────────────────────────────────

export interface OpenCodeUploadFileInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export type OpenCodeFileRef =
  | string
  | {
      file_id: string;
      url: string;
      type?: string;
      name?: string;
    };

// ─── Helpers ────────────────────────────────────────────────────────────

function toDataUri(mime: string, buffer: Buffer): string {
  return `${DATA_URI_PREFIX}${mime};base64,${buffer.toString('base64')}`;
}

function mimeFromDataUri(uri: string): string {
  const match = uri.match(/^data:([^;,]+)/);
  return match ? match[1] : DEFAULT_IMAGE_MIME;
}

/**
 * Tải ảnh từ URL http(s) và encode base64 data URI.
 * @throws Nếu scheme không hợp lệ, HTTP != 200, không phải image/*, hoặc vượt IMAGE_MAX_BYTES.
 */
export async function fetchImageAsDataUri(url: string): Promise<string> {
  if (url.startsWith(DATA_URI_PREFIX)) return url;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`Invalid image URL scheme: ${url.slice(0, 30)}`);
  }

  const res = await fetch(url, { timeout: IMAGE_FETCH_TIMEOUT_MS });
  if (res.status !== 200) {
    throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  }

  const contentType = (
    res.headers.get('content-type') || DEFAULT_IMAGE_MIME
  ).split(';')[0];
  if (!contentType.startsWith(IMAGE_MIME_PREFIX)) {
    throw new Error(`Unsupported content-type for image: ${contentType}`);
  }

  const buffer = await res.buffer();
  if (buffer.length > IMAGE_MAX_BYTES) {
    throw new Error(`Image too large: ${buffer.length} bytes`);
  }
  return toDataUri(contentType, buffer);
}

// ─── Upload ─────────────────────────────────────────────────────────────

/**
 * "Upload" ảnh: encode thành data URI để client gửi lại qua ref_file_ids.
 * @throws Nếu file không phải ảnh hoặc vượt IMAGE_MAX_BYTES.
 */
export async function opencodeUploadFile(
  file: OpenCodeUploadFileInput,
): Promise<OpenCodeUploadResponse> {
  const mime = file.mimetype || DEFAULT_IMAGE_MIME;
  if (!mime.startsWith(IMAGE_MIME_PREFIX)) {
    throw new Error(
      `OpenCode chỉ hỗ trợ ảnh (nhận được ${mime}). Không có upload file/PDF.`,
    );
  }
  if (file.buffer.length > IMAGE_MAX_BYTES) {
    throw new Error(`Ảnh vượt giới hạn ${IMAGE_MAX_BYTES} bytes.`);
  }

  return {
    id: crypto.randomUUID(),
    url: toDataUri(mime, file.buffer),
    mime,
    filename: file.originalname || DEFAULT_IMAGE_FILENAME,
    size: file.buffer.length,
  };
}

// ─── Ref -> File Part ───────────────────────────────────────────────────

/**
 * Chuyển ref_file_ids thành file part. Ref lỗi chỉ cảnh báo và bỏ qua ảnh đó
 * (không fail request).
 */
export async function buildFilePartsFromRefs(
  refs: OpenCodeFileRef[] | undefined,
): Promise<OpenCodeFilePart[]> {
  const parts: OpenCodeFilePart[] = [];
  if (!Array.isArray(refs)) return parts;

  for (const ref of refs) {
    const url = typeof ref === 'string' ? ref : ref?.url;
    if (!url) continue;

    try {
      const dataUri = await fetchImageAsDataUri(url);
      parts.push({
        type: 'file',
        mime: mimeFromDataUri(dataUri),
        url: dataUri,
        filename:
          (typeof ref === 'object' && ref.name) || DEFAULT_IMAGE_FILENAME,
      });
    } catch (e) {
      logger.warn('[OpenCode] Skip image part:', (e as Error).message);
    }
  }
  return parts;
}