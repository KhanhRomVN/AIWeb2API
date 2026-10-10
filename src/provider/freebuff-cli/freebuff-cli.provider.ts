/**
 * ------------------------------------------------------------------
 * Freebuff CLI Provider
 * ------------------------------------------------------------------
 * Provider xử lý giao thức Bearer/CLI với upstream codebuff.com.
 *
 * Giao thức này khác hoàn toàn so với freebuff (web/cookie):
 * - Host: https://www.codebuff.com (không phải freebuff.com)
 * - Auth: Authorization: Bearer <token>
 * - Cần tạo session → agent run → rồi mới chat
 *
 * Luồng gửi tin nhắn:
 * 1. ensureSession() → POST /api/v1/freebuff/session
 * 2. startRun()      → POST /api/v1/agent-runs { action:"START" }
 * 3. chat()          → POST /api/v1/chat/completions (SSE stream)
 * 4. finishRun()     → POST /api/v1/agent-runs { action:"FINISH" }
 *
 * Credential format: raw Bearer token string
 * ------------------------------------------------------------------
 */

// ─── Imports ─────────────────────────────────────────────────────────────

import fetch from 'node-fetch';
import { randomUUID } from 'crypto';
import { Provider, SendMessageOptions } from '../../types/index';
import { loginService } from '../../services/login.service';
import { createLogger } from '../../utils/logger';
import { countMessagesTokens } from '../../utils/tokenizer';
import {
  FreebuffCliCredential,
  FreebuffCliAgentRunRequest,
  FreebuffCliAgentRunResponse,
  FreebuffCliChatPayload,
  FreebuffCliChatMessage,
} from './freebuff-cli.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  AUTH_LOGIN_URL,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  CAN_REGENERATE,
  REQUEST_LIMIT,
  REQUEST_LIMIT_PERIOD,
  BLOCKED_TIME_RANGES,
  BASE_URL,
  API_PATHS,
  BEARER_PREFIX,
  BEARER_USER_AGENT,
  HTTP_HEADER_NAMES,
  MODELS,
  DEFAULT_MODEL_ID,
  THINKING_MODEL_EFFORTS,
  THINKING_MODEL_DEFAULT_EFFORT,
  FREEBUFF_CLI_EVENTS,
  RETRY_CONFIG,
  AGENT_CONFIG,
} from './freebuff-cli.constant';
import { parseFreebuffCliSSE } from './freebuff-cli.sse-parser';
import {
  generateInstanceId,
  ensureSession,
  FreebuffCliSessionMgr,
} from './freebuff-cli.session';

// ─── Logger ──────────────────────────────────────────────────────────────

const logger = createLogger('FreebuffCliProvider');

// ─── Provider Class ───────────────────────────────────────────────────────

