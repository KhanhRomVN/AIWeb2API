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
 * - Token refresh support
 *
 * Credential format (JSON string):
 * - accessToken    : OAuth access token
 * - refreshToken   : OAuth refresh token (optional)
 * - expiresAt      : Token expiration timestamp (optional)
 * - email          : User email (optional)
 * - userId         : User ID (optional)
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

// ── Grok Build Imports ──
import {
  GrokBuildCredentials,
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
} from './grok-build-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GrokBuildCLIProvider');

// ─── Helper Functions ───────────────────────────────────────────────────

function parseCredential(credential: string): GrokBuildCredentials {
  logger.debug('[GrokBuildCLI] parseCredential - input:', {
    type: typeof credential,
    length: credential?.length,
    preview: credential?.substring(0, 50),
  });

  if (credential.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(credential) as GrokBuildCredentials;
      logger.debug('[GrokBuildCLI] parseCredential - parsed JSON:', {
        hasAccessToken: !!parsed.accessToken,
        hasRefreshToken: !!parsed.refreshToken,
        hasEmail: !!parsed.email,
      });
      return parsed;
    } catch (e) {
      logger.warn('[GrokBuildCLI] Failed to parse JSON credential:', e);
    }
  }

  // Fallback: treat as raw access token
  return { accessToken: credential };
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

function getClientHeaders(clientMode = 'headless'): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_VERSION]: DEFAULT_CLIENT_VERSION,
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_IDENTIFIER]: CLIENT_IDENTIFIER,
    [HTTP_HEADER_NAMES.X_GROK_CLIENT_MODE]: clientMode,
    [HTTP_HEADER_NAMES.USER_AGENT]: getUserAgent(),
  };
}

