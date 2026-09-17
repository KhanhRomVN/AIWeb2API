/**
 * ------------------------------------------------------------------
 * Claude Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Claude AI (claude.ai web).
 *
 * Main features:
 * - login()          : Đăng nhập qua browser (CDP), capture cookie + orgId
 * - getUserProfile() : Lấy thông tin user (email/name/id) qua bootstrap
 * - getModels()      : Lấy danh sách model từ bootstrap API (không hardcode)
 * - handleMessage()  : Gửi tin nhắn với SSE streaming
 * - uploadFile()     : Upload file qua /wiggle/upload-file
 *
 * Credential format (JSON string):
 * - cookies        : Cookie string (chứa sessionKey, __cf_bm, ...)
 * - organizationId : UUID organization (bắt buộc cho mọi request chat/upload)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { randomUUID } from 'crypto';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Claude Imports ──
import { ClaudeHttpClient } from './claude.http-client';
import { proxyHandler } from './claude.proxy-handler';
import { parseSSEStream } from './claude.sse-parser';
import { claudeUploadFile, ClaudeUploadFileInput } from './claude.upload';
import {
  ClaudeCredential,
  ClaudeUserProfile,
  ClaudeBootstrapResponse,
  ClaudeBootstrapModel,
  ClaudeCompletionPayload,
  ClaudeLoginTokenPayload,
} from './claude.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CLAUDE_AUTH_METHODS,
  CONNECTION_TYPE,
  FALLBACK_MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  CLAUDE_EVENTS,
  USER_AGENT,
  GOOGLE_OAUTH_LOGIN_URL,
  API_PATHS,
  ANTHROPIC_HEADERS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  API_FIELDS,
  DEFAULT_LOGIN_PATH,
  LOGIN_PARTITION_PREFIX,
  MASKED_EMAIL_INDICATOR,
  MASKED_EMAIL_CHAR,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  DEFAULT_TIMEZONE,
  DEFAULT_LOCALE,
  DEFAULT_EFFORT,
  DEFAULT_THINKING_MODE,
  DEFAULT_RENDERING_MODE,
  DEFAULT_CHAT_MEMORY_MODE,
  CHROME_FINGERPRINT_HEADERS,
  EFFORT_LEVELS,
  THINKING_MODES,
  WEB_SEARCH_TOOL,
} from './claude.constant';

/**
 * Tách `effort` khỏi model id dạng `<base>-<effort>`.
 * Nếu suffix không khớp EFFORT_LEVELS → coi như không có effort.
 * Ví dụ: `claude-sonnet-5-medium` → `{ base: 'claude-sonnet-5', effort: 'medium' }`
 */
function splitModelAndEffort(modelId: string): {
  base: string;
  effort: string | null;
} {
  for (const lvl of EFFORT_LEVELS) {
    const suffix = `-${lvl}`;
    if (modelId.endsWith(suffix)) {
      return { base: modelId.slice(0, -suffix.length), effort: lvl };
    }
  }
  return { base: modelId, effort: null };
}

/** Viết hoa chữ cái đầu để ghép vào tên hiển thị: `medium` → `Medium`. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeProvider');

// ─── Helper: build common headers ──────────────────────────────────────

/**
 * Header chung cho mọi request tới claude.ai:
 * Cookie + các header anthropic-client-* bắt buộc.
 */
function buildClaudeHeaders(
  cookies: string,
  referer: string = `${BASE_URL}${REFERER_PATHS.NEW}`,
): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.COOKIE]: cookies,
    [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
    [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
    [HTTP_HEADER_NAMES.REFERER]: referer,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_PLATFORM]:
      ANTHROPIC_HEADERS.CLIENT_PLATFORM,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_VERSION]:
      ANTHROPIC_HEADERS.CLIENT_VERSION,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_BUILD]: ANTHROPIC_HEADERS.CLIENT_BUILD,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_SHA]: ANTHROPIC_HEADERS.CLIENT_SHA,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_CAPABILITIES]:
      ANTHROPIC_HEADERS.CLIENT_CAPABILITIES,
  };
}

// ─── Provider Class ────────────────────────────────────────────────────