export class FreebuffCliProvider implements Provider {
  name = PROVIDER_NAME;

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
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    can_regenerate: CAN_REGENERATE,
    blocked_time_ranges: BLOCKED_TIME_RANGES,
  };

  usagePolicy: NonNullable<Provider['usagePolicy']> = {
    requestLimit: REQUEST_LIMIT,
    requestLimitPeriod: REQUEST_LIMIT_PERIOD,
    blockedTimeRanges: BLOCKED_TIME_RANGES,
  };

  // ─── Credential Helpers ───────────────────────────────────────────────

  /**
   * Parse credential string thành FreebuffCliCredential.
   * Hỗ trợ:
   * - Raw Bearer token string
   * - JSON string { token } hoặc { secretKey } hoặc { accessToken }
   */
  private parseCredential(credential: string): FreebuffCliCredential {
    if (!credential) return { token: '' };
    const trimmed = credential.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const token =
          parsed.token ??
          parsed.secretKey ??
          parsed.secret_key ??
          parsed.accessToken ??
          parsed.access_token ??
          '';
        if (token) return { token };
      } catch {
        // Fall through
      }
    }
    // Raw token (có thể có prefix "Bearer ")
    const raw = trimmed.startsWith(BEARER_PREFIX)
      ? trimmed.slice(BEARER_PREFIX.length).trim()
      : trimmed;
    return { token: raw };
  }

  // ─── Build Headers ────────────────────────────────────────────────────

  private buildHeaders(
    token: string,
    extra?: Record<string, string>,
  ): Record<string, string> {
    return {
      [HTTP_HEADER_NAMES.AUTHORIZATION]: `${BEARER_PREFIX}${token}`,
      'Content-Type': 'application/json',
      [HTTP_HEADER_NAMES.USER_AGENT]: BEARER_USER_AGENT,
      ...(extra ?? {}),
    };
  }

  // ─── Reasoning Effort ─────────────────────────────────────────────────

  private resolveReasoningEffort(
    modelId: string,
    options: SendMessageOptions,
  ): string | null {
    const efforts = THINKING_MODEL_EFFORTS[modelId];
    if (!efforts) return null;
    if (options.thinking === false) return null;
    return THINKING_MODEL_DEFAULT_EFFORT[modelId] ?? efforts[efforts.length - 1];
  }

  // ─── Login ────────────────────────────────────────────────────────────

  async login() {
    return await loginService.captureCredentialsViaCDP({
      providerId: PROVIDER_ID,
      loginUrl: AUTH_LOGIN_URL,
      partition: `freebuff-cli_${Date.now()}`,
      cookieEvent: FREEBUFF_CLI_EVENTS.LOGIN_TOKEN,
      infoEvent: FREEBUFF_CLI_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: Record<string, string>;
        email?: string;
      }) => {
        // data.cookies chứa Bearer token được trích từ header Authorization
        const token = data.cookies;
        if (!token) return { isValid: false };

        const profile = await this.getUserProfile(token);
        if (profile?.email) {
          return {
            isValid: true,
            email: profile.email,
            cookies: token,
          };
        }
        return { isValid: false };
      },
    });
  }

  // ─── User Profile ─────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const { token } = this.parseCredential(credential);
    if (!token) return { email: null };

    try {
      // Thử lấy thông tin qua session endpoint
      const res = await fetch(`${BASE_URL}${API_PATHS.FREEBUFF_SESSION}`, {
        method: 'POST',
        headers: this.buildHeaders(token),
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        // Server có thể trả email trong session response
        const email = json?.email ?? json?.user?.email ?? null;
        const name = json?.name ?? json?.user?.name;
        return { email, name };
      }
    } catch (err) {
      logger.warn('[FreebuffCLI] getUserProfile error:', err);
    }
    return { email: null };
  }

  // ─── Agent Run ────────────────────────────────────────────────────────

  private async startRun(token: string): Promise<string | null> {
    try {
      const body: FreebuffCliAgentRunRequest = {
        action: 'START',
        agentId: AGENT_CONFIG.ROOT_AGENT_ID,
        ancestorRunIds: [],
      };
      const res = await fetch(`${BASE_URL}${API_PATHS.AGENT_RUNS}`, {
        method: 'POST',
        headers: this.buildHeaders(token),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        logger.warn(`[FreebuffCLI] startRun failed (${res.status})`);
        return null;
      }
      const json = (await res.json()) as FreebuffCliAgentRunResponse;
      return json.runId ?? null;
    } catch (err) {
      logger.warn('[FreebuffCLI] startRun error:', err);
      return null;
    }
  }

  private async finishRun(token: string, runId: string): Promise<void> {
    try {
      const body: FreebuffCliAgentRunRequest = {
        action: 'FINISH',
        runId,
        status: 'completed',
        totalSteps: 1,
      };
      await fetch(`${BASE_URL}${API_PATHS.AGENT_RUNS}`, {
        method: 'POST',
        headers: this.buildHeaders(token),
        body: JSON.stringify(body),
      });
    } catch (err) {
      logger.warn('[FreebuffCLI] finishRun error:', err);
    }
  }

  // ─── Build Messages ───────────────────────────────────────────────────

  /**
   * Chuyển đổi OpenAI messages format thành mảng FreebuffCliChatMessage.
   * Content phức tạp (array) → join thành string (CLI không hỗ trợ ảnh).
   */
  private buildMessages(
    messages: SendMessageOptions['messages'],
  ): FreebuffCliChatMessage[] {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .map((m) => {
        let content = '';
        if (typeof m.content === 'string') {
          content = m.content;
        } else if (Array.isArray(m.content)) {
          content = (m.content as Array<any>)
            .filter((p) => p.type === 'text' || typeof p === 'string')
            .map((p) => p.text ?? p)
            .join('\n');
        }
        return {
          role: m.role as 'user' | 'assistant' | 'system',
          content,
        };
      });
  }

  // ─── Handle Message ───────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onMetadata,
      onSessionCreated,
      onDone,
      onError,
      onRaw,
    } = options;

    const { token } = this.parseCredential(credential);
    if (!token) {
      onError(new Error('FreebuffCLI: invalid credential (empty token)'));
      return;
    }

    const modelId = model?.trim() || DEFAULT_MODEL_ID;
    let runId: string | null = null;
    let sessionMgr: FreebuffCliSessionMgr | null = null;

    try {
      // ── Step 1: Ensure session ─────────────────────────────────────
      const sessionId = await ensureSession(token, modelId);
      if (onSessionCreated) onSessionCreated(sessionId);
      if (onMetadata) onMetadata({ conversation_id: sessionId });

      // ── Step 2: Start heartbeat ────────────────────────────────────
      sessionMgr = new FreebuffCliSessionMgr(token, sessionId);
      sessionMgr.start();

      // ── Step 3: Start agent run ────────────────────────────────────
      runId = await this.startRun(token);

      // ── Step 4: Build chat payload ─────────────────────────────────
      const instanceId = generateInstanceId(token);
      const clientId = randomUUID();

      const builtMessages = this.buildMessages(messages);
      const reasoningEffort = this.resolveReasoningEffort(modelId, options);

      const payload: FreebuffCliChatPayload = {
        model: modelId,
        messages: builtMessages,
        stream: true,
        reasoning_effort: reasoningEffort,
        codebuff_metadata: {
          run_id: runId ?? randomUUID(),
          cost_mode: AGENT_CONFIG.COST_MODE,
          client_id: clientId,
          freebuff_instance_id: instanceId,
        },
      };

      // ── Step 5: Send chat request ──────────────────────────────────
      const chatHeaders = this.buildHeaders(token, {
        Accept: 'text/event-stream',
      });

      let response = await fetch(`${BASE_URL}${API_PATHS.CHAT_COMPLETIONS}`, {
        method: 'POST',
        headers: chatHeaders,
        body: JSON.stringify(payload),
      });

      // Auth error → không retry, báo lỗi rõ ràng
      if ((RETRY_CONFIG.AUTH_ERROR_CODES as readonly number[]).includes(response.status)) {
        const errText = await response.text().catch(() => '');
        const authErr = new Error(
          `FreebuffCLI: authentication failed (${response.status}). Please re-login. ${errText.slice(0, 100)}`,
        );
        (authErr as any).isAuthError = true;
        (authErr as any).statusCode = response.status;
        throw authErr;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(
          `FreebuffCLI: chat request failed (${response.status}): ${errText.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error('FreebuffCLI: empty response body from chat stream');
      }

      // ── Step 6: Parse SSE stream ───────────────────────────────────
      const promptTokens = countMessagesTokens(messages);
      const completionTokensRef = { value: 0 };

      await parseFreebuffCliSSE(response.body as NodeJS.ReadableStream, {
        onContent,
        onThinking,
        onMetadata: onMetadata
          ? (meta) => onMetadata(meta as any)
          : undefined,
        onRaw,
        promptTokens,
        completionTokensRef,
      });

      onDone();
    } catch (err: any) {
      logger.error('[FreebuffCLI] handleMessage error:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        model: modelId,
      });
      onError(err);
    } finally {
      // ── Cleanup: stop heartbeat + finish run ───────────────────────
      if (sessionMgr) {
        sessionMgr.stop();
      }
      if (runId && token) {
        // Fire-and-forget — không block response
        this.finishRun(token, runId).catch(() => {});
      }
    }
  }
}

export default new FreebuffCliProvider();
