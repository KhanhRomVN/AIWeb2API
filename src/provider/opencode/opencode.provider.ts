/**
 * ------------------------------------------------------------------
 * OpenCode Provider
 * ------------------------------------------------------------------
 * Provider điều khiển backend `opencode serve` (OpenCode 1.x) qua
 * @opencode-ai/sdk. Mỗi request = 1 session mới, xoá khi xong/lỗi.
 *
 * Main features:
 * - getModels()      : Liệt kê model từ config.providers()
 * - getUserProfile() : Health check backend, trả định danh theo host
 * - uploadFile()     : Chỉ ảnh -> data URI (không có upload thật)
 * - handleMessage()  : Stream qua event backend, fallback polling,
 *                      retry lỗi transient khi chưa phát gì ra client
 *
 * Tool call: parse markup trong text model, emit marker
 *   \n__OPENCODE_TOOL__:{"name","id","input"}__END_TOOL__\n
 *
 * Credential format: JSON string `{ serverUrl, password?, zenApiKey? }`
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Types ──
import { Provider, SendMessageOptions } from '../../types/index';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { countMessagesTokens, countTokens } from '../../utils/tokenizer';

// ── Shared ──
import { DEFAULT_PROVIDER_CONFIG } from '../_shared/default-provider-config';

// ── OpenCode ──
import { proxyHandler } from './opencode.proxy-handler';
import { ensureBackend } from './opencode.backend';
import {
  checkHealth,
  getClient,
  listProviders,
  parseCredential,
  resolveModel,
} from './opencode.client';
import { collectFromEvents, pollForAssistantResponse } from './opencode.sse-parser';
import { createMarkupHoldback, parseToolCalls } from './opencode.tool-parser';
import {
  OpenCodeFileRef,
  opencodeUploadFile,
  buildFilePartsFromRefs,
} from './opencode.upload';
import {
  OpenCodeAssistantError,
  OpenCodeAssistantResult,
  OpenCodeClientLike,
  OpenCodeModelRef,
  OpenCodePromptPart,
} from './opencode.types';
import {
  AUTH_METHOD,
  AUTO_BOOTSTRAP_ACCOUNT,
  CAN_REGENERATE,
  CONNECTION_TYPE,
  EVENT_FIRST_DELTA_TIMEOUT_MS,
  EVENT_IDLE_TIMEOUT_MS,
  EXTERNAL_TOOL_GUARD_MESSAGE,
  MAX_INPUT_TOKEN,
  MODEL_FREE_SUFFIX,
  OPENCODE_TOOL_MARKER,
  PROVIDER_COLOR,
  PROVIDER_DESCRIPTION,
  PROVIDER_ID,
  PROVIDER_NAME,
  REQUEST_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  RETRY_MAX_ATTEMPTS,
  SESSION_TITLE_PREFIX,
  TOOL_POLICY_NONE,
  TRANSIENT_ERROR_REGEX,
  TRANSIENT_STATUS_CODES,
  TRANSIENT_STATUS_MIN_SERVER_ERROR,
  WEBSITE_URL,
  MODEL_DEFAULT_CREATED,
} from './opencode.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('OpenCodeProvider');

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface AttemptState {
  /** `true` khi đã phát byte nào ra client → không được retry. */
  emitted: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function toError(err: OpenCodeAssistantError): Error {
  const message = err.data?.message || err.message || err.name || 'OpenCode error';
  return Object.assign(new Error(message), { statusCode: err.data?.statusCode });
}

function isTransientError(e: unknown): boolean {
  const err = e as { message?: string; statusCode?: number; status?: number };
  const status = err?.statusCode ?? err?.status;
  if (typeof status === 'number') {
    if (TRANSIENT_STATUS_CODES.includes(status)) return true;
    if (status >= TRANSIENT_STATUS_MIN_SERVER_ERROR) return true;
  }
  return TRANSIENT_ERROR_REGEX.test(String(err?.message || ''));
}

// ─── Provider Class ─────────────────────────────────────────────────────

