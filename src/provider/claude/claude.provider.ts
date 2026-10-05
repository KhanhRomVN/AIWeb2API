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
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
  ClaudeCompletionPayload,
  ClaudeRetryCompletionPayload,
  ClaudeConversationResponse,
  ClaudeLoginTokenPayload,
  ClaudeModelSelectorModel,
} from './claude.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CLAUDE_AUTH_METHODS,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  CAN_REGENERATE,
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
  MODEL_SELECTOR_SURFACE_CHAT,
  THINKING_MODES,
  WEB_SEARCH_TOOL,
  ANTI_SYSTEM_PROMPT_INJECTION,
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
    models: [],
    is_pausable: IS_PAUSABLE,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
    anti_system_prompt_injection: ANTI_SYSTEM_PROMPT_INJECTION,
    can_regenerate: CAN_REGENERATE,
  };

  // ─── Credential Parsing ────────────────────────────────────────────

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
  ): Promise<ClaudeBootstrapResponse> {
    if (!credential.organizationId) {
      throw new Error(
        'Missing organizationId in credential. Please re-login to Claude.',
      );
    }

    const client = new ClaudeHttpClient({
      baseURL: BASE_URL,
      headers: buildClaudeHeaders(credential.cookies),
    });
    const res = await client.get(
      API_PATHS.BOOTSTRAP(credential.organizationId),
    );
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        // Lấy message gốc từ claude.ai (e.g. "Invalid authorization")
        detail = body?.error?.message ?? body?.message ?? JSON.stringify(body);
      } catch {
        detail = await res.text().catch(() => '');
      }
      const message = `Claude bootstrap API returned ${res.status}${detail ? `: ${detail}` : ''}`;
      // 401/403 = session hết hạn hoặc cookie invalid → cần re-login
      if (res.status === 401 || res.status === 403) {
        const err = new Error(
          `Session expired or invalid. Please re-login to Claude. (${message})`,
        );
        (err as any).isAuthError = true;
        (err as any).statusCode = res.status;
        throw err;
      }
      throw new Error(message);
    }
    return (await res.json()) as ClaudeBootstrapResponse;
  }

  // ─── Get Profile ────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const cred = this.parseCredential(credential);
      const bootstrap = await this.fetchBootstrap(cred);
      const account = bootstrap[API_FIELDS.ACCOUNT];

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
    } catch (e) {
      logger.warn('[Claude] getUserProfile error:', e);
      return { email: null };
    }
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  /**
   * Lấy danh sách model từ `model_selector_config` (surface `chat`) trong
   * bootstrap response — đây là nguồn ĐÚNG cho effort/capabilities/trạng thái
   * disabled, thay cho `claude_ai_bootstrap_models_config` (legacy, xem
   * claude.md trong cùng thư mục provider). Nếu fail → throw với message rõ
   * ràng để Zen có thể hiển thị lỗi cho user.
   */
  async getModels(credential: string): Promise<any[]> {
    try {
      const cred = this.parseCredential(credential);
      // fetchBootstrap throw trực tiếp với message gốc từ claude.ai nếu fail
      const bootstrap = await this.fetchBootstrap(cred);
      const chatSurface = bootstrap.model_selector_config?.find(
        (s) => s.id === MODEL_SELECTOR_SURFACE_CHAT,
      );
      const modelsConfig: ClaudeModelSelectorModel[] | undefined =
        chatSurface?.models;

      if (!modelsConfig || modelsConfig.length === 0) {
        throw new Error(
          'Bootstrap succeeded but returned no model_selector_config for the ' +
            '"chat" surface. Your account may not have model access or the ' +
            'organization is missing.',
        );
      }

      // Nhân mỗi model base với từng mức effort model đó thực sự hỗ trợ
      // (effort_options[] riêng của từng model — không hardcode chung).
      const expanded: any[] = [];
      for (const m of modelsConfig) {
        // disabled: true = model bị khóa (cần upgrade plan) — bỏ qua.
        if (m.disabled === true) continue;

        const caps = m.capabilities;
        const thinkingType = m.thinking?.type;
        const hasEffort =
          thinkingType === 'effort' || thinkingType === 'effort_and_mode';
        const isThinking = hasEffort || thinkingType === 'mode';
        const isImageUpload = caps?.mm_images === true;
        const isPdfUpload = caps?.mm_pdf === true;
        const isSearch = caps?.web_search === true;

        // Model không có effort → chỉ tạo 1 entry (không suffix).
        const effortOptions = hasEffort
          ? (m.thinking?.effort_options ?? [])
          : [];
        const entries = effortOptions.length > 0 ? effortOptions : [null];

        for (const opt of entries) {
          const id = opt ? `${m.id}-${opt.id}` : m.id;
          const name = opt ? `${m.name} ${opt.name}` : m.name;
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

      this.saveRawModelsResponse(bootstrap);

      return expanded;
    } catch (err: any) {
      logger.error('[Claude] Error in getModels:', err);
      throw err;
    }
  }

  /**
   * Lưu raw response của bootstrap API vào file claude_models.json.
   * Ghi đè mỗi lần gọi (không tạo file mới); chỉ gọi khi getModels() thành công.
   */
  private saveRawModelsResponse(bootstrap: ClaudeBootstrapResponse): void {
    try {
      const dir = path.join(os.homedir(), '.aiweb2api');
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, 'claude_models.json');
      fs.writeFileSync(filePath, JSON.stringify(bootstrap, null, 2));
    } catch (e) {
      logger.warn('[Claude] Failed to save claude_models.json:', e);
    }
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
        sessionKeyExpiresAt?: number | null;
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
          try {
            orgId = await this.fetchFirstOrganizationId(data.cookies);
          } catch (e) {
            logger.warn('[Claude] Could not fetch orgId during login:', e);
            orgId = null;
          }
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
            sessionKeyExpiresAt: data.sessionKeyExpiresAt ?? null,
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
    const client = new ClaudeHttpClient({
      baseURL: BASE_URL,
      headers: buildClaudeHeaders(cookies),
    });
    const res = await client.get('/api/organizations');
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.error?.message ?? body?.message ?? JSON.stringify(body);
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(
        `Claude /api/organizations returned ${res.status}${detail ? `: ${detail}` : ''}`,
      );
    }
    const data = (await res.json()) as
      | Array<{ uuid?: string }>
      | { organizations?: Array<{ uuid?: string }> };
    const list = Array.isArray(data)
      ? data
      : (data as any)?.organizations || [];
    const firstId = list[0]?.uuid;
    return typeof firstId === 'string' ? firstId : null;
  }

  // ─── Fetch Conversation ─────────────────────────────────────────────

  /**
   * GET conversation để lấy danh sách message + current_leaf_message_uuid.
   * Dùng khi cần tìm `parent_message_uuid` của assistant message cuối để retry.
   */
  private async fetchConversation(
    credential: ClaudeCredential,
    conversationId: string,
  ): Promise<ClaudeConversationResponse> {
    const client = new ClaudeHttpClient({
      baseURL: BASE_URL,
      headers: buildClaudeHeaders(
        credential.cookies,
        `${BASE_URL}${REFERER_PATHS.CHAT_PREFIX}${conversationId}`,
      ),
    });
    const res = await client.get(
      API_PATHS.CONVERSATION(credential.organizationId!, conversationId),
    );
    if (!res.ok) {
      throw new Error(
        `Claude GET conversation returned ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    return (await res.json()) as ClaudeConversationResponse;
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
      try {
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
              'Claude credential missing organizationId and /api/organizations returned no organizations.',
            ),
          );
          return;
        }
      } catch (err: any) {
        onError(err);
        return;
      }
    }

    // Conversation ID: ưu tiên từ ref_file_ids (Claude: file gắn với convId cụ thể),
    // sau đó dùng conversationId được truyền vào, cuối cùng sinh mới.
    let convId = conversationId || randomUUID();

    // ── Dispatch sang retryMessage nếu có parent_message_id ────────────
    if (options.parent_message_id && convId) {
      return this.retryMessage({ ...options, conversationId: convId }, cred);
    }

    try {
      // ── Upload file đính kèm (nếu có) ──────────────────────────────
      const fileUuids: string[] = [];
      if (ref_file_ids && ref_file_ids.length > 0) {
        for (const ref of ref_file_ids) {
          const asAny = ref as any;

          // Nhánh 1: raw file có buffer → upload trực tiếp
          if (asAny?.buffer && asAny?.originalname && asAny?.mimetype) {
            const uploadRes = await this.uploadFileRaw(
              cred,
              convId,
              asAny as ClaudeUploadFileInput,
            );
            fileUuids.push(uploadRes.file_uuid);
          }
          // Nhánh 2: đã upload trước qua /upload endpoint → có file_id + conversation_id
          // Upload service normalize file_uuid → file_id, và trả thêm conversation_id.
          else if (typeof ref === 'object' && ref !== null && 'file_id' in asAny) {
            fileUuids.push(asAny.file_id as string);
            // Dùng conversation_id từ upload để đảm bảo file và message cùng conversation
            if (asAny.conversation_id && !conversationId) {
              convId = asAny.conversation_id as string;
            }
          }
          // Nhánh 3: object có file_uuid trực tiếp (legacy format)
          else if (typeof ref === 'object' && ref !== null && 'file_uuid' in ref) {
            fileUuids.push((ref as { file_uuid: string }).file_uuid);
          }
          // Nhánh 4: string thuần
          else if (typeof ref === 'string') {
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
        attachments: [],
        sync_sources: [],
        completion_request_id: randomUUID(),
        rendering_mode: DEFAULT_RENDERING_MODE,
        create_conversation_params: {
          name: '',
          model: baseModel,
          include_conversation_preferences: true,
          chat_memory_mode: DEFAULT_CHAT_MEMORY_MODE,
          tool_search_mode: 'auto',
          is_temporary: false,
          enabled_imagine: true,
        },
      };

      if (fileUuids.length > 0) {
        payload.files = fileUuids;
      }

      // ── Gửi completion request ─────────────────────────────────────
      // Referer phải là /new (khớp với traffic thực tế Claude.ai)
      // Không dùng /chat/{convId} vì Claude.ai dùng /new cho cả upload lẫn completion.
      const referer = `${BASE_URL}${REFERER_PATHS.NEW}`;
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
        const rawText = await response.text();
        let detail = rawText.slice(0, 500);
        let parsedBody: any = null;
        try {
          parsedBody = JSON.parse(rawText);
          detail = parsedBody?.error?.message ?? parsedBody?.message ?? detail;
        } catch {
          /* keep rawText slice */
        }
        const message = `Claude API returned ${response.status}: ${rawText.slice(0, 500)}`;
        if (response.status === 401 || response.status === 403) {
          const err = new Error(
            `Session expired or invalid. Please re-login to Claude. (${message})`,
          );
          (err as any).isAuthError = true;
          (err as any).statusCode = response.status;
          throw err;
        }
        // Xử lý lỗi 429 hết usage tạm thời (exceeded_limit) — có resetsAt
        if (
          response.status === 429 &&
          parsedBody?.type === 'exceeded_limit' &&
          parsedBody?.resetsAt
        ) {
          const resetsAt = new Date(parsedBody.resetsAt * 1000).toISOString();
          const err = new Error(message);
          (err as any).isUsageLimitError = true;
          (err as any).resetsAt = resetsAt;
          throw err;
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('Claude API returned empty response body (no stream)');
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

  // ─── Retry / Regenerate Message ────────────────────────────────────

  /**
   * Regenerate hoặc edit+regenerate response từ 1 parent message cụ thể.
   *
   * Flow:
   * 1. Nếu caller truyền `parent_message_id` → dùng trực tiếp làm
   *    `parent_message_uuid` trong payload (UUID của human message).
   * 2. Nếu không (chỉ có `conversationId`) → GET conversation để lấy
   *    `parent_message_uuid` của assistant message leaf hiện tại, rồi
   *    dùng `parent_message_uuid` của assistant đó (= human message trước nó).
   * 3. Gọi `POST /retry_completion` với payload retry.
   *
   * Tương đương DeepSeek `parent_message_id` pattern.
   */
  private async retryMessage(
    options: SendMessageOptions,
    cred: ClaudeCredential,
  ): Promise<void> {
    const {
      messages,
      model,
      onContent,
      onThinking,
      onRaw,
      onMetadata,
      onDone,
      onError,
      conversationId,
    } = options;

    const convId = conversationId!;

    try {
      // ── Xác định parent_message_uuid ───────────────────────────────
      // Caller truyền parent_message_id = UUID của human message muốn retry từ đó.
      // Nếu không có → fetch conversation để lấy parent của leaf assistant message.
      let parentMessageUuid: string;

      if (options.parent_message_id) {
        parentMessageUuid = options.parent_message_id;
      } else {
        // Fallback: lấy từ conversation
        const conv = await this.fetchConversation(cred, convId);
        const messages = conv.chat_messages || [];
        // Tìm leaf assistant message (message được trỏ bởi current_leaf_message_uuid)
        const leafUuid = conv.current_leaf_message_uuid;
        const leafMsg = leafUuid
          ? messages.find((m) => m.uuid === leafUuid)
          : [...messages].reverse().find((m) => m.sender === 'assistant');

        if (!leafMsg?.parent_message_uuid) {
          throw new Error(
            'Cannot determine parent_message_uuid for retry: conversation has no assistant message',
          );
        }
        parentMessageUuid = leafMsg.parent_message_uuid;
      }

      // ── Build retry payload ────────────────────────────────────────
      const lastMessage = messages[messages.length - 1];
      // Prompt rỗng = regenerate giữ nguyên; có nội dung = edit message
      const prompt = lastMessage?.content || '';
      const isEdit = prompt.length > 0;

      const { base: baseModel, effort: parsedEffort } =
        splitModelAndEffort(model);
      const effort = parsedEffort || DEFAULT_EFFORT;
      const thinkingMode =
        options.thinking === false ? THINKING_MODES.OFF : DEFAULT_THINKING_MODE;
      const tools = options.search === true ? [WEB_SEARCH_TOOL] : [];

      const payload: ClaudeRetryCompletionPayload = {
        prompt,
        parent_message_uuid: parentMessageUuid,
        timezone: DEFAULT_TIMEZONE,
        locale: DEFAULT_LOCALE,
        model: baseModel,
        effort,
        thinking_mode: thinkingMode,
        tools,
        turn_message_uuids: {
          assistant_message_uuid: randomUUID(),
        },
        attachments: [],
        files: [],
        sync_sources: [],
        completion_request_id: randomUUID(),
        rendering_mode: DEFAULT_RENDERING_MODE,
      };

      // ── Gửi retry_completion request ──────────────────────────────
      // Referer /new khớp với traffic thực tế Claude.ai
      const referer = `${BASE_URL}${REFERER_PATHS.NEW}`;
      const client = new ClaudeHttpClient({
        baseURL: BASE_URL,
        headers: {
          ...buildClaudeHeaders(cred.cookies, referer),
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.SSE,
        },
      });

      const url = API_PATHS.RETRY_COMPLETION(cred.organizationId!, convId);
      const response = await client.streamSSE(url, {
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const rawText = await response.text();
        let detail = rawText.slice(0, 500);
        try {
          const parsedBody = JSON.parse(rawText);
          detail = parsedBody?.error?.message ?? parsedBody?.message ?? detail;
        } catch {
          /* keep rawText slice */
        }
        const message = `Claude retry_completion returned ${response.status}: ${rawText.slice(0, 500)}`;
        if (response.status === 401 || response.status === 403) {
          const err = new Error(
            `Session expired or invalid. Please re-login to Claude. (${message})`,
          );
          (err as any).isAuthError = true;
          (err as any).statusCode = response.status;
          throw err;
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          'Claude retry_completion returned empty response body (no stream)',
        );
      }

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
      logger.error('[Claude] Error in retryMessage:', err);
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
   * @param credential     Credential JSON string hoặc raw cookie.
   * @param file           Buffer + metadata.
   * @param conversationId UUID conversation do client sinh — bắt buộc để file
   *                       gắn đúng conversation khi gửi completion. Nếu không
   *                       truyền sẽ sinh UUID mới (fallback).
   */
  async uploadFile(
    credential: string,
    file: ClaudeUploadFileInput,
    conversationId?: string,
  ): Promise<{ file_uuid: string; conversation_id: string }> {
    try {
      const cred = this.parseCredential(credential);
      const convId = conversationId || randomUUID();
      const result = await this.uploadFileRaw(cred, convId, file);
      return { file_uuid: result.file_uuid, conversation_id: convId };
    } catch (err: any) {
      logger.error('[Claude] Error in uploadFile:', err);
      throw err;
    }
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
