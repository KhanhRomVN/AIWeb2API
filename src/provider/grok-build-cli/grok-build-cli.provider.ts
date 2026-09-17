/**
 * ------------------------------------------------------------------
 * Grok Build CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Grok Build CLI API với OAuth authentication.
 * Hỗ trợ streaming responses và token refresh.
 *
 * Main features:
 * - handleMessage()        : Gửi tin nhắn với streaming response
 * - OAuth authentication
 * - Token refresh support (với exponential backoff + jitter)
 *
 * Credential format (JSON string):
 * - accessToken            : OAuth access token
 * - refreshToken           : OAuth refresh token (optional)
 * - expiresAt              : Token expiration timestamp (optional)
 * - email                  : User email (optional, root or providerSpecificData)
 * - userId                 : User ID (optional, root or providerSpecificData)
 * - providerSpecificData   : Nested identity data (OmniRoute-compatible)
 *   - userId, email, teamId, tier, principalType, principalId, organizationId
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import fetch from 'node-fetch';
import * as os from 'os';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── SSE Parser ──
import { parseGrokBuildSSEStream } from './grok-build-cli.sse-parser';

// ── Grok Build Imports ──
import {
  GrokBuildCredentials,
  GrokBuildProviderData,
  GrokBuildRequestBody,
  GrokBuildReasoning,
  OAuthTokenResponse,
} from './grok-build-cli.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  RESPONSES_URL,
  MODELS_URL,
  TOKEN_URL,
  CLIENT_IDENTIFIER,
  TOKEN_AUTH,
  REASONING_INCLUDE,
  DEFAULT_CLIENT_VERSION,
  DEFAULT_REASONING_EFFORT,
  SUPPORTED_REASONING_EFFORTS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  UNSUPPORTED_PARAMS,
  MAX_TOOLS,
  REFRESH_MAX_ATTEMPTS,
  REFRESH_MIN_DELAY_MS,
  TERMINAL_REFRESH_ERRORS,
  DEVICE_CODE_URL,
  OAUTH_CLIENT_ID,
  OAUTH_SCOPES,
  OAUTH_REFERRER,
} from './grok-build-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GrokBuildCLIProvider');

const REASONING_EFFORT_SET = new Set(SUPPORTED_REASONING_EFFORTS);

// ─── Helper Functions ───────────────────────────────────────────────────

/** Return value only if it is a non-empty trimmed string, otherwise null. */
function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function parseCredential(credential: string): GrokBuildCredentials {
  if (credential.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(credential) as GrokBuildCredentials;
      return parsed;
    } catch (e) {
      logger.warn('[GrokBuildCLI] Failed to parse JSON credential:', e);
    }
  }

  // Fallback: treat as raw access token
  return { accessToken: credential };
}

/**
 * Resolve identity fields from credential, checking both providerSpecificData
 * (OmniRoute-compatible) and the legacy root fields for backward-compat.
 */
function resolveProviderData(
  credentials: GrokBuildCredentials,
): GrokBuildProviderData {
  const pd = credentials.providerSpecificData || {};
  return {
    userId: nonEmptyString(pd.userId) ?? nonEmptyString(credentials.userId),
    email: nonEmptyString(pd.email) ?? nonEmptyString(credentials.email),
    principalType:
      nonEmptyString(pd.principalType) ??
      nonEmptyString(credentials.principalType),
    principalId:
      nonEmptyString(pd.principalId) ?? nonEmptyString(credentials.principalId),
    teamId: nonEmptyString(pd.teamId) ?? null,
    organizationId: nonEmptyString(pd.organizationId) ?? null,
    tier: pd.tier,
  };
}

function mapPlatform(platform: string): string {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return platform;
}

function mapArch(arch: string): string {
  if (arch === 'arm64') return 'aarch64';
  if (arch === 'x64') return 'x86_64';
  return arch;
}