export class OpenCodeProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;

  static config = {
    ...DEFAULT_PROVIDER_CONFIG,
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    can_regenerate: CAN_REGENERATE,
    max_input_token: MAX_INPUT_TOKEN,
    auto_bootstrap_account: AUTO_BOOTSTRAP_ACCOUNT,
  };

  // ─── Profile ──────────────────────────────────────────────────────────

  // ─── Login ────────────────────────────────────────────────────────────

  /**
   * Không mở browser: nhận `{ serverUrl, password? }`, health check
   * backend rồi trả credential JSON.
   */
  async login(options?: {
    serverUrl?: string;
    password?: string;
  }) {
    const cred = parseCredential(
      JSON.stringify({
        serverUrl: options?.serverUrl,
        password: options?.password,
      }),
    );
    await ensureBackend(cred);
    return {
      email: `opencode@${new URL(cred.serverUrl).host}`,
      cookies: JSON.stringify(cred),
    };
  }
  /**
   * OpenCode không có tài khoản/email. Health check backend, rồi dùng
   * `opencode@<host>` làm định danh account.
   */
  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string }> {
    try {
      const cred = parseCredential(credential);
      await checkHealth(cred);
      const host = new URL(cred.serverUrl).host;
      return { email: `opencode@${host}`, name: host };
    } catch (e) {
      logger.error('[OpenCode] getUserProfile failed:', e);
      return { email: null };
    }
  }

  // ─── Models ───────────────────────────────────────────────────────────

  /** Throw khi backend lỗi — không trả danh sách giả. */
  async getModels(credential: string, _accountId?: string): Promise<any[]> {
    const cred = parseCredential(credential);
    await ensureBackend(cred);
    const client = await getClient(cred);
    const providers = await listProviders(client);

    const models: any[] = [];
    for (const p of providers) {
      for (const id of Object.keys(p.models ?? {})) {
        if (!id.endsWith(MODEL_FREE_SUFFIX)) continue;
        const info = p.models![id];
        const released = info.release_date ? Date.parse(info.release_date) : NaN;
        models.push({
          id: `${p.id}/${id}`,
          name: info.name || id,
          owned_by: p.id,
          created: Number.isFinite(released)
            ? Math.floor(released / 1000)
            : MODEL_DEFAULT_CREATED,
          is_thinking: !!info.reasoning,
          max_context_length: info.limit?.context ?? null,
          is_search: false,
          is_image_upload: !!info.attachment,
          is_video_upload: false,
          is_audio_upload: false,
          is_file_upload: false,
          is_larger_content_paste_upload: false,
          is_image_generator: false,
          is_video_generator: false,
          is_deep_research: false,
        });
      }
    }
    return models;
  }

  // ─── Upload ───────────────────────────────────────────────────────────

  async uploadFile(_credential: string, file: Express.Multer.File) {
    return opencodeUploadFile({
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
    });
  }

  // ─── Prompt Building ──────────────────────────────────────────────────

  /** system -> `system`; user/assistant -> 1 text part `ROLE: nội dung`; ảnh -> file part. */
  private async buildPrompt(
    messages: SendMessageOptions['messages'],
    refs: SendMessageOptions['ref_file_ids'],
  ): Promise<{ system: string; parts: OpenCodePromptPart[] }> {
    const systemChunks: string[] = [];
    const parts: OpenCodePromptPart[] = [];

    for (const m of messages) {
      if (!m?.content) continue;
      if (m.role === 'system') systemChunks.push(m.content);
      else parts.push({ type: 'text', text: `${m.role.toUpperCase()}: ${m.content}` });
    }
    if (!parts.length) throw new Error('Nội dung tin nhắn không được để trống.');

    parts.push(...(await buildFilePartsFromRefs(refs as OpenCodeFileRef[] | undefined)));
    systemChunks.push(EXTERNAL_TOOL_GUARD_MESSAGE);
    return { system: systemChunks.join('\n\n'), parts };
  }

  // ─── Handle Message ───────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { credential, messages, model, ref_file_ids, onDone, onError } = options;

    try {
      const cred = parseCredential(credential);
      await checkHealth(cred);
      const client = await getClient(cred);
      const modelRef = await resolveModel(client, model);
      const { system, parts } = await this.buildPrompt(messages, ref_file_ids);

      const state: AttemptState = { emitted: false };
      for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt += 1) {
        try {
          await this.runOnce(client, modelRef, system, parts, options, state);
          break;
        } catch (e) {
          if (state.emitted || attempt === RETRY_MAX_ATTEMPTS || !isTransientError(e)) {
            throw e;
          }
          logger.warn(`[OpenCode] Lỗi transient, retry ${attempt}:`, (e as Error).message);
          await sleep(RETRY_BACKOFF_MS * attempt);
        }
      }
      onDone();
    } catch (error) {
      logger.error('[OpenCode] Error in handleMessage:', error);
      onError(error);
    }
  }

  // ─── Single Attempt ───────────────────────────────────────────────────

  /** 1 lần chạy = 1 session mới; session luôn bị xoá ở `finally`. */
  private async runOnce(
    client: OpenCodeClientLike,
    modelRef: OpenCodeModelRef,
    system: string,
    parts: OpenCodePromptPart[],
    options: SendMessageOptions,
    state: AttemptState,
  ): Promise<void> {
    const { messages, onContent, onThinking, onMetadata } = options;
    let sessionId: string | null = null;

    try {
      const title = `${SESSION_TITLE_PREFIX} [tools:${TOOL_POLICY_NONE}]`;
      const created = await client.session.create({ body: { title } });
      sessionId = created?.data?.id ?? created?.id ?? null;
      if (!sessionId) throw new Error('OpenCode không tạo được session.');
      const sid = sessionId;

      try {
        await client.config.update({ body: { activeModel: modelRef } });
      } catch {
        // best-effort
      }

      const promptParams = {
        path: { id: sid },
        body: { model: modelRef, system, parts },
      };

      const holdback = createMarkupHoldback();
      let fedContent = '';
      let completionText = '';

      const emitText = (text: string) => {
        if (!text) return;
        state.emitted = true;
        completionText += text;
        onContent(text);
      };
      const feed = (delta: string) => {
        fedContent += delta;
        emitText(holdback.push(delta));
      };

      // ── Thu delta qua event, bắn prompt song song sau khi subscribe ──
      let rejectPrompt: (e: unknown) => void = () => undefined;
      const promptFailed = new Promise<never>((_, rej) => {
        rejectPrompt = rej;
      });
      promptFailed.catch(() => undefined);

      const collected = collectFromEvents(
        client,
        sid,
        {
          timeoutMs: REQUEST_TIMEOUT_MS,
          firstDeltaTimeoutMs: EVENT_FIRST_DELTA_TIMEOUT_MS,
          idleTimeoutMs: EVENT_IDLE_TIMEOUT_MS,
          onDelta: (delta, isReasoning) => {
            if (isReasoning) {
              state.emitted = true;
              if (onThinking) onThinking(delta);
            } else {
              feed(delta);
            }
          },
        },
        () => {
          client.session.prompt(promptParams).catch(rejectPrompt);
        },
      );
      collected.catch(() => undefined);

      let result: OpenCodeAssistantResult = await Promise.race([collected, promptFailed]);

      // ── Fallback polling khi event stream không đủ ──
      const needPoll =
        !result.error &&
        (result.noData || result.idleTimeout || (!result.content && !result.reasoning));
      if (needPoll) {
        try {
          const polled = await pollForAssistantResponse(client, sid, REQUEST_TIMEOUT_MS);
          result = { ...polled, content: polled.content || result.content };
        } catch (e) {
          if (!result.content && !result.reasoning) throw e;
        }
      }

      if (result.error) throw toError(result.error);

      // ── Phát phần còn thiếu (cắt phần đã stream bằng startsWith) ──
      if (result.content.length > fedContent.length && result.content.startsWith(fedContent)) {
        feed(result.content.slice(fedContent.length));
      }

      // ── Kết thúc: text sót + tool call ──
      const { visible, markup } = holdback.flush();
      emitText(visible);
      if (markup) {
        const parsed = parseToolCalls(markup);
        emitText(parsed.text);
        for (const call of parsed.calls) {
          const payload = JSON.stringify({
            name: call.name,
            id: call.id,
            input: call.arguments,
          });
          emitText(`\n${OPENCODE_TOOL_MARKER.START}${payload}${OPENCODE_TOOL_MARKER.END}\n`);
        }
      }

      if (onMetadata) {
        onMetadata({
          total_token: countMessagesTokens(messages) + countTokens(completionText),
        });
      }
    } finally {
      if (sessionId) {
        try {
          await client.session.delete({ path: { id: sessionId } });
        } catch (e) {
          logger.warn('[OpenCode] Xoá session thất bại:', (e as Error).message);
        }
      }
    }
  }
}

export default new OpenCodeProvider();