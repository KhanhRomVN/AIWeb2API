/**
 * ------------------------------------------------------------------
 * Freebuff Provider
 * ------------------------------------------------------------------
 * Provider xử lý tương tác với nền tảng Freebuff AI (freebuff.com).
 *
 * Hỗ trợ:
 * - Mọi model mà Freebuff cung cấp — danh sách lấy động từ API.
 * - Reasoning effort tự động theo model (từ THINKING_MODEL_EFFORTS).
 * - Thread-based conversation (threadId lưu qua threadMap).
 * - Tự động retry khi thread 404 (thread hết hạn).
 *
 * Credential format: JSON string `{ cookies, email? }`
 * ------------------------------------------------------------------
 */

import fetch from 'node-fetch';
import { Provider, SendMessageOptions } from '../../types/index';
import { loginService } from '../../services/login.service';
import { createLogger } from '../../utils/logger';
import { countMessagesTokens, countTokens } from '../../utils/tokenizer';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_LOGIN_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  CAN_REGENERATE,
  STREAM_URL,
  SESSION_URL,
  THREADS_URL,
  SUBSCRIPTIONS_URL,
  FREEBUCKS_SESSION_URL,
  FREEBUFF_HEADERS,
  FREEBUFF_EVENTS,
  DEFAULT_MODEL_ID,
  ALL_MODEL_IDS,
  FULL_ONLY_MODEL_IDS,
  THINKING_MODEL_EFFORTS,
  THINKING_MODEL_DEFAULT_EFFORT,
  MAX_PROMPT_LENGTH,
  PROMPT_TRUNCATE_TO,
} from './freebuff.constant';
import {
  FreebuffCredential,
  FreebuffUserProfile,
  FreebuffRequestBody,
  FreebuffSubscriptionResponse,
  FreebucksSessionResponse,
} from './freebuff.types';
import { parseFreebuffSSE } from './freebuff.sse-parser';
import { proxyHandler } from './freebuff.proxy-handler';
import {
  uploadImageToFreebuff,
  extractImagesFromMessages,
} from './freebuff.upload';

const logger = createLogger('FreebuffProvider');

// ─── Provider Class ───────────────────────────────────────────────────────