function getUserAgent(): string {
  const platform = mapPlatform(os.platform());
  const arch = mapArch(os.arch());
  return `${CLIENT_IDENTIFIER}/${DEFAULT_CLIENT_VERSION} (${platform}; ${arch})`;
}

function getClientHeaders(
  clientMode = 'headless',
): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_VERSION]: DEFAULT_CLIENT_VERSION,
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_IDENTIFIER]: CLIENT_IDENTIFIER,
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_MODE]: clientMode,
    [HTTP_HEADER_NAMES.USER_AGENT]: getUserAgent(),
  };
}

/**
 * Resolve the wire-email value. Returns null for team / organization
 * principal types (x-email must not be sent for those accounts).
 * Matches OmniRoute's getWireEmail logic exactly.
 */
function getWireEmail(
  email: string | null | undefined,
  principalType: string | null | undefined,
): string | null {
  const normalized = principalType?.trim().toLowerCase();
  return normalized === 'team' || normalized === 'organization'
    ? null
    : nonEmptyString(email);
}

/**
 * Build session headers for the Responses API endpoint.
 * Reads identity from resolved providerData so team/org accounts work correctly.
 */
function buildSessionHeaders(
  credentials: GrokBuildCredentials,
  providerData: GrokBuildProviderData,
  model?: string,
  stream = true,
): Record<string, string> {
  const wireEmail = getWireEmail(providerData.email, providerData.principalType);

  const headers: Record<string, string> = {
    [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [HTTP_HEADER_NAMES.ACCEPT]: stream
      ? CONTENT_TYPES.EVENT_STREAM
      : CONTENT_TYPES.JSON,
    ...getClientHeaders(),
    [HTTP_HEADER_NAMES.X_XAI_TOKEN_AUTH]: TOKEN_AUTH,
    [HTTP_HEADER_NAMES.X_AUTHENTICATE_RESPONSE]: 'authenticate-response',
    [HTTP_HEADER_NAMES.AUTHORIZATION]: `Bearer ${credentials.accessToken}`,
  };

  if (model) {
    headers[HTTP_HEADER_NAMES.X_GROK_MODEL_OVERRIDE] = model;
  }

  if (providerData.userId) {
    headers[HTTP_HEADER_NAMES.X_USERID] = providerData.userId;
    headers[HTTP_HEADER_NAMES.X_GROK_USER_ID] = providerData.userId;
  }

  if (wireEmail) {
    headers[HTTP_HEADER_NAMES.X_EMAIL] = wireEmail;
  }

  return headers;
}

/**
 * Build headers for OAuth token-endpoint requests (refresh / device code / token exchange).
 * Matches OmniRoute's getGrokBuildOAuthHeaders.
 */
function buildOAuthHeaders(
  surface: 'ui' | 'cli' | 'headless' = 'ui',
): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
    [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_VERSION]: DEFAULT_CLIENT_VERSION,
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_SURFACE]: surface,
  };
}

function ensureReasoningInclude(value: unknown): unknown[] {
  const include = Array.isArray(value) ? [...value] : [];
  if (!include.includes(REASONING_INCLUDE)) {
    include.push(REASONING_INCLUDE);
  }
  return include;
}

function normalizeReasoning(
  value: unknown,
  model: string,
): GrokBuildReasoning | null {
  const reasoning = (
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {}
  ) as GrokBuildReasoning;

  const hasExplicitEffort = Object.prototype.hasOwnProperty.call(
    reasoning,
    'effort',
  );

  if (
    !REASONING_EFFORT_SET.has(
      reasoning.effort as 'low' | 'medium' | 'high',
    )
  ) {
    delete reasoning.effort;
  }

  if (model === 'grok-composer-2.5-fast') {
    delete reasoning.effort;
  } else if (model === 'grok-4.5' && !hasExplicitEffort) {
    reasoning.effort = DEFAULT_REASONING_EFFORT as 'high';
  }

  return Object.keys(reasoning).length > 0 ? reasoning : null;
}

