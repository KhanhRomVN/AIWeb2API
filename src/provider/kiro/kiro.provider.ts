/**
 * ------------------------------------------------------------------
 * Kiro Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Kiro với nhiều auth method.
 * Sync với OmniRoute src/lib/oauth/providers/kiro.ts + services/kiro.ts.
 *
 * Auth flows:
 * 1. AWS Builder ID   – AWS OIDC Device Code, startUrl = view.awsapps.com/start
 * 2. AWS IAM IDC      – AWS OIDC Device Code, custom startUrl/region do user nhập
 * 3. Google / GitHub  – Kiro Social Device Code (prod.us-east-1.auth.desktop.kiro.dev)
 * 4. Import Token     – Paste refresh token (validate + register OIDC client)
 * 5. API Key          – Long-lived CodeWhisperer API key
 *
 * Login flow (2 bước):
 * - login()    → trả về pending=true + user_code + verification_url + tempSessionId
 * - pollOnce() → gọi định kỳ từ UI cho đến khi done=true
 * ------------------------------------------------------------------
 */

// ─── Imports ─────────────────────────────────────────────────────────────
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

import { Provider, SendMessageOptions } from '../../types';
import { createLogger } from '../../utils/logger';
import { proxyHandler } from './kiro.proxy-handler';
import { ByteQueue, parseEventFrame } from './kiro.sse-parser';

import {
  PROVIDER_NAME,
  MODELS,
  AWS_OIDC,
  OIDC_CLIENT,
  SOCIAL_AUTH,
  BUILDER_ID_START_URL,
  DEFAULT_REGION,
  AUTH_METHODS,
  AUTH_DATA_DEFAULTS,
  DEVICE_CODE_DEFAULTS,
  FALLBACK_EMAIL,
  HTTP_HEADER_NAMES,
  HTTP_HEADERS,
  CONTENT_TYPES,
  API_FIELDS,
  kiroRuntimeHost,
} from './kiro.constant';

import type {
  KiroAuthData,
  KiroAuthMethod,
  KiroClientRegistrationRequest,
  KiroClientRegistrationResponse,
  KiroDeviceAuthorizationRequest,
  KiroDeviceAuthorizationResponse,
  KiroTokenPollRequest,
  KiroTokenPollResponse,
  DeviceCodeResponse,
  DeviceTokenResponse,
  DeviceCodeError,
  KiroPollContext,
  KiroSocialPollResponse,
} from './kiro.types';

// ─── Constants ────────────────────────────────────────────────────────────
const logger = createLogger('KiroProvider');

// ─── Provider Class ───────────────────────────────────────────────────────