function buildSessionHeaders(
  credentials: GrokBuildCredentials,
  model?: string,
  stream = true,
): Record<string, string> {
  const headers = {
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

  if (credentials.userId) {
    headers[HTTP_HEADER_NAMES.X_USERID] = credentials.userId;
    headers[HTTP_HEADER_NAMES.X_GROK_USER_ID] = credentials.userId;
  }

  if (credentials.email && credentials.principalType !== 'team') {
    headers[HTTP_HEADER_NAMES.X_EMAIL] = credentials.email;
  }

  return headers;
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
    !SUPPORTED_REASONING_EFFORTS.includes(
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

  return transformed;
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
    return {
      email: creds.email || null,
      id: creds.userId,
    };
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    throw new Error(
      'Grok Build CLI requires OAuth authentication. Please use device code flow.',
    );
  }

  // ─── Token Refresh ──────────────────────────────────────────────────

  private async refreshToken(
    credentials: GrokBuildCredentials,
    attempt: number,
  ): Promise<Partial<GrokBuildCredentials> | null | undefined> {
    if (!credentials.refreshToken) {
      logger.warn('[GrokBuildCLI] No refresh token available');
      return null;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.GROK_OAUTH_CLIENT_ID || '',
        refresh_token: credentials.refreshToken,
      });

      if (credentials.principalType) {
        body.set('principal_type', credentials.principalType);
      }
      if (credentials.principalId) {
        body.set('principal_id', credentials.principalId);
      }

      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await response
        .json()
        .catch(() => ({}))) as OAuthTokenResponse;

      if (!response.ok) {
        const errorCode = data.error;
        const isTerminal =
          attempt === REFRESH_MAX_ATTEMPTS ||
          (errorCode && TERMINAL_REFRESH_ERRORS.has(errorCode));
        logger.warn(
          '[GrokBuildCLI] Token refresh failed:',
          response.status,
          errorCode,
        );
        return isTerminal ? null : undefined;
      }

      if (!data.access_token) {
        logger.warn('[GrokBuildCLI] No access_token in refresh response');
        return attempt === REFRESH_MAX_ATTEMPTS ? null : undefined;
      }

      const expiresIn =
        typeof data.expires_in === 'number' && data.expires_in > 0
          ? data.expires_in
          : 21600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || credentials.refreshToken,
        expiresAt,
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
        const delayMs = Math.min(
          2_000,
          REFRESH_MIN_DELAY_MS * 2 ** (attempt - 2),
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const refreshed = await this.refreshToken(credentials, attempt);
      if (refreshed !== undefined) return refreshed;
    }

    return null;
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

    logger.debug('[GrokBuildCLI] handleMessage:', {
      model,
      messageCount: messages.length,
    });

    let credentials = parseCredential(credential);

    // Check if token needs refresh
    if (credentials.expiresAt) {
      const expiresAt = new Date(credentials.expiresAt).getTime();
      const now = Date.now();
      const expiresIn = expiresAt - now;

      // Refresh if expires in less than 5 minutes
      if (expiresIn < 5 * 60 * 1000) {
        const refreshed = await this.refreshCredentials(credentials);
        if (refreshed) {
          credentials = { ...credentials, ...refreshed };
        } else {
          onError(new Error('Failed to refresh access token'));
          return;
        }
      }
    }

    const requestModel = model || 'grok-composer-2.5-fast';

    try {
      const bodyObj = {
        model: requestModel,
        messages,
        stream: true,
      };

      const transformedBody = transformRequestBody(requestModel, bodyObj, true);
      const headers = buildSessionHeaders(credentials, requestModel, true);

      const response = await fetch(RESPONSES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedBody),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Try token refresh
          const refreshed = await this.refreshCredentials(credentials);
          if (refreshed) {
            credentials = { ...credentials, ...refreshed };
            // Retry request with new token
            const retryHeaders = buildSessionHeaders(
              credentials,
              requestModel,
              true,
            );
            const retryResponse = await fetch(RESPONSES_URL, {
              method: 'POST',
              headers: retryHeaders,
              body: JSON.stringify(transformedBody),
            });

            if (!retryResponse.ok) {
              throw new Error(
                `Grok Build API returned ${retryResponse.status}`,
              );
            }

            // Process retry response
            await this.processStream(
              retryResponse,
              onContent,
              onThinking,
              onMetadata,
              onDone,
              onError,
            );
            return;
          }
        }

        throw new Error(`Grok Build API returned ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      await this.processStream(
        response,
        onContent,
        onThinking,
        onMetadata,
        onDone,
        onError,
      );
    } catch (err: any) {
      logger.error('[GrokBuildCLI] handleMessage error:', {
        message: err.message,
        stack: err.stack,
      });
      onError(err);
    }
  }

  // ─── Process Stream ─────────────────────────────────────────────────

  private async processStream(
    response: any,
    onContent: (content: string) => void,
    onThinking: ((thinking: string) => void) | undefined,
    onMetadata: ((metadata: any) => void) | undefined,
    onDone: () => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    try {
      const reader = response.body;
      let buffer = '';

      reader.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));

              // Extract content
              if (data.choices && Array.isArray(data.choices)) {
                for (const choice of data.choices) {
                  if (choice.delta?.content) {
                    onContent(choice.delta.content);
                  }
                }
              }

              // Extract thinking (if available)
              if (data.reasoning && onThinking) {
                if (typeof data.reasoning === 'string') {
                  onThinking(data.reasoning);
                } else if (data.reasoning.content) {
                  onThinking(data.reasoning.content);
                }
              }

              // Extract metadata
              if (onMetadata) {
                if (data.finish_reason) {
                  onMetadata({ finish_reason: data.finish_reason });
                }
                if (data.usage) {
                  onMetadata({ usage: data.usage });
                }
              }
            } catch (parseError) {
              logger.warn(
                '[GrokBuildCLI] Failed to parse SSE data:',
                parseError,
              );
            }
          }
        }
      });

      reader.on('end', () => {
        onDone();
      });

      reader.on('error', (err: Error) => {
        onError(err);
      });
    } catch (error) {
      onError(
        error instanceof Error ? error : new Error('Unknown stream error'),
      );
    }
  }
}

export default new GrokBuildCLIProvider();