function stripUnsupportedParams(request: GrokBuildRequestBody): void {
  for (const param of UNSUPPORTED_PARAMS) {
    delete request[param];
  }
}

/**
 * Sanitize a single `function_call_output.output` value into a valid JSON
 * string (or plain text) before dispatching to Grok's strict JSON parser.
 *
 * Grok's cli-chat-proxy is stricter than OpenAI's Responses API and rejects
 * truncated / incomplete JSON strings or invalid `\uXXXX` escapes (#7611).
 */
function sanitizeFunctionCallOutput(output: unknown): string {
  if (output == null) return '';

  if (typeof output === 'string') {
    const value = output;
    // Try to round-trip through JSON parse/stringify to normalise.
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      // fall through
    }
    // Drop incomplete \u escapes (0-3 hex digits) that break strict JSON parsers.
    const repaired = value.replace(
      /\\u([0-9A-Fa-f]{0,3})(?![0-9A-Fa-f])/g,
      '',
    );
    try {
      return JSON.stringify(JSON.parse(repaired));
    } catch {
      // Replace lone surrogates to produce valid Unicode.
      return repaired.replace(/[\uD800-\uDFFF]/g, '\uFFFD');
    }
  }

  if (Array.isArray(output)) {
    const textParts = output
      .map((part) => {
        if (part && typeof part === 'object') {
          const rec = part as Record<string, unknown>;
          if (typeof rec.text === 'string') return rec.text;
        }
        return typeof part === 'string' ? part : JSON.stringify(part);
      })
      .join('\n');
    return sanitizeFunctionCallOutput(textParts);
  }

  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

/**
 * Walk the Responses API `input` array and sanitize any
 * `function_call_output.output` fields before dispatch.
 */
function sanitizeResponsesBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const input = body.input;
  if (!Array.isArray(input)) return body;

  let changed = false;
  const nextInput = input.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const rec = item as Record<string, unknown>;
    if (rec.type !== 'function_call_output') return item;
    const sanitized = sanitizeFunctionCallOutput(rec.output);
    if (sanitized === rec.output) return item;
    changed = true;
    return { ...rec, output: sanitized };
  });

  return changed ? { ...body, input: nextInput } : body;
}

/**
 * Normalize a single Chat Completions message into Responses API input item format.
 *
 * Grok's /v1/responses requires each input item to have `type: "message"`.
 * A raw Chat Completions message `{ role, content }` is missing this field,
 * causing 422. Matches OmniRoute's normalizeResponsesInputItem logic.
 *
 * Examples:
 *   { role: "user", content: "hi" }
 *     → { type: "message", role: "user", content: "hi" }
 *
 *   { type: "message", role: "user", content: "hi" }
 *     → (unchanged)
 */
function normalizeResponsesInputItem(item: unknown): unknown {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const rec = item as Record<string, unknown>;

  // Already has type — pass through
  if (rec.type) return rec;

  // Has role → Chat Completions message, add type: "message"
  if (rec.role) {
    return { type: 'message', ...rec };
  }

  // Plain text shorthand
  if (typeof rec.text === 'string') {
    return {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: rec.text }],
    };
  }

  return rec;
}

function transformRequestBody(
  model: string,
  body: unknown,
  stream: boolean,
): GrokBuildRequestBody {
  const transformed = (
    body && typeof body === 'object' && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>) }
      : {}
  ) as GrokBuildRequestBody;

  if (!transformed.model) {
    transformed.model = model || 'grok-composer-2.5-fast';
  }
  transformed.stream = !!stream;

  // ── Responses API requires `input`, not `messages` ──────────────────
  // Grok's /v1/responses endpoint uses `input[]`, not `messages[]`.
  // If the caller sent Chat Completions-shaped body (with `messages`),
  // promote it to `input` and normalize each item to Responses format.
  // Matches OmniRoute translator/index.ts normalizeOpenAIResponsesRequest logic.
  if (transformed.input == null && Array.isArray(transformed.messages)) {
    logger.debug('[GrokBuildCLI] transformRequestBody: promoting messages → input', {
      messageCount: (transformed.messages as unknown[]).length,
    });
    transformed.input = (transformed.messages as unknown[]).map(
      normalizeResponsesInputItem,
    );
    delete transformed.messages;
  } else if (Array.isArray(transformed.input)) {
    // Also normalize existing input[] items in case they lack `type`
    transformed.input = (transformed.input as unknown[]).map(
      normalizeResponsesInputItem,
    );
  }

  // Grok Build defaults
  if (transformed.store === undefined) transformed.store = false;
  transformed.include = ensureReasoningInclude(transformed.include);

  // Strip unsupported params
  stripUnsupportedParams(transformed);

  // Normalize reasoning
  const reasoning = normalizeReasoning(transformed.reasoning, model);
  if (reasoning) {
    transformed.reasoning = reasoning;
  } else {
    delete transformed.reasoning;
  }

  // Limit tools to MAX_TOOLS
  if (
    Array.isArray(transformed.tools) &&
    transformed.tools.length > MAX_TOOLS
  ) {
    transformed.tools = transformed.tools.slice(0, MAX_TOOLS);
  }

  // Sanitize tool-result payloads for Grok's strict JSON parser (#7611)
  return sanitizeResponsesBody(transformed) as GrokBuildRequestBody;
}

/**
 * Compute retry delay with exponential backoff and ±50 % jitter.
 * Prevents thundering herd when multiple requests need to refresh simultaneously.
 * Matches OmniRoute's getRefreshRetryDelayMs logic.
 */
function getRefreshRetryDelayMs(retryNumber: number): number {
  const baseDelay = Math.min(
    2_000,
    REFRESH_MIN_DELAY_MS * 2 ** Math.max(0, retryNumber - 1),
  );
  return Math.max(1, Math.round(baseDelay * (0.5 + Math.random())));
}

// ─── Provider Class ────────────────────────────────────────────────────

export class GrokBuildCLIProvider implements Provider {
  name = PROVIDER_NAME;