export class FreebuffProvider implements Provider {
  name = PROVIDER_ID;
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ───────────────────────────────────────────

  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    is_pausable: IS_PAUSABLE,
    can_regenerate: CAN_REGENERATE,
  };

  /**
   * Map conversationId → Freebuff threadId.
   * Freebuff dùng UUID làm threadId; khi tạo thread mới server trả về
   * threadId trong meta event, ta lưu lại để gửi cho request tiếp theo.
   */
  private readonly threadMap = new Map<string, string>();

  // ─── Credential Parsing ───────────────────────────────────────────────

  /**
   * Parse credential string thành FreebuffCredential.
   * Format chuẩn: JSON string `{ cookies, email? }`
   * Fallback: raw cookie string (backward compat với account cũ).
   */
  private parseCredential(credential: string): FreebuffCredential {
    if (!credential) return { cookies: '' };
    const trimmed = credential.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const cookies = parsed.cookies ?? parsed.token ?? '';
        if (cookies) {
          return { cookies };
        }
      } catch {
        // Không phải JSON hợp lệ — fall through
      }
    }
    return { cookies: credential };
  }

  // ─── Prompt Extraction ────────────────────────────────────────────────

  /**
   * Trích xuất prompt từ messages array.
   * Ưu tiên: user message gần nhất → bất kỳ message nào có nội dung.
   */
  public extractPrompt(messages: any[]): string {
    if (!Array.isArray(messages) || messages.length === 0) return '';

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg || msg.role !== 'user') continue;

      if (typeof msg.content === 'string' && msg.content.trim()) {
        return msg.content.trim();
      }

      if (Array.isArray(msg.content)) {
        const joined = msg.content
          .filter((p: any) => p && (p.type === 'text' || typeof p === 'string'))
          .map((p: any) => p.text ?? p)
          .join('\n')
          .trim();
        if (joined) return joined;
      }
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && typeof msg.content === 'string' && msg.content.trim()) {
        return msg.content.trim();
      }
    }

    return '';
  }

  // ─── Reasoning Effort ─────────────────────────────────────────────────

  /**
   * Xác định reasoningEffort phù hợp cho model.
   * - Model không có trong THINKING_MODEL_EFFORTS → null
   * - options.thinking === false → null (caller tắt thinking)
   * - Ngược lại → THINKING_MODEL_DEFAULT_EFFORT hoặc effort cuối
   */
  private resolveReasoningEffort(
    modelId: string,
    options: SendMessageOptions,
  ): string | null {
    const efforts = THINKING_MODEL_EFFORTS[modelId];
    if (!efforts) return null;
    if (options.thinking === false) return null;
    return (
      THINKING_MODEL_DEFAULT_EFFORT[modelId] ?? efforts[efforts.length - 1]
    );
  }

  // ─── Login ────────────────────────────────────────────────────────────

  async login() {
    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl: AUTH_LOGIN_URL,
      partition: `freebuff_${Date.now()}`,
      cookieEvent: FREEBUFF_EVENTS.LOGIN_TOKEN,
      infoEvent: FREEBUFF_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (!data.cookies?.length) return { isValid: false };

        const hasSessionToken =
          data.cookies.includes('session-token') ||
          data.cookies.includes('__Secure-next-auth.session-token') ||
          data.cookies.includes('next-auth.session-token');

        if (!hasSessionToken) return { isValid: false };

        // Gọi session endpoint để xác thực cookie còn hợp lệ không
        const profile = await this.getUserProfile(data.cookies);
        if (profile?.email) {
          return {
            isValid: true,
            email: profile.email,
            // Lưu dạng JSON { cookies, email } — đúng chuẩn credential format
            cookies: JSON.stringify({
              cookies: data.cookies,
            }),
          };
        }

        logger.warn(
          '[Freebuff] Login validation: session cookie chưa active trên Freebuff endpoint...',
        );
        return { isValid: false };
      },
    });
  }

  // ─── User Profile ─────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string }> {
    try {
      const { cookies } = this.parseCredential(credential);
      const response = await fetch(SESSION_URL, {
        method: 'GET',
        headers: { ...FREEBUFF_HEADERS, Cookie: cookies },
      });

      if (response.ok) {
        const json = (await response.json()) as FreebuffUserProfile;
        if (json?.user?.email) {
          return { email: json.user.email, name: json.user.name };
        }
      }
    } catch (err) {
      logger.error('[Freebuff] Failed to get user profile:', err);
    }
    return { email: null };
  }

  // ─── Usage ────────────────────────────────────────────────────────────

  /**
   * Lấy thông tin usage của tài khoản từ /api/web/freebuff-session.
   *
   * - usage%        = (daily.spent / daily.limit) * 100, clamp 0–100
   * - resetUsageAt  = freebucks.daily.resetAt (ISO 8601 UTC từ server)
   */
  async getUsage(
    credential: string,
  ): Promise<{ usage: number; resetUsageAt: string | null }> {
    try {
      const { cookies } = this.parseCredential(credential);

      const response = await fetch(FREEBUCKS_SESSION_URL, {
        method: 'GET',
        headers: {
          ...FREEBUFF_HEADERS,
          Cookie: cookies,
          'x-fb-timezone': 'Asia/Saigon',
        },
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        logger.warn(
          `[Freebuff] getUsage: request failed — status=${response.status} body=${errText.slice(0, 200)}`,
        );
        return { usage: 0, resetUsageAt: null };
      }

      const json = (await response.json()) as FreebucksSessionResponse;

      const daily = json?.freebucks?.daily;
      if (!daily) {
        logger.warn(
          '[Freebuff] getUsage: freebucks.daily is missing in response — keys=' +
            Object.keys(json ?? {}).join(','),
        );
        return { usage: 0, resetUsageAt: null };
      }

      const limit = daily.limit ?? 0;
      const spent = daily.spent ?? 0;
      const usagePct =
        limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

      const resetUsageAt = daily.resetAt ?? null;

      return { usage: usagePct, resetUsageAt };
    } catch (err) {
      logger.error('[Freebuff] getUsage: unexpected error:', err);
      return { usage: 0, resetUsageAt: null };
    }
  }

  // ─── Models ───────────────────────────────────────────────────────────

  /**
   * Fetch danh sách models dựa trên accessTier của tài khoản.
   * Freebuff không có `/api/models` riêng — ta fetch `/api/chat/threads`
   * để lấy accessTier và model IDs từ lịch sử threads.
   */
  async getModels(credential: string, _accountId?: string): Promise<any[]> {
    const { cookies } = this.parseCredential(credential);
    const response = await fetch(THREADS_URL, {
      method: 'GET',
      headers: { ...FREEBUFF_HEADERS, Cookie: cookies },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Freebuff getModels failed (${response.status}): ${text.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as { accessTier?: string };
    const accessTier = json?.accessTier ?? 'full';

    // Dùng danh sách đầy đủ từ ALL_MODEL_IDS, filter theo tier
    return ALL_MODEL_IDS.filter(
      (id) => accessTier !== 'limited' || !FULL_ONLY_MODEL_IDS.includes(id),
    ).map((id) => ({
      id,
      name: id,
      is_thinking: !!THINKING_MODEL_EFFORTS[id],
      max_context_length: null,
      is_search: false,
      is_image_upload: true,
      is_video_upload: false,
      is_audio_upload: false,
      is_file_upload: false,
      is_larger_content_paste_upload: false,
      is_image_generator: false,
      is_video_generator: false,
      is_deep_research: false,
    }));
  }

  // ─── Upload File ──────────────────────────────────────────────────────

  /**
   * Upload file ảnh lên Freebuff.
   * Trả về full FreebuffUploadResponse để client có thể dùng trong ref_file_ids.
   * upload.service sẽ normalize thành { file_id, url } — nhưng raw object
   * được giữ lại để handleMessage có thể build đúng images array.
   */
  async uploadFile(
    credential: string,
    file: Express.Multer.File,
  ): Promise<{
    id: string;
    url?: string;
    storageId: string;
    mediaType: string;
    name: string;
    descriptionStorageId?: string;
  }> {
    const { cookies } = this.parseCredential(credential);
    const mimeType = file.mimetype || 'image/png';
    const fileName = file.originalname || 'image.png';

    const result = await uploadImageToFreebuff(
      cookies,
      file.buffer,
      fileName,
      mimeType,
    );

    return {
      id: result.storageId,
      url: result.url,
      storageId: result.storageId,
      mediaType: result.mediaType,
      name: result.name,
      descriptionStorageId: result.descriptionStorageId,
    };
  }

  // ─── Handle Message ───────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      conversationId,
      onContent,
      onThinking,
      onMetadata,
      onSessionCreated,
      onDone,
      onError,
    } = options;

    try {
      const modelId = model?.trim() || DEFAULT_MODEL_ID;

      // ── Extract & validate prompt ─────────────────────────────────────
      let prompt = this.extractPrompt(messages);
      if (!prompt) {
        throw new Error('Nội dung tin nhắn không được để trống.');
      }

      if (prompt.length > MAX_PROMPT_LENGTH) {
        logger.warn(
          `[Freebuff] Prompt dài ${prompt.length} ký tự, vượt giới hạn ${MAX_PROMPT_LENGTH}. Truncating...`,
        );
        prompt = prompt.slice(-PROMPT_TRUNCATE_TO);
      }

      // ── Resolve thread ID ─────────────────────────────────────────────
      const existingThreadId = conversationId
        ? (this.threadMap.get(conversationId) ?? null)
        : null;

      // ── Upload images if present ──────────────────────────────────────
      const { cookies } = this.parseCredential(credential);
      const uploadedImages: Array<{
        storageId: string;
        mediaType: string;
        name: string;
        descriptionStorageId?: string;
      }> = [];

      // 1. Ảnh đã được upload trước (qua /api/upload), client gửi qua ref_file_ids
      if (options.ref_file_ids && options.ref_file_ids.length > 0) {
        for (const ref of options.ref_file_ids) {
          if (typeof ref === 'string') continue; // Không hỗ trợ string ID cho Freebuff
          if (ref.file_id) {
            uploadedImages.push({
              storageId: ref.file_id,
              mediaType: (ref as any).mediaType || ref.type || 'image/png',
              name: ref.name || 'image.png',
              descriptionStorageId: (ref as any).descriptionStorageId,
            });
          }
        }
      }

      // 2. Ảnh inline dạng base64 trong messages (upload on-the-fly)
      const imagesToUpload = extractImagesFromMessages(messages);
      if (imagesToUpload.length > 0) {
        for (const img of imagesToUpload) {
          try {
            const uploaded = await uploadImageToFreebuff(
              cookies,
              img.buffer,
              img.fileName,
              img.mimeType,
            );
            uploadedImages.push({
              storageId: uploaded.storageId,
              mediaType: uploaded.mediaType,
              name: uploaded.name,
              descriptionStorageId: uploaded.descriptionStorageId,
            });
          } catch (uploadErr) {
            logger.warn(
              '[Freebuff] Failed to upload image, skipping:',
              uploadErr,
            );
          }
        }
      }

      // ── Build request body ────────────────────────────────────────────
      const bodyPayload: FreebuffRequestBody = {
        threadId: existingThreadId,
        content: prompt,
        model: modelId,
        reasoningEffort: this.resolveReasoningEffort(modelId, options),
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      };

      // ── Send stream request ───────────────────────────────────────────
      const requestHeaders = {
        ...FREEBUFF_HEADERS,
        'Content-Type': 'application/json',
        Cookie: cookies,
      };

      let response = await fetch(STREAM_URL, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(bodyPayload),
      });

      // ── Retry khi thread 404 (thread hết hạn) ────────────────────────
      if (response.status === 404 && bodyPayload.threadId) {
        logger.warn(
          `[Freebuff] Thread ${bodyPayload.threadId} not found (404). Retrying as new conversation...`,
        );
        if (conversationId) this.threadMap.delete(conversationId);

        response = await fetch(STREAM_URL, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ ...bodyPayload, threadId: null }),
        });
      }

      // ── Handle error responses ────────────────────────────────────────
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `[Freebuff] API error ${response.status}: ${errorText.slice(0, 300)}`,
        );

        if (response.status === 401 || response.status === 403) {
          const err = new Error(
            `Session expired or invalid. Please re-login to Freebuff. (${response.status})`,
          );
          (err as any).isAuthError = true;
          (err as any).statusCode = response.status;
          throw err;
        }

        throw new Error(
          `Freebuff API error (${response.status}): ${errorText.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error('Empty response body from Freebuff stream.');
      }

      // ── Token counting cho usage metadata ────────────────────────────
      const promptTokens = countMessagesTokens(messages);
      const completionTokensRef = { value: 0 };

      // ── Parse SSE stream ──────────────────────────────────────────────
      parseFreebuffSSE(response.body as any, {
        onContent: (chunk) => {
          completionTokensRef.value += countTokens(chunk);
          onContent(chunk);
          if (onMetadata) {
            onMetadata({
              total_token: promptTokens + completionTokensRef.value,
            });
          }
        },

        onThinking,
        onMetadata,

        onSessionCreated: (newThreadId) => {
          if (!newThreadId) return;
          if (conversationId) this.threadMap.set(conversationId, newThreadId);
          this.threadMap.set(newThreadId, newThreadId);
          if (onSessionCreated) onSessionCreated(newThreadId);
        },

        onDone,
        onError,
      });
    } catch (error) {
      logger.error('[Freebuff] Error in handleMessage:', error);
      onError(error);
    }
  }
}

export default new FreebuffProvider();