export class KiroProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ───────────────────────────────────────────
  static config = {
    provider_id: 'kiro',
    provider_name: PROVIDER_NAME,
    description: 'AWS-powered AI coding assistant with OAuth authentication',
    color: '#8B5CF6',
    is_enabled: true,
    website_url: 'https://kiro.dev/',
    auth_method: ['google', 'github'],
    connection_type: 'https',
    models: MODELS,
    is_pausable: false,
    is_memory: false,
  };

  // ─── AWS OIDC: Register Client ─────────────────────────────────────────

  /**
   * Register OIDC client với AWS SSO OIDC.
   * Tạo dynamic client để dùng trong device flow.
   *
   * Với IDC flow (skipIssuerUrl=true), không gửi issuerUrl vì mỗi tenant IDC
   * có issuerUrl riêng — gửi issuerUrl cố định sẽ gây invalid_request.
   */
  private async registerOIDCClient(
    region = DEFAULT_REGION,
    skipIssuerUrl = false,
  ): Promise<KiroClientRegistrationResponse> {
    const registerUrl = `https://oidc.${region}.amazonaws.com/client/register`;

    const requestBody: KiroClientRegistrationRequest = {
      clientName: OIDC_CLIENT.clientName,
      clientType: OIDC_CLIENT.clientType,
      scopes: OIDC_CLIENT.scopes,
      grantTypes: OIDC_CLIENT.grantTypes,
      ...(!skipIssuerUrl ? { issuerUrl: OIDC_CLIENT.issuerUrl } : {}),
    };

    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Kiro] OIDC client registration failed:', errorText);
      throw new Error(`OIDC client registration failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as KiroClientRegistrationResponse;
    return {
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      clientSecretExpiresAt: data[API_FIELDS.CLIENT_SECRET_EXPIRES_AT] || 0,
    };
  }

  // ─── AWS OIDC: Device Authorization ───────────────────────────────────

  /**
   * Bắt đầu AWS OIDC device authorization flow.
   * Dùng cho Builder ID và IDC.
   */
  private async startAwsDeviceAuthorization(opts: {
    region: string;
    startUrl: string;
    skipIssuerUrl: boolean;
  }): Promise<DeviceCodeResponse & { _region: string }> {
    const { region, startUrl, skipIssuerUrl } = opts;

    // Register OIDC client
    const client = await this.registerOIDCClient(region, skipIssuerUrl);

    const deviceAuthUrl = `https://oidc.${region}.amazonaws.com/device_authorization`;
    const requestBody: KiroDeviceAuthorizationRequest = {
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      startUrl,
    };

    const response = await fetch(deviceAuthUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Kiro] Device authorization failed:', errorText);
      throw new Error(`Device authorization failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as KiroDeviceAuthorizationResponse;

    return {
      device_code: data[API_FIELDS.DEVICE_CODE],
      user_code: data[API_FIELDS.USER_CODE],
      verification_uri: data[API_FIELDS.VERIFICATION_URI] || '',
      verification_uri_complete: data[API_FIELDS.VERIFICATION_URI_COMPLETE],
      expires_in: data[API_FIELDS.EXPIRES_IN] || DEVICE_CODE_DEFAULTS.EXPIRES_SEC,
      interval: data[API_FIELDS.INTERVAL] || DEVICE_CODE_DEFAULTS.INTERVAL_SEC,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      _region: region,
    };
  }

  // ─── Social Device Authorization (Google / GitHub) ────────────────────

  /**
   * Bắt đầu Kiro social device authorization flow.
   * Dùng cho Google và GitHub via prod.us-east-1.auth.desktop.kiro.dev.
   *
   * Endpoint này là Kiro's own auth service (Cognito-based), KHÔNG phải AWS OIDC —
   * do đó device_code phải poll ở socialDevicePollUrl chứ không phải AWS OIDC token.
   */
  private async startSocialDeviceAuthorization(
    provider: 'google' | 'github',
  ): Promise<DeviceCodeResponse> {
    // Endpoint expects: { clientId, loginProvider: "Google" | "Github" }
    // Response uses camelCase + millisecond fields (expiresInMilliseconds, intervalInMilliseconds)
    const loginProvider = provider === 'google' ? 'Google' : 'Github';

    const response = await fetch(SOCIAL_AUTH.SOCIAL_DEVICE_AUTHORIZE_URL, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
      body: JSON.stringify({
        clientId: SOCIAL_AUTH.SOCIAL_CLIENT_ID,
        loginProvider,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Kiro] Social device authorization failed:', errorText);
      throw new Error(`Social device authorization failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      deviceCode?: string;
      userCode?: string;
      verificationUri?: string;
      verificationUriComplete?: string;
      expiresInMilliseconds?: number;
      intervalInMilliseconds?: number;
      // fallback snake_case
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      verification_uri_complete?: string;
      expires_in?: number;
      interval?: number;
    };

    const deviceCode = data.deviceCode || data.device_code || '';
    const userCode = data.userCode || data.user_code || '';
    const verificationUri = data.verificationUri || data.verification_uri || '';
    const verificationUriComplete = data.verificationUriComplete || data.verification_uri_complete;
    // Response uses milliseconds; convert to seconds for consistency
    const expiresIn = data.expiresInMilliseconds
      ? Math.floor(data.expiresInMilliseconds / 1000)
      : (data.expires_in || DEVICE_CODE_DEFAULTS.EXPIRES_SEC);
    const interval = data.intervalInMilliseconds
      ? Math.floor(data.intervalInMilliseconds / 1000)
      : (data.interval || DEVICE_CODE_DEFAULTS.INTERVAL_SEC);

    if (!deviceCode) {
      throw new Error('Social device authorization response missing device_code');
    }

    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      expires_in: expiresIn,
      interval,
      clientId: SOCIAL_AUTH.SOCIAL_CLIENT_ID,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────

  /**
   * Bước 1: Khởi tạo device flow, trả về user_code + verification_url ngay.
   *
   * options.kiroMethod:
   * - 'builder-id' : AWS OIDC device code, startUrl = awsapps.com/start
   * - 'idc'        : AWS OIDC device code, startUrl + region do user cung cấp
   * - 'google'     : Kiro social device code, provider = google
   * - 'github'     : Kiro social device code, provider = github
   */
  async login(options?: {
    kiroMethod?: 'google' | 'github' | 'builder-id' | 'idc';
    startUrl?: string;  // cho IDC
    region?: string;    // cho IDC
  }) {
    const method = options?.kiroMethod || AUTH_METHODS.GOOGLE;

    try {
      let deviceAuth: DeviceCodeResponse;
      let pollContext: KiroPollContext;

      if (method === 'google' || method === 'github') {
        // ── Social device code flow ──
        deviceAuth = await this.startSocialDeviceAuthorization(method);
        pollContext = {
          flowType: 'social',
          device_code: deviceAuth.device_code,
          client_id: SOCIAL_AUTH.SOCIAL_CLIENT_ID,
          auth_method: method,
          interval: deviceAuth.interval,
        };
      } else {
        // ── AWS OIDC device code flow (Builder ID / IDC) ──
        const region = options?.region || DEFAULT_REGION;
        const startUrl = method === 'idc'
          ? (options?.startUrl || BUILDER_ID_START_URL)
          : BUILDER_ID_START_URL;
        // IDC: không gửi issuerUrl vì tenant-specific; Builder ID: gửi issuerUrl chuẩn
        const skipIssuerUrl = method === 'idc';

        const result = await this.startAwsDeviceAuthorization({ region, startUrl, skipIssuerUrl });
        deviceAuth = result;
        pollContext = {
          flowType: 'aws_oidc',
          device_code: deviceAuth.device_code,
          client_id: result.clientId || '',
          client_secret: (deviceAuth as any).clientSecret || '',
          region,
          auth_method: method === 'idc' ? 'idc' : 'builder-id',
          interval: deviceAuth.interval,
        };
      }

      const verificationUrl =
        deviceAuth.verification_uri_complete ||
        deviceAuth.verification_uri ||
        '';

      return {
        success: true,
        pending: true,
        cookies: '',
        email: '',
        tempSessionId: JSON.stringify(pollContext),
        user_code: deviceAuth.user_code,
        verification_url: verificationUrl,
        expires_in: deviceAuth.expires_in,
        poll_interval: deviceAuth.interval,
      };
    } catch (error) {
      logger.error('[Kiro] Login initiation failed:', error);
      throw error;
    }
  }

  // ─── Poll Once ────────────────────────────────────────────────────────

  /**
   * Bước 2: Poll một lần — gọi từ UI định kỳ cho đến khi done hoặc error.
   *
   * - done: false + no error  → authorization_pending, tiếp tục poll
   * - done: false + error     → hết hạn hoặc bị denied
   * - done: true              → thành công, cookies + email có giá trị
   */
  async pollOnce(pollContext: string): Promise<{
    done: boolean;
    cookies?: string;
    email?: string;
    error?: string;
  }> {
    let ctx: KiroPollContext;
    try {
      ctx = JSON.parse(pollContext);
    } catch {
      return { done: false, error: 'Invalid poll context' };
    }

    try {
      if (ctx.flowType === 'social') {
        return await this.pollSocialDeviceToken(ctx);
      } else {
        return await this.pollAwsOidcToken(ctx);
      }
    } catch (error) {
      logger.warn('[Kiro] pollOnce error:', error);
      return { done: false };
    }
  }

  // ─── Poll: AWS OIDC (Builder ID / IDC) ───────────────────────────────

  private async pollAwsOidcToken(ctx: KiroPollContext): Promise<{
    done: boolean;
    cookies?: string;
    email?: string;
    error?: string;
  }> {
    const region = ctx.region || DEFAULT_REGION;
    const tokenUrl = `https://oidc.${region}.amazonaws.com/token`;

    const requestBody: KiroTokenPollRequest = {
      clientId: ctx.client_id,
      clientSecret: ctx.client_secret || '',
      deviceCode: ctx.device_code,
      grantType: OIDC_CLIENT.grantTypes[0],
    };

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = (await response.json()) as KiroTokenPollResponse;
      return await this.buildAuthResult(data.accessToken, data.refreshToken, {
        authMethod: ctx.auth_method,
        clientId: ctx.client_id,
        clientSecret: ctx.client_secret,
        region,
        expiresIn: data[API_FIELDS.EXPIRES_IN] || DEVICE_CODE_DEFAULTS.TOKEN_EXPIRES_SEC,
      });
    }

    const errorData = (await response.json().catch(() => ({}))) as DeviceCodeError;
    return this.handlePollError(errorData);
  }

  // ─── Poll: Social (Google / GitHub) ──────────────────────────────────

  /**
   * Poll Kiro social device code endpoint.
   * Request body: JSON { deviceCode, clientId }
   * Response: { error/status, accessToken, refreshToken, profileArn, expiresIn }
   */
  private async pollSocialDeviceToken(ctx: KiroPollContext): Promise<{
    done: boolean;
    cookies?: string;
    email?: string;
    error?: string;
  }> {
    const response = await fetch(SOCIAL_AUTH.SOCIAL_DEVICE_POLL_URL, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
      body: JSON.stringify({
        deviceCode: ctx.device_code,
        clientId: ctx.client_id,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as KiroSocialPollResponse;

    // Kiro social endpoint trả về error/status thay vì HTTP status cho pending
    const progress = data.error ?? data.status;
    if (progress === 'authorization_pending' || progress === 'slow_down') {
      return { done: false };
    }

    if (!response.ok || (data.error && data.error !== 'authorization_pending')) {
      if (progress === 'access_denied') {
        return { done: false, error: 'User denied authorization' };
      }
      if (progress === 'expired_token' || progress === 'device_expired') {
        return { done: false, error: 'Device code expired. Please try again.' };
      }
      const errMsg = typeof data.error === 'string' ? data.error : 'Authorization failed';
      return { done: false, error: errMsg };
    }

    if (!data.accessToken && !data.refreshToken) {
      return { done: false, error: 'No token received from social auth' };
    }

    return await this.buildAuthResult(data.accessToken || '', data.refreshToken || '', {
      authMethod: ctx.auth_method,
      profileArn: data.profileArn,
      expiresIn: data.expiresIn || DEVICE_CODE_DEFAULTS.TOKEN_EXPIRES_SEC,
      provider: ctx.auth_method === 'google' ? 'Google' : 'Github',
    });
  }

  // ─── Handle Poll Error ────────────────────────────────────────────────

  private handlePollError(errorData: DeviceCodeError): {
    done: boolean;
    cookies?: string;
    email?: string;
    error?: string;
  } {
    if (
      errorData.error === 'authorization_pending' ||
      errorData.error === 'slow_down'
    ) {
      return { done: false };
    }
    if (errorData.error === 'access_denied') {
      return { done: false, error: 'User denied authorization' };
    }
    if (errorData.error === 'expired_token') {
      return { done: false, error: 'Device code expired. Please try again.' };
    }
    return { done: false, error: `Token polling failed: ${errorData.error || 'unknown'}` };
  }

  // ─── Build Auth Result ────────────────────────────────────────────────

  /**
   * Tạo cookies JSON và lấy email sau khi poll thành công.
   */
  private async buildAuthResult(
    accessToken: string,
    refreshToken: string,
    meta: {
      authMethod: KiroAuthMethod;
      clientId?: string;
      clientSecret?: string;
      clientSecretExpiresAt?: number;
      region?: string;
      profileArn?: string;
      expiresIn?: number;
      provider?: string;
    },
  ): Promise<{ done: boolean; cookies: string; email: string }> {
    const authData: KiroAuthData = {
      accessToken,
      refreshToken,
      expiresIn: meta.expiresIn || DEVICE_CODE_DEFAULTS.TOKEN_EXPIRES_SEC,
      authMethod: meta.authMethod,
      ...(meta.clientId ? { clientId: meta.clientId } : {}),
      ...(meta.clientSecret ? { clientSecret: meta.clientSecret } : {}),
      ...(meta.clientSecretExpiresAt ? { clientSecretExpiresAt: meta.clientSecretExpiresAt } : {}),
      region: meta.region || DEFAULT_REGION,
      ...(meta.profileArn ? { profileArn: meta.profileArn } : {}),
      ...(meta.provider ? { provider: meta.provider } : {}),
    };

    // Kiro social tokens là AWS opaque — không có endpoint nào trả email.
    // Email sẽ được nhập thủ công ở UI.
    const emailFromJwt = this.extractEmailFromJWT(accessToken);

    return { done: true, cookies: JSON.stringify(authData), email: emailFromJwt || '' };
  }

  // ─── JWT Email Extraction ─────────────────────────────────────────────

  /**
   * Best-effort decode JWT payload để lấy email.
   * Không verify signature — chỉ dùng cho display.
   */
  private extractEmailFromJWT(accessToken: string): string | null {
    try {
      const parts = accessToken.split('.');
      if (parts.length !== 3) return null;
      let payload = parts[1];
      while (payload.length % 4) payload += '=';
      const decoded = JSON.parse(
        Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
      );
      return (
        decoded.email ||
        decoded.preferred_username ||
        decoded.upn ||
        decoded.sub ||
        null
      );
    } catch {
      return null;
    }
  }

  // ─── Profile ──────────────────────────────────────────────────────────

  async getUserProfile(credential: string): Promise<{ email: string | null }> {
    try {
      const authData = this.parseAuthData(credential);
      const email = this.extractEmailFromJWT(authData.accessToken);
      return { email };
    } catch {
      return { email: null };
    }
  }

  // ─── Auth Data Parser ─────────────────────────────────────────────────

  parseAuthData(credential: string): KiroAuthData {
    try {
      const parsed = JSON.parse(credential) as Partial<KiroAuthData>;
      return {
        accessToken: parsed.accessToken || credential,
        refreshToken: parsed.refreshToken || AUTH_DATA_DEFAULTS.REFRESH_TOKEN,
        authMethod: parsed.authMethod || (AUTH_DATA_DEFAULTS.METHOD as KiroAuthMethod),
        expiresIn: parsed.expiresIn,
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        clientSecretExpiresAt: parsed.clientSecretExpiresAt,
        region: parsed.region || DEFAULT_REGION,
        profileArn: parsed.profileArn,
        provider: parsed.provider,
      };
    } catch {
      return {
        accessToken: credential,
        refreshToken: AUTH_DATA_DEFAULTS.REFRESH_TOKEN,
        authMethod: AUTH_DATA_DEFAULTS.METHOD as KiroAuthMethod,
        region: DEFAULT_REGION,
      };
    }
  }

  // ─── Token Refresh ────────────────────────────────────────────────────

  /**
   * Refresh access token bằng refresh token.
   * Sync với OmniRoute services/kiro.ts → refreshToken().
   */
  async refreshToken(credential: string): Promise<KiroAuthData | null> {
    const authData = this.parseAuthData(credential);
    const { refreshToken, authMethod, clientId, clientSecret, region } = authData;

    if (!refreshToken) return null;

    try {
      // AWS SSO OIDC refresh (Builder ID / IDC)
      // Không refresh imported social token bằng OIDC (chỉ dùng social path)
      if (clientId && clientSecret && authMethod !== 'imported') {
        const resolvedRegion = region || DEFAULT_REGION;
        const endpoint = `https://oidc.${resolvedRegion}.amazonaws.com/token`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
            [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
          },
          body: JSON.stringify({
            clientId,
            clientSecret,
            refreshToken,
            grantType: 'refresh_token',
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as KiroTokenPollResponse;
          return {
            ...authData,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || refreshToken,
            expiresIn: data[API_FIELDS.EXPIRES_IN] || DEVICE_CODE_DEFAULTS.TOKEN_EXPIRES_SEC,
          };
        }
        // Nếu lỗi, fall through sang social refresh
        logger.warn('[Kiro] OIDC refresh failed, trying social path');
      }

      // Social Auth refresh (Google / GitHub / imported)
      const response = await fetch(SOCIAL_AUTH.SOCIAL_REFRESH_URL, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${errorText}`);
      }

      const data = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
        profileArn?: string;
        expiresIn?: number;
      };

      return {
        ...authData,
        accessToken: data.accessToken || '',
        refreshToken: data.refreshToken || refreshToken,
        expiresIn: data.expiresIn || DEVICE_CODE_DEFAULTS.TOKEN_EXPIRES_SEC,
        ...(data.profileArn ? { profileArn: data.profileArn } : {}),
      };
    } catch (error) {
      logger.error('[Kiro] Token refresh error:', error);
      return null;
    }
  }

  // ─── Auto-open Browser ────────────────────────────────────────────────

  openBrowser(url: string): void {
    const platform = process.platform;
    let cmd: string;
    if (platform === 'darwin') {
      cmd = `open "${url}"`;
    } else if (platform === 'win32') {
      cmd = `start "" "${url}"`;
    } else {
      cmd = `xdg-open "${url}"`;
    }
    exec(cmd, (error) => {
      if (error) {
        logger.warn('[Kiro] Could not auto-open browser:', error.message);
      }
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
      onDone,
      onError,
    } = options;

    try {
      const authData = this.parseAuthData(credential);
      const { accessToken, region, profileArn } = authData;

      if (!accessToken) {
        throw new Error('Kiro: missing access token');
      }

      // ── Build Kiro conversationState payload ──
      const resolvedRegion = region || DEFAULT_REGION;
      const body = this.buildConversationPayload(messages, model, profileArn);

      // ── Build headers ──
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
        'Accept': 'application/vnd.amazon.eventstream',
        'Amz-Sdk-Request': 'attempt=1; max=3',
        'x-amzn-bedrock-cache-control': 'enable',
      };

      // ── Determine endpoint ──
      // Social auth (google/github) → try branded Kiro gateway first
      // Falls back to direct CodeWhisperer if needed
      const baseUrl = resolvedRegion === DEFAULT_REGION
        ? 'https://runtime.us-east-1.kiro.dev/generateAssistantResponse'
        : kiroRuntimeHost(resolvedRegion) + '/generateAssistantResponse';

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Fallback to direct CodeWhisperer endpoint on auth failure
        if (response.status === 401 || response.status === 403) {
          const fallbackUrl = kiroRuntimeHost(resolvedRegion) + '/generateAssistantResponse';
          if (fallbackUrl !== baseUrl) {
            const fallbackResponse = await fetch(fallbackUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });
            if (!fallbackResponse.ok) {
              const errText = await fallbackResponse.text();
              throw new Error(`Kiro API error ${fallbackResponse.status}: ${errText}`);
            }
            await this.processEventStream(response as any, onContent, onThinking);
      onDone();
      return;
          }
        }
        const errText = await response.text();
        throw new Error(`Kiro API error ${response.status}: ${errText}`);
      }

      await this.processEventStream(response as any, onContent, onThinking);
      onDone();
    } catch (err) {
      logger.error('[Kiro] handleMessage error:', err);
      onError(err);
    }
  }

  /**
   * Build minimal Kiro conversationState từ OpenAI messages.
   * Chỉ handle single-turn và basic multi-turn — đủ cho chat thông thường.
   */
  private buildConversationPayload(
    messages: Array<{ role: string; content: string | any[] }>,
    model: string,
    profileArn?: string,
  ) {
    // Normalize model: dashes → dots cho version number (e.g. claude-sonnet-4-5 → claude-sonnet-4.5)
    const normalizedModel = model.replace(/-(\d+)-(\d{1,2})$/, '-$1.$2');

    // Build history và currentMessage
    const history: any[] = [];
    let systemContent = '';

    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string' ? msg.content : '';
        systemContent += (systemContent ? '\n\n' : '') + text;
      } else if (msg.role === 'user') {
        const text = typeof msg.content === 'string' ? msg.content
          : Array.isArray(msg.content) ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') : '';
        history.push({
          userInputMessage: {
            content: text || '(empty)',
            modelId: normalizedModel,
            origin: 'AI_EDITOR',
          },
        });
      } else if (msg.role === 'assistant') {
        const text = typeof msg.content === 'string' ? msg.content
          : Array.isArray(msg.content) ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') : '';
        history.push({
          assistantResponseMessage: { content: text || '(empty)' },
        });
      }
    }

    // Current (last) message
    const lastMsg = messages[messages.length - 1];
    let lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content
      : Array.isArray(lastMsg?.content) ? lastMsg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') : '';

    // Prepend system prompt vào content của current message
    if (systemContent) {
      lastContent = `<system-reminder>\n${systemContent}\n</system-reminder>\n\n${lastContent}`;
    }

    // Deterministic conversationId từ first user message
    const NAMESPACE_KIRO = '34f7193f-561d-4050-bc84-9547d953d6bf';
    const firstUser = messages.find((m) => m.role === 'user');
    const seed = typeof firstUser?.content === 'string' ? firstUser.content
      : Array.isArray(firstUser?.content) ? firstUser.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ') : '';
    const conversationId = seed
      ? uuidv5(seed.substring(0, 4000), NAMESPACE_KIRO)
      : uuidv4();

    const payload: any = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId,
        currentMessage: {
          userInputMessage: {
            content: lastContent || '(empty)',
            modelId: normalizedModel,
            origin: 'AI_EDITOR',
          },
        },
        history,
      },
      inferenceConfig: {
        maxTokens: 32000,
      },
    };

    if (profileArn) {
      payload.profileArn = profileArn;
    }

    return payload;
  }

  /**
   * Process AWS EventStream binary response và extract text content.
   * response.body là Node.js Readable (từ node-fetch).
   */
  private async processEventStream(
    response: any,
    onContent: (chunk: string) => void,
    onThinking?: (chunk: string) => void,
  ): Promise<void> {
    if (!response.body) {
      throw new Error('Kiro: empty response body');
    }

    const buffer = new ByteQueue();

    await new Promise<void>((resolve, reject) => {
      const nodeStream = response.body as NodeJS.ReadableStream;

      const processBuffer = () => {
        let iterations = 0;
        while (buffer.length >= 16 && iterations < 1000) {
          iterations++;
          const totalLength = buffer.peekUint32BE(0);
          if (!totalLength || totalLength < 16 || totalLength > buffer.length) break;

          const eventData = buffer.read(totalLength);
          if (!eventData) break;

          const event = parseEventFrame(eventData);
          if (!event) continue;

          const eventType = event.headers[':event-type'] || '';

          if (eventType === 'assistantResponseEvent') {
            const content = typeof event.payload?.content === 'string' ? event.payload.content : '';
            if (content) onContent(content);
          } else if (eventType === 'reasoningContentEvent') {
            const rp = event.payload as Record<string, unknown> | null;
            const rt = rp?.reasoningText;
            let reasoning = '';
            if (rt && typeof rt === 'object') {
              reasoning = typeof (rt as any).text === 'string' ? (rt as any).text : '';
            } else if (typeof rt === 'string') {
              reasoning = rt;
            }
            if (reasoning && onThinking) onThinking(reasoning);
          }
        }
      };

      nodeStream.on('data', (chunk: Buffer) => {
        buffer.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        processBuffer();
      });

      nodeStream.on('end', () => resolve());
      nodeStream.on('error', (err: Error) => reject(err));
    });
  }
}

export default new KiroProvider();