  // ─── Provider Configuration ────────────────────────────────────────
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
    is_memory: IS_MEMORY,
  };

  // ─── Profile ─────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const creds = parseCredential(credential);
    const pd = resolveProviderData(creds);
    return {
      email: pd.email ?? null,
      id: pd.userId ?? undefined,
    };
  }

  // ─── Login (Device Code Flow) ────────────────────────────────────────

  async login() {
    try {
      const clientId =
        process.env.GROK_OAUTH_CLIENT_ID ||
        process.env.GROK_BUILD_CLIENT_ID ||
        OAUTH_CLIENT_ID;

      const body = new URLSearchParams({
        client_id: clientId,
        scope: OAUTH_SCOPES.join(' '),
        referrer: OAUTH_REFERRER,
      });

      const response = await fetch(DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
          [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as any;
        throw new Error(
          errData.error_description || errData.error || `Device code request failed: ${response.status}`,
        );
      }

      const data = await response.json() as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        verification_uri_complete?: string;
        expires_in: number;
        interval: number;
      };

      const pollContext = JSON.stringify({
        device_code: data.device_code,
        client_id: clientId,
        interval: data.interval ?? 5,
      });

      return {
        success: true,
        pending: true,
        cookies: '',
        email: '',
        tempSessionId: pollContext,
        user_code: data.user_code,
        verification_url: data.verification_uri_complete || data.verification_uri,
        expires_in: data.expires_in,
        poll_interval: data.interval ?? 5,
      };
    } catch (error) {
      logger.error('[GrokBuildCLI] Login initiation failed:', error);
      throw error;
    }
  }

  /**
   * Poll một lần — gọi từ UI định kỳ đến khi done hoặc error.
   */
  async pollOnce(pollContext: string): Promise<{
    done: boolean;
    cookies?: string;
    email?: string;
    error?: string;
    account?: any;
  }> {
    let ctx: { device_code: string; client_id: string; interval: number };
    try {
      ctx = JSON.parse(pollContext);
    } catch {
      return { done: false, error: 'Invalid poll context' };
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: ctx.device_code,
        client_id: ctx.client_id,
      });

      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
          [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const data = await response.json().catch(() => ({})) as OAuthTokenResponse & {
        error?: string;
        error_description?: string;
      };

      if (response.ok && data.access_token) {
        const credential: GrokBuildCredentials = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
        };

        // Try to get email from userinfo endpoint
        let email = '';
        try {
          const userInfoRes = await fetch('https://auth.x.ai/oauth2/userinfo', {
            headers: { Authorization: `Bearer ${data.access_token}` },
            signal: AbortSignal.timeout(10_000),
          });
          if (userInfoRes.ok) {
            const userInfo = await userInfoRes.json() as { email?: string; sub?: string };
            email = userInfo.email || '';
          }
        } catch {
          // ignore
        }
        if (!email) {
          email = `grok-${Date.now()}@grok.local`;
        }

        return { done: true, cookies: JSON.stringify(credential), email };
      }

      const errCode = data.error;
      if (errCode === 'authorization_pending' || errCode === 'slow_down') {
        return { done: false };
      }
      if (errCode === 'access_denied') {
        return { done: false, error: 'User denied authorization' };
      }
      if (errCode === 'expired_token') {
        return { done: false, error: 'Device code expired. Please try again.' };
      }

      return { done: false, error: data.error_description || errCode || 'Token polling failed' };
    } catch (error) {
      logger.warn('[GrokBuildCLI] pollOnce error:', error);
      return { done: false };
    }
  }

  // ─── Token Refresh ──────────────────────────────────────────────────

  private async performRefresh(
    credentials: GrokBuildCredentials,
    attempt: number,
  ): Promise<Partial<GrokBuildCredentials> | null | undefined> {
    if (!credentials.refreshToken) {
      logger.warn('[GrokBuildCLI] No refresh token available');
      return null;
    }

    try {
      const pd = resolveProviderData(credentials);

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        // Resolve client_id: prefer env var, fall back to the public grok-shell client id.
        // An empty string would cause the server to reject the request immediately.
        client_id:
          process.env.GROK_OAUTH_CLIENT_ID ||
          process.env.GROK_BUILD_CLIENT_ID ||
          OAUTH_CLIENT_ID,
        refresh_token: credentials.refreshToken,
      });

      // Include principal fields for team / organization accounts.
      if (pd.principalType) body.set('principal_type', pd.principalType);
      if (pd.principalId) body.set('principal_id', pd.principalId);

      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: buildOAuthHeaders('ui'),
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await response
        .json()
        .catch(() => ({}))) as OAuthTokenResponse;

      if (!response.ok) {
        const errorCode = nonEmptyString(data.error);
        const isTerminal =
          attempt === REFRESH_MAX_ATTEMPTS ||
          (errorCode !== null && TERMINAL_REFRESH_ERRORS.has(errorCode));
        logger.warn(
          '[GrokBuildCLI] Token refresh failed:',
          response.status,
          errorCode,
        );
        return isTerminal ? null : undefined;
      }

      const accessToken = nonEmptyString(data.access_token);
      if (!accessToken) {
        logger.warn('[GrokBuildCLI] No access_token in refresh response');
        return attempt === REFRESH_MAX_ATTEMPTS ? null : undefined;
      }

      logger.info('[GrokBuildCLI] Token refreshed successfully');

      return {
        accessToken,
        refreshToken:
          nonEmptyString(data.refresh_token) || credentials.refreshToken,
      };
    } catch (error) {
      logger.warn(
        '[GrokBuildCLI] Token refresh error:',
        error instanceof Error ? error.message : String(error),
      );
      return attempt === REFRESH_MAX_ATTEMPTS ? null : undefined;
    }
  }

  private async refreshCredentials(
    credentials: GrokBuildCredentials,
  ): Promise<Partial<GrokBuildCredentials> | null> {
    for (let attempt = 1; attempt <= REFRESH_MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        const delayMs = getRefreshRetryDelayMs(attempt - 1);
        logger.debug(
          `[GrokBuildCLI] Retrying token refresh (${attempt}/${REFRESH_MAX_ATTEMPTS})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const refreshed = await this.performRefresh(credentials, attempt);
      if (refreshed !== undefined) return refreshed;
    }

    return null;
  }

  async refreshToken(refreshTokenStr: string): Promise<any> {
    const credentials: GrokBuildCredentials = {
      accessToken: '',
      refreshToken: refreshTokenStr,
    };
    return this.refreshCredentials(credentials);
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
    } = options;

    let credentials = parseCredential(credential);

    // Check if token needs refresh (within 5-minute window)
    const requestModel = model || 'grok-composer-2.5-fast';
    const providerData = resolveProviderData(credentials);

    try {
      const bodyObj = {
        model: requestModel,
        messages,
        stream: true,
      };

      const transformedBody = transformRequestBody(requestModel, bodyObj, true);
      const headers = buildSessionHeaders(
        credentials,
        providerData,
        requestModel,
        true,
      );

      logger.debug('[GrokBuildCLI] Sending request', {
        url: RESPONSES_URL,
        model: requestModel,
        inputCount: Array.isArray(transformedBody.input)
          ? transformedBody.input.length
          : null,
        messagesCount: Array.isArray(transformedBody.messages)
          ? transformedBody.messages.length
          : null,
        hasInput: transformedBody.input != null,
        hasMessages: transformedBody.messages != null,
        bodyKeys: Object.keys(transformedBody),
      });

      const response = await fetch(RESPONSES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedBody),
      });

      if (!response.ok) {
        // ── Log error details for debugging ─────────────────────────
        let errorBody: unknown = null;
        try {
          errorBody = await response.json();
        } catch {
          try {
            errorBody = await response.text();
          } catch {
            // ignore
          }
        }
        logger.error('[GrokBuildCLI] API error response', {
          status: response.status,
          statusText: response.statusText,
          model: requestModel,
          errorBody,
          bodyKeys: Object.keys(transformedBody),
          hasInput: transformedBody.input != null,
          hasMessages: transformedBody.messages != null,
        });

        if (response.status === 401) {
          // Attempt token refresh then retry once
          const refreshed = await this.refreshCredentials(credentials);
          if (refreshed) {
            credentials = { ...credentials, ...refreshed };
            const retryHeaders = buildSessionHeaders(
              credentials,
              providerData,
              requestModel,
              true,
            );

            logger.debug('[GrokBuildCLI] Retrying after token refresh');
            const retryResponse = await fetch(RESPONSES_URL, {
              method: 'POST',
              headers: retryHeaders,
              body: JSON.stringify(transformedBody),
            });

            if (!retryResponse.ok) {
              let retryErrorBody: unknown = null;
              try {
                retryErrorBody = await retryResponse.json();
              } catch {
                try {
                  retryErrorBody = await retryResponse.text();
                } catch {
                  // ignore
                }
              }
              logger.error('[GrokBuildCLI] Retry also failed', {
                status: retryResponse.status,
                retryErrorBody,
              });
              throw new Error(
                `Grok Build API returned ${retryResponse.status}`,
              );
            }

            await parseGrokBuildSSEStream(retryResponse.body as NodeJS.ReadableStream, {
              onContent,
              onThinking,
              onMetadata,
            });
            onDone();
            return;
          }
        }

        throw new Error(`Grok Build API returned ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      await parseGrokBuildSSEStream(response.body as NodeJS.ReadableStream, {
        onContent,
        onThinking,
        onMetadata,
      });
      onDone();
    } catch (err: any) {
      logger.error('[GrokBuildCLI] handleMessage error:', {
        message: err.message,
        stack: err.stack,
      });
      onError(err);
    }
  }

}

export default new GrokBuildCLIProvider();