export class ClaudeProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ────────────────────────────────────────
  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    // Để rỗng → getAllProviders sẽ gọi dynamic getModels() (bootstrap).
    // Fallback tĩnh vẫn dùng khi bootstrap fail (xem getModels()).
    models: [],
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
  };

  // ─── Credential Parsing ────────────────────────────────────────────

  /**
   * Parse credential string thành `{ cookies, organizationId }`.
   * Hỗ trợ cả credential JSON mới (`{cookies, organizationId}`) lẫn
   * raw cookie string cũ (không có orgId → `organizationId: null`).
   */
  private parseCredential(credential: string): ClaudeCredential {
    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);
        const cookies =
          parsed.cookies ||
          parsed.secretKey ||
          parsed.secret_key ||
          parsed.token ||
          '';
        const organizationId =
          parsed.organizationId ||
          parsed.organization_id ||
          parsed.orgId ||
          null;
        if (cookies) {
          return { cookies, organizationId };
        }
      } catch (e) {
        logger.warn(
          '[Claude] Credential is not valid JSON, treating as raw cookie:',
          e,
        );
      }
    }
    return { cookies: credential, organizationId: null };
  }

  // ─── Bootstrap (account + models) ──────────────────────────────────

  /**
   * Gọi bootstrap để lấy account info + models config.
   * Trả `null` nếu thiếu orgId hoặc request fail.
   */
  private async fetchBootstrap(
    credential: ClaudeCredential,
  ): Promise<ClaudeBootstrapResponse | null> {
    if (!credential.organizationId) {
      logger.warn('[Claude] Missing organizationId, cannot fetch bootstrap');
      return null;
    }

    try {
      const client = new ClaudeHttpClient({
        baseURL: BASE_URL,
        headers: buildClaudeHeaders(credential.cookies),
      });
      const res = await client.get(
        API_PATHS.BOOTSTRAP(credential.organizationId),
      );
      if (!res.ok) {
        logger.warn(`[Claude] Bootstrap returned status ${res.status}`);
        return null;
      }
      return (await res.json()) as ClaudeBootstrapResponse;
    } catch (e) {
      logger.error('[Claude] Bootstrap error:', e);
      return null;
    }
  }

  // ─── Get Profile ────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const cred = this.parseCredential(credential);
    const bootstrap = await this.fetchBootstrap(cred);
    const account = bootstrap?.[API_FIELDS.ACCOUNT];

    if (!account) {
      return { email: null };
    }

    return {
      email: account[API_FIELDS.EMAIL_ADDRESS] || null,
      name:
        account[API_FIELDS.FULL_NAME] ||
        account[API_FIELDS.DISPLAY_NAME] ||
        undefined,
      id: account[API_FIELDS.TAGGED_ID] || account[API_FIELDS.UUID],
    };
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  /**
   * Lấy danh sách model từ bootstrap API. Nếu fail → trả FALLBACK_MODELS
   * đã được map sẵn sang schema chuẩn.
   */
  async getModels(credential: string): Promise<any[]> {
    const cred = this.parseCredential(credential);
    const bootstrap = await this.fetchBootstrap(cred);
    const membership = bootstrap?.[API_FIELDS.ACCOUNT]?.memberships?.[0];
    const modelsConfig: ClaudeBootstrapModel[] | undefined =
      membership?.organization?.[API_FIELDS.MODELS_CONFIG];

    if (!modelsConfig || modelsConfig.length === 0) {
      logger.warn('[Claude] No models config from bootstrap, using fallback');
      logger.info(
        `[Claude getModels] Dùng fallback models: ${FALLBACK_MODELS.map((m) => m.id).join(', ')}`,
      );
      return [...FALLBACK_MODELS];
    }

    // Nhân mỗi model base với từng mức effort → nhiều entry cùng base.
    const expanded: any[] = [];
    for (const m of modelsConfig) {
      const caps = m.capabilities;
      const isThinking =
        Array.isArray(m.thinking_modes) && m.thinking_modes.length > 0;
      const isImageUpload = caps?.mm_images !== false;
      const isPdfUpload = caps?.mm_pdf === true;
      const isSearch = caps?.web_search !== false;

      // Model không hỗ trợ thinking → effort vô nghĩa, chỉ tạo 1 entry.
      const effortsForModel: Array<string | null> = isThinking
        ? [...EFFORT_LEVELS]
        : [null];

      for (const effort of effortsForModel) {
        const id = effort ? `${m.model}-${effort}` : m.model;
        const name = effort ? `${m.name} ${capitalize(effort)}` : m.name;
        expanded.push({
          id,
          name,
          is_thinking: isThinking,
          max_context_length: m.hard_limit ?? null,
          is_search: isSearch,
          is_image_upload: isImageUpload,
          is_video_upload: false,
          is_audio_upload: false,
          is_file_upload: isPdfUpload,
          is_larger_content_paste_upload: false,
          is_image_generator: false,
          is_video_generator: false,
          is_deep_research: false,
          description: m.description || m.name,
        });
      }
    }

    logger.info(
      `[Claude getModels] Lấy được ${modelsConfig.length} model base từ bootstrap, ` +
        `mở rộng thành ${expanded.length} model (effort levels: ${EFFORT_LEVELS.join(', ')}). ` +
        `IDs: ${expanded.map((x) => x.id).join(', ')}`,
    );

    return expanded;
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { method?: 'basic' | 'google' }) {
    const method = options?.method || CLAUDE_AUTH_METHODS.BASIC;
    const loginUrl =
      method === CLAUDE_AUTH_METHODS.GOOGLE
        ? GOOGLE_OAUTH_LOGIN_URL
        : `${BASE_URL}${DEFAULT_LOGIN_PATH}`;

    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl,
      partition: `${LOGIN_PARTITION_PREFIX}${Date.now()}`,
      cookieEvent: CLAUDE_EVENTS.LOGIN_TOKEN,
      infoEvent: CLAUDE_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
        organizationId?: string;
      }) => {
        if (!data.cookies) {
          logger.warn('[Claude] Login validation failed: no cookies captured');
          return { isValid: false };
        }

        let orgId = data.organizationId || null;
        let email = data.email;

        // Nếu chưa có orgId (proxy không bắt được bootstrap URL) → thử
        // list organizations qua API để lấy orgId đầu tiên.
        if (!orgId) {
          orgId = await this.fetchFirstOrganizationId(data.cookies);
        }

        // Nếu vẫn chưa có email thật (masked hoặc rỗng) và có orgId →
        // gọi bootstrap lấy email.
        if (
          orgId &&
          (!email ||
            email.includes(MASKED_EMAIL_INDICATOR) ||
            email.includes(MASKED_EMAIL_CHAR))
        ) {
          const cred: ClaudeCredential = {
            cookies: data.cookies,
            organizationId: orgId,
          };
          const profile = await this.getUserProfile(JSON.stringify(cred));
          email = profile.email || email;
        }

        // Login thành công khi có cookie + email. orgId có thể null —
        // handleMessage sẽ tự retry lấy orgId nếu cần.
        if (email) {
          const finalCred: ClaudeCredential = {
            cookies: data.cookies,
            organizationId: orgId,
          };
          if (!orgId) {
            logger.warn(
              '[Claude] Login succeeded but organizationId is missing — will retry lazily on first request',
            );
          }
          return {
            isValid: true,
            cookies: JSON.stringify(finalCred),
            email,
          };
        }

        logger.warn(
          '[Claude] Login validation failed: could not determine email',
        );
        return { isValid: false };
      },
    });
  }

  /**
   * Gọi `/api/organizations` để lấy orgId đầu tiên từ cookie.
   * Dùng khi proxy không capture được bootstrap URL.
   * Trả `null` nếu request fail hoặc response không có org nào.
   */
  private async fetchFirstOrganizationId(
    cookies: string,
  ): Promise<string | null> {
    try {
      const client = new ClaudeHttpClient({
        baseURL: BASE_URL,
        headers: buildClaudeHeaders(cookies),
      });
      const res = await client.get('/api/organizations');
      if (!res.ok) {
        logger.warn(
          `[Claude] /api/organizations returned status ${res.status}`,
        );
        return null;
      }
      const data = (await res.json()) as Array<{ uuid?: string }> | {
        organizations?: Array<{ uuid?: string }>;
      };
      const list = Array.isArray(data)
        ? data
        : (data as any)?.organizations || [];
      const firstId = list[0]?.uuid;
      return typeof firstId === 'string' ? firstId : null;
    } catch (e) {
      logger.warn('[Claude] Failed to fetch /api/organizations:', e);
      return null;
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onRaw,
      onMetadata,
      onDone,
      onError,
      conversationId,
      ref_file_ids,
    } = options;

    const cred = this.parseCredential(credential);

    // Lazy fetch orgId nếu credential cũ chưa có (login flow không capture được).
    if (!cred.organizationId) {
      const fetched = await this.fetchFirstOrganizationId(cred.cookies);
      if (fetched) {
        cred.organizationId = fetched;
        // Notify caller để persist credential đã bổ sung orgId.
        if (options.onCredentialRotated) {
          try {
            await options.onCredentialRotated(JSON.stringify(cred));
          } catch (e) {
            logger.warn(
              '[Claude] onCredentialRotated failed when persisting orgId:',
              e,
            );
          }
        }
      } else {
        onError(
          new Error(
            'Claude credential missing organizationId and could not be auto-fetched. Please re-login.',
          ),
        );
        return;
      }
    }

    // Conversation ID: dùng cái đã có, hoặc sinh mới (client-side)
    const convId = conversationId || randomUUID();

    try {
      // ── Upload file đính kèm (nếu có) ──────────────────────────────
      const fileUuids: string[] = [];
      if (ref_file_ids && ref_file_ids.length > 0) {
        for (const ref of ref_file_ids) {
          // Chỉ xử lý khi ref có buffer (từ service layer truyền vào)
          const asAny = ref as any;
          if (asAny?.buffer && asAny?.originalname && asAny?.mimetype) {
            const uploadRes = await this.uploadFileRaw(
              cred,
              convId,
              asAny as ClaudeUploadFileInput,
            );
            fileUuids.push(uploadRes.file_uuid);
          } else if (typeof ref === 'object' && ref !== null && 'file_uuid' in ref) {
            fileUuids.push((ref as { file_uuid: string }).file_uuid);
          } else if (typeof ref === 'string') {
            fileUuids.push(ref);
          }
        }
      }

      // ── Build payload ──────────────────────────────────────────────
      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage?.content || '';

      // Model id dạng `<base>-<effort>` (do getModels sinh ra); tách ngược lại.
      const { base: baseModel, effort: parsedEffort } =
        splitModelAndEffort(model);
      const effort = parsedEffort || DEFAULT_EFFORT;

      // thinking: false → tắt thinking; ngược lại dùng mode mặc định (auto).
      const thinkingMode =
        options.thinking === false ? THINKING_MODES.OFF : DEFAULT_THINKING_MODE;

      // web search: chỉ bật khi caller truyền search=true.
      const tools = options.search === true ? [WEB_SEARCH_TOOL] : [];

      logger.debug(
        `[Claude handleMessage] model=${model} → base=${baseModel}, effort=${effort}, ` +
          `thinking_mode=${thinkingMode}, search=${options.search === true}, thinking=${options.thinking}`,
      );

      const payload: ClaudeCompletionPayload = {
        prompt,
        timezone: DEFAULT_TIMEZONE,
        locale: DEFAULT_LOCALE,
        model: baseModel,
        effort,
        thinking_mode: thinkingMode,
        tools,
        turn_message_uuids: {
          human_message_uuid: randomUUID(),
          assistant_message_uuid: randomUUID(),
        },
        completion_request_id: randomUUID(),
        rendering_mode: DEFAULT_RENDERING_MODE,
        create_conversation_params: {
          name: '',
          model: baseModel,
          include_conversation_preferences: true,
          chat_memory_mode: DEFAULT_CHAT_MEMORY_MODE,
        },
      };

      if (fileUuids.length > 0) {
        payload.files = fileUuids;
      }

      // ── Gửi completion request ─────────────────────────────────────
      const referer = `${BASE_URL}${REFERER_PATHS.CHAT_PREFIX}${convId}`;
      const client = new ClaudeHttpClient({
        baseURL: BASE_URL,
        headers: {
          ...buildClaudeHeaders(cred.cookies, referer),
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.SSE,
        },
      });

      const url = API_PATHS.COMPLETION(cred.organizationId, convId);
      const response = await client.streamSSE(url, {
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Claude API returned ${response.status}: ${errorText.slice(0, 500)}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Emit conversation id để caller lưu lại
      if (onMetadata) {
        onMetadata({ conversation_id: convId });
      }

      await parseSSEStream(response.body as unknown as NodeJS.ReadableStream, {
        onContent,
        onThinking,
        onRaw,
        onMetadata,
      });

      onDone();
    } catch (err: any) {
      logger.error('[Claude] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── File Upload ────────────────────────────────────────────────────

  /**
   * Upload file — wrapper public của claudeUploadFile.
   * @param credential Credential JSON string hoặc raw cookie.
   * @param file       Buffer + metadata.
   * @param conversationId Tuỳ chọn; nếu không có sẽ sinh UUID mới.
   */
  async uploadFile(
    credential: string,
    file: ClaudeUploadFileInput,
    conversationId?: string,
  ): Promise<{ file_uuid: string }> {
    const cred = this.parseCredential(credential);
    const convId = conversationId || randomUUID();
    return this.uploadFileRaw(cred, convId, file);
  }

  /** Internal helper dùng credential đã parse sẵn. */
  private async uploadFileRaw(
    cred: ClaudeCredential,
    conversationId: string,
    file: ClaudeUploadFileInput,
  ): Promise<{ file_uuid: string }> {
    const res = await claudeUploadFile(cred, conversationId, file);
    return { file_uuid: res.file_uuid };
  }
}

export default new ClaudeProvider();