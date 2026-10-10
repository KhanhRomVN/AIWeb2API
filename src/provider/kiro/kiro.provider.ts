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
import { createKiroThinkingParser } from './kiro.thinking-parser';

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
  resolveKiroRuntimeRegion,
  KIRO_PROFILE_REGIONS,
  CAN_REGENERATE,
} from './kiro.constant';

import type {
  KiroAuthData,
  KiroAuthMethod,
  KiroRefreshResult,
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
    can_regenerate: CAN_REGENERATE,
    /** Device code flow: không cần CDP/proxy browser, user authorize trực tiếp trên browser thường */
    login_flow: 'device_code' as const,
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
      throw new Error(
        `OIDC client registration failed: ${response.status} ${errorText}`,
      );
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
      throw new Error(
        `Device authorization failed: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as KiroDeviceAuthorizationResponse;

    return {
      device_code: data[API_FIELDS.DEVICE_CODE],
      user_code: data[API_FIELDS.USER_CODE],
      verification_uri: data[API_FIELDS.VERIFICATION_URI] || '',
      verification_uri_complete: data[API_FIELDS.VERIFICATION_URI_COMPLETE],
      expires_in:
        data[API_FIELDS.EXPIRES_IN] || DEVICE_CODE_DEFAULTS.EXPIRES_SEC,
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
      throw new Error(
        `Social device authorization failed: ${response.status} ${errorText}`,
      );
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
    const verificationUriComplete =
      data.verificationUriComplete || data.verification_uri_complete;
    // Response uses milliseconds; convert to seconds for consistency
    const expiresIn = data.expiresInMilliseconds
      ? Math.floor(data.expiresInMilliseconds / 1000)
      : data.expires_in || DEVICE_CODE_DEFAULTS.EXPIRES_SEC;
    const interval = data.intervalInMilliseconds
      ? Math.floor(data.intervalInMilliseconds / 1000)
      : data.interval || DEVICE_CODE_DEFAULTS.INTERVAL_SEC;

    if (!deviceCode) {
      throw new Error(
        'Social device authorization response missing device_code',
      );
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
   * options.method / options.kiroMethod:
   * - 'builder-id' : AWS OIDC device code, startUrl = awsapps.com/start
   * - 'idc'        : AWS OIDC device code, startUrl + region do user cung cấp
   * - 'google'     : Kiro social device code, provider = google
   * - 'github'     : Kiro social device code, provider = github
   */
  async login(options?: {
    method?: 'google' | 'github' | 'builder-id' | 'idc';
    kiroMethod?: 'google' | 'github' | 'builder-id' | 'idc';
    startUrl?: string; // cho IDC
    region?: string; // cho IDC
  }) {
    const method =
      options?.method || options?.kiroMethod || AUTH_METHODS.GOOGLE;

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
        const startUrl =
          method === 'idc'
            ? options?.startUrl || BUILDER_ID_START_URL
            : BUILDER_ID_START_URL;
        // IDC: không gửi issuerUrl vì tenant-specific; Builder ID: gửi issuerUrl chuẩn
        const skipIssuerUrl = method === 'idc';

        const result = await this.startAwsDeviceAuthorization({
          region,
          startUrl,
          skipIssuerUrl,
        });
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
        clientId: ctx.client_id,
        clientSecret: ctx.client_secret,
        region,
        authMethod: ctx.auth_method,
      });
    }

    const errorData = (await response
      .json()
      .catch(() => ({}))) as DeviceCodeError;
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

    const data = (await response
      .json()
      .catch(() => ({}))) as KiroSocialPollResponse;

    // Kiro social endpoint trả về error/status thay vì HTTP status cho pending
    const progress = data.error ?? data.status;
    if (progress === 'authorization_pending' || progress === 'slow_down') {
      return { done: false };
    }

    if (
      !response.ok ||
      (data.error && data.error !== 'authorization_pending')
    ) {
      if (progress === 'access_denied') {
        return { done: false, error: 'User denied authorization' };
      }
      if (progress === 'expired_token' || progress === 'device_expired') {
        return { done: false, error: 'Device code expired. Please try again.' };
      }
      const errMsg =
        typeof data.error === 'string' ? data.error : 'Authorization failed';
      return { done: false, error: errMsg };
    }

    if (!data.accessToken && !data.refreshToken) {
      return { done: false, error: 'No token received from social auth' };
    }

    return await this.buildAuthResult(
      data.accessToken || '',
      data.refreshToken || '',
      {
        profileArn: data.profileArn,
        authMethod: ctx.auth_method,
      },
    );
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
    return {
      done: false,
      error: `Token polling failed: ${errorData.error || 'unknown'}`,
    };
  }

  // ─── Build Auth Result ────────────────────────────────────────────────

  /**
   * Tạo cookies JSON và lấy email sau khi poll thành công.
   * Với IDC flow, tự động discover profileArn qua ListAvailableProfiles.
   */
  private async buildAuthResult(
    accessToken: string,
    refreshToken: string,
    meta: {
      clientId?: string;
      clientSecret?: string;
      clientSecretExpiresAt?: number;
      region?: string;
      profileArn?: string;
      authMethod?: KiroAuthMethod;
    },
  ): Promise<{ done: boolean; cookies: string; email: string }> {
    let profileArn = meta.profileArn;

    // IDC flow không trả về profileArn từ token endpoint.
    // Discover nó bằng cách gọi ListAvailableProfiles.
    // Builder ID không cần profileArn — bỏ qua.
    if (!profileArn && meta.authMethod === 'idc') {
      try {
        profileArn =
          (await this.discoverProfileArn(accessToken, meta.region)) ??
          undefined;
      } catch (err) {
        logger.warn('[Kiro] Failed to discover profileArn (non-fatal):', err);
      }
    }

    const authData: KiroAuthData = {
      accessToken,
      refreshToken,
      ...(meta.clientId ? { clientId: meta.clientId } : {}),
      ...(meta.clientSecret ? { clientSecret: meta.clientSecret } : {}),
      ...(meta.clientSecretExpiresAt
        ? { clientSecretExpiresAt: meta.clientSecretExpiresAt }
        : {}),
      region: meta.region || DEFAULT_REGION,
      ...(profileArn ? { profileArn } : {}),
      ...(meta.authMethod ? { authMethod: meta.authMethod } : {}),
    };

    // Kiro social tokens là AWS opaque — không có endpoint nào trả email.
    // Email sẽ được nhập thủ công ở UI.
    const emailFromJwt = this.extractEmailFromJWT(accessToken);

    return {
      done: true,
      cookies: JSON.stringify(authData),
      email: emailFromJwt || '',
    };
  }

  // ─── Discover Profile ARN ─────────────────────────────────────────────

  /**
   * Discover Q Developer profileArn bằng ListAvailableProfiles.
   * Dùng cho IDC flow — probes us-east-1 và eu-central-1 (nơi AWS host profile),
   * sau đó thử stored region như forward-compatible fallback.
   */
  private async discoverProfileArn(
    accessToken: string,
    storedRegion?: string,
  ): Promise<string | null> {
    const regionsToProbe: string[] = [...KIRO_PROFILE_REGIONS];
    // Append stored region nếu là valid AWS region và chưa có trong list
    if (
      storedRegion &&
      /^[a-z]{2}-[a-z]+-\d{1,2}$/.test(storedRegion) &&
      !regionsToProbe.includes(storedRegion)
    ) {
      regionsToProbe.push(storedRegion);
    }

    for (const region of regionsToProbe) {
      try {
        const host = kiroRuntimeHost(region);
        const response = await fetch(`${host}/`, {
          method: 'POST',
          headers: {
            [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/x-amz-json-1.0',
            [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
            'x-amz-target': 'AmazonCodeWhispererService.ListAvailableProfiles',
            [HTTP_HEADER_NAMES.AUTHORIZATION]: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ maxResults: 10 }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) continue;
        const data = (await response.json()) as { profiles?: unknown };
        const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
        const matched =
          profiles.find((p: unknown) => {
            const arn = (p as { arn?: string })?.arn;
            return typeof arn === 'string' && arn.includes(`:${region}:`);
          }) || profiles[0];
        const arn = (matched as { arn?: string })?.arn;
        if (typeof arn === 'string' && arn.length > 0) return arn;
      } catch {
        // region probe failed — try next
      }
    }
    return null;
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
        Buffer.from(
          payload.replace(/-/g, '+').replace(/_/g, '/'),
          'base64',
        ).toString('utf8'),
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
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        clientSecretExpiresAt: parsed.clientSecretExpiresAt,
        region: parsed.region || DEFAULT_REGION,
        profileArn: parsed.profileArn,
        authMethod: parsed.authMethod,
      };
    } catch {
      return {
        accessToken: credential,
        refreshToken: AUTH_DATA_DEFAULTS.REFRESH_TOKEN,
        region: DEFAULT_REGION,
      };
    }
  }

  // ─── Token Refresh ────────────────────────────────────────────────────

  /**
   * Refresh access token bằng refresh token.
   *
   * Logic (theo thứ tự):
   * 1. AWS SSO OIDC (Builder ID / IDC) khi có clientId + clientSecret,
   *    trừ authMethod === "imported" (token là social, không thể refresh bằng OIDC client).
   *    Khi OIDC refresh thất bại do client hết hạn → tự re-register client mới và retry.
   * 2. Social Auth (Google / GitHub / imported) → Kiro social refresh endpoint.
   *
   * Return: KiroRefreshResult | null
   *   - null: network error hoặc không thể refresh
   *   - { error: 'unrecoverable_refresh_error' }: refresh token đã revoke, cần re-auth
   *   - _newClientId/_newClientSecret: client mới sau khi re-register (cần persist)
   */
  async refreshToken(credential: string): Promise<KiroRefreshResult | null> {
    const authData = this.parseAuthData(credential);
    const { refreshToken, clientId, clientSecret, region, authMethod } =
      authData;

    if (!refreshToken) {
      logger.warn(
        '[Kiro][RefreshToken] No refresh token found in credential, aborting.',
      );
      return null;
    }

    try {
      // ── AWS SSO OIDC refresh (Builder ID / IDC) ──
      // "imported" tokens dùng OIDC client đã register nhưng refresh token là social-issued
      // → OIDC client không thể refresh → dùng social path (#2467)
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
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || refreshToken,
            expiresIn: data.expiresIn,
          };
        }

        const errorText = await response.text();
        logger.warn('[Kiro][RefreshToken] OIDC response error body', {
          status: response.status,
          body: errorText.slice(0, 500),
        });

        // AWS SSO OIDC dùng {"__type": "..."} thay vì standard OAuth2 error
        let awsErrorType: string | undefined;
        try {
          const awsError = JSON.parse(errorText) as Record<string, unknown>;
          awsErrorType = (awsError.__type || awsError.error) as
            | string
            | undefined;
        } catch {
          /* not JSON */
        }

        // Refresh token đã bị revoke/hết hạn → không thể recover
        if (
          awsErrorType === 'InvalidGrantException' ||
          awsErrorType === 'ExpiredTokenException' ||
          awsErrorType === 'invalid_grant'
        ) {
          logger.error(
            '[Kiro][RefreshToken] Refresh token expired/invalid. Re-authentication required.',
            { awsErrorType },
          );
          return {
            accessToken: '',
            refreshToken: '',
            error: 'unrecoverable_refresh_error',
            code: awsErrorType,
          };
        }

        // Client credentials có thể hết hạn (DB import, TTL, browser conflict)
        // → Re-register OIDC client mới và retry một lần (#2524)
        logger.warn(
          '[Kiro][RefreshToken] OIDC refresh failed, attempting client re-registration...',
          {
            status: response.status,
            error: errorText.slice(0, 200),
          },
        );

        try {
          const newClient = await this.registerOIDCClient(
            resolvedRegion,
            false,
          );
          const retryResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
              [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
            },
            body: JSON.stringify({
              clientId: newClient.clientId,
              clientSecret: newClient.clientSecret,
              refreshToken,
              grantType: 'refresh_token',
            }),
          });

          if (retryResponse.ok) {
            const retryData =
              (await retryResponse.json()) as KiroTokenPollResponse;
            return {
              accessToken: retryData.accessToken,
              refreshToken: retryData.refreshToken || refreshToken,
              expiresIn: retryData.expiresIn,
              _newClientId: newClient.clientId,
              _newClientSecret: newClient.clientSecret,
              _newClientSecretExpiresAt: newClient.clientSecretExpiresAt,
            };
          }

          const retryErrorText = await retryResponse.text();
          logger.warn('[Kiro][RefreshToken] OIDC retry also failed', {
            status: retryResponse.status,
            body: retryErrorText.slice(0, 300),
          });
        } catch (reRegErr) {
          logger.warn(
            '[Kiro][RefreshToken] Client re-registration fallback failed:',
            reRegErr,
          );
        }

        // OIDC path hoàn toàn thất bại, fall through sang social
        logger.warn(
          '[Kiro][RefreshToken] OIDC refresh failed entirely, trying social path',
        );
      }

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
        logger.warn('[Kiro][RefreshToken] Social response error body', {
          status: response.status,
          body: errorText.slice(0, 500),
        });

        // Cũng check AWS-style error trên social path (Kiro có thể relay chúng)
        try {
          const awsError = JSON.parse(errorText) as Record<string, unknown>;
          const awsErrorType = (awsError.__type || awsError.error) as
            | string
            | undefined;
          if (
            awsErrorType === 'InvalidGrantException' ||
            awsErrorType === 'ExpiredTokenException' ||
            awsErrorType === 'invalid_grant'
          ) {
            logger.error(
              '[Kiro][RefreshToken] Social refresh token expired/invalid.',
              { awsErrorType },
            );
            return {
              accessToken: '',
              refreshToken: '',
              error: 'unrecoverable_refresh_error',
              code: awsErrorType,
            };
          }
        } catch {
          /* not JSON */
        }

        logger.error('[Kiro][RefreshToken] Social token refresh failed:', {
          status: response.status,
          error: errorText.slice(0, 200),
        });
        return null;
      }

      const data = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
        profileArn?: string;
        expiresIn?: number;
      };

      return {
        accessToken: data.accessToken || '',
        refreshToken: data.refreshToken || refreshToken,
        expiresIn: data.expiresIn,
      };
    } catch (error) {
      logger.error(
        '[Kiro][RefreshToken] Unexpected error during token refresh:',
        error,
      );
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
      ref_file_ids,
      onContent,
      onThinking,
      onDone,
      onError,
      onCredentialRotated,
    } = options;

    try {
      let authData = this.parseAuthData(credential);

      if (!authData.accessToken) {
        throw new Error('Kiro: missing access token');
      }

      // ── Inject images từ ref_file_ids vào last user message ──────────────
      // uploadFile() trả về data: URL dưới dạng file_id.
      // Đây là cơ chế để Zen gửi ảnh qua upload API mà không cần server riêng.
      const effectiveMessages = this.injectRefFileImages(messages, ref_file_ids);

      // ── Resolve RUNTIME region từ profileArn (không phải stored IdC region) ──
      const resolvedRegion = resolveKiroRuntimeRegion(authData);
      const body = this.buildConversationPayload(
        effectiveMessages,
        model,
        authData.profileArn,
      );

      const buildHeaders = (
        token: string,
        authMethod?: string,
      ): Record<string, string> => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-amz-json-1.0',
          'X-Amz-Target':
            'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
          Accept: 'application/vnd.amazon.eventstream',
          'Amz-Sdk-Request': 'attempt=1; max=3',
          'Amz-Sdk-Invocation-Id': uuidv4(),
          'x-amzn-bedrock-cache-control': 'enable',
        };
        // API key auth cần header tokentype
        if (authMethod === 'api_key') {
          headers['tokentype'] = 'API_KEY';
        }
        return headers;
      };

      // ── Determine endpoint ──
      // Social auth (google/github) và Builder ID → Kiro branded gateway (us-east-1)
      // API key, IDC → direct CodeWhisperer/Q endpoint
      const isCodeWhispererOnly =
        authData.authMethod === 'api_key' || authData.authMethod === 'idc';
      const regionalUrl =
        kiroRuntimeHost(resolvedRegion) + '/generateAssistantResponse';
      const baseUrl =
        resolvedRegion === DEFAULT_REGION && !isCodeWhispererOnly
          ? 'https://runtime.us-east-1.kiro.dev/generateAssistantResponse'
          : regionalUrl;

      let headers = buildHeaders(authData.accessToken, authData.authMethod);
      let response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // ── Auto-refresh on 401/403 then retry ──
      if (
        (response.status === 401 || response.status === 403) &&
        authData.refreshToken
      ) {
        const refreshed = await this.refreshToken(credential);

        if (refreshed && !refreshed.error && refreshed.accessToken) {
          // Cập nhật authData với token mới, preserve các fields còn lại
          authData = {
            ...authData,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            // Nếu client được re-register, cập nhật client credentials
            ...(refreshed._newClientId
              ? {
                  clientId: refreshed._newClientId,
                  clientSecret: refreshed._newClientSecret,
                  clientSecretExpiresAt: refreshed._newClientSecretExpiresAt,
                }
              : {}),
          };

          // Persist refreshed credential
          if (onCredentialRotated) {
            onCredentialRotated(JSON.stringify(authData));
          }

          headers = buildHeaders(authData.accessToken, authData.authMethod);
          response = await fetch(baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
        }
      }

      // ── Fallback to direct CodeWhisperer endpoint nếu vẫn lỗi ──
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const fallbackUrl = regionalUrl;
          if (fallbackUrl !== baseUrl) {
            const fallbackResponse = await fetch(fallbackUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });
            if (!fallbackResponse.ok) {
              const errText = await fallbackResponse.text();
              throw new Error(
                `Kiro API error ${fallbackResponse.status}: ${errText}`,
              );
            }
            await this.processEventStream(
              fallbackResponse as any,
              onContent,
              onThinking,
            );
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
   * Inject ảnh từ ref_file_ids vào last user message dưới dạng image_url blocks.
   *
   * Kiro không có upload API — uploadFile() lưu ảnh dưới dạng data: URL trong file_id.
   * Hàm này lấy các data: URL đó và thêm vào content của last user message
   * để buildConversationPayload() có thể extract ra images array.
   *
   * Chỉ xử lý image (file_id bắt đầu bằng "data:image/").
   * Non-image file_id bị bỏ qua.
   */
  private injectRefFileImages(
    messages: Array<{ role: string; content: string | any[] }>,
    refFileIds?: SendMessageOptions['ref_file_ids'],
  ): Array<{ role: string; content: string | any[] }> {
    if (!refFileIds || refFileIds.length === 0) return messages;

    // Chỉ lấy entries có file_id dạng data:image/...
    const imageDataUrls: string[] = [];
    for (const ref of refFileIds) {
      if (typeof ref === 'string') {
        if (ref.startsWith('data:image/')) imageDataUrls.push(ref);
      } else if (ref && typeof ref === 'object') {
        const fid = (ref as any).file_id || (ref as any).url || '';
        if (typeof fid === 'string' && fid.startsWith('data:image/')) {
          imageDataUrls.push(fid);
        }
      }
    }

    if (imageDataUrls.length === 0) return messages;

    // Clone messages, inject image_url blocks vào last user message
    const cloned = messages.map((m) => ({ ...m }));
    for (let i = cloned.length - 1; i >= 0; i--) {
      if (cloned[i].role === 'user') {
        const existing = cloned[i].content;
        const imageBlocks = imageDataUrls.map((url) => ({
          type: 'image_url',
          image_url: { url },
        }));

        if (typeof existing === 'string') {
          // Convert string → array, append image blocks
          cloned[i] = {
            ...cloned[i],
            content: [
              { type: 'text', text: existing },
              ...imageBlocks,
            ],
          };
        } else if (Array.isArray(existing)) {
          cloned[i] = {
            ...cloned[i],
            content: [...existing, ...imageBlocks],
          };
        }
        break;
      }
    }

    return cloned;
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

    // Chỉ Claude models hỗ trợ image attachments trên Kiro API.
    // Non-Claude models (deepseek, minimax, glm, qwen3-coder-next) sẽ reject nếu gửi images.
    const supportsImages = normalizedModel.toLowerCase().includes('claude');

    /**
     * Extract base64 images từ một OpenAI message content array.
     * Hỗ trợ 3 format:
     * - image_url với data URL: { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
     * - Anthropic image block: { type: "image", source: { type: "base64", media_type: "...", data: "..." } }
     * - AI SDK image part:     { type: "image", image: "data:image/jpeg;base64,..." }
     */
    const extractImages = (
      content: any[],
    ): Array<{ format: string; source: { bytes: string } }> => {
      if (!supportsImages) return [];
      const images: Array<{ format: string; source: { bytes: string } }> = [];
      for (const block of content) {
        if (block.type === 'image_url') {
          const url: string = block.image_url?.url || '';
          if (url.startsWith('data:')) {
            const [header, bytes] = url.split(',', 2);
            const format = header.split(';')[0].replace('data:', '').split('/')[1] || 'jpeg';
            if (bytes) images.push({ format, source: { bytes } });
          }
        } else if (block.type === 'image' && block.source?.type === 'base64') {
          const format = (block.source.media_type || 'image/jpeg').split('/')[1] || 'jpeg';
          if (block.source.data) images.push({ format, source: { bytes: block.source.data } });
        } else if (block.type === 'image' && typeof block.image === 'string') {
          const url = block.image;
          if (url.startsWith('data:')) {
            const [header, bytes] = url.split(',', 2);
            const format = header.split(';')[0].replace('data:', '').split('/')[1] || 'jpeg';
            if (bytes) images.push({ format, source: { bytes } });
          }
        }
      }
      return images;
    };

    // Build history và currentMessage
    const history: any[] = [];
    let systemContent = '';

    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string' ? msg.content : '';
        systemContent += (systemContent ? '\n\n' : '') + text;
      } else if (msg.role === 'user') {
        const text =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('\n')
              : '';
        const images = Array.isArray(msg.content) ? extractImages(msg.content) : [];
        const userMsg: any = {
          userInputMessage: {
            content: text || '(empty)',
            modelId: normalizedModel,
            origin: 'AI_EDITOR',
          },
        };
        if (images.length > 0) {
          userMsg.userInputMessage.images = images;
        }
        history.push(userMsg);
      } else if (msg.role === 'assistant') {
        const text =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('\n')
              : '';
        history.push({
          assistantResponseMessage: { content: text || '(empty)' },
        });
      }
    }

    // Current (last) message
    const lastMsg = messages[messages.length - 1];
    let lastContent =
      typeof lastMsg?.content === 'string'
        ? lastMsg.content
        : Array.isArray(lastMsg?.content)
          ? lastMsg.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n')
          : '';
    const lastImages = Array.isArray(lastMsg?.content) ? extractImages(lastMsg.content) : [];

    // Prepend system prompt vào content của current message
    if (systemContent) {
      lastContent = `<system-reminder>\n${systemContent}\n</system-reminder>\n\n${lastContent}`;
    }

    // Deterministic conversationId từ first user message
    const NAMESPACE_KIRO = '34f7193f-561d-4050-bc84-9547d953d6bf';
    const firstUser = messages.find((m) => m.role === 'user');
    const seed =
      typeof firstUser?.content === 'string'
        ? firstUser.content
        : Array.isArray(firstUser?.content)
          ? firstUser.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join(' ')
          : '';
    const conversationId = seed
      ? uuidv5(seed.substring(0, 4000), NAMESPACE_KIRO)
      : uuidv4();

    const currentUserMsg: any = {
      content: lastContent || '(empty)',
      modelId: normalizedModel,
      origin: 'AI_EDITOR',
    };
    if (lastImages.length > 0) {
      currentUserMsg.images = lastImages;
    }

    const payload: any = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId,
        currentMessage: {
          userInputMessage: currentUserMsg,
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
   *
   * Dùng KiroThinkingParser để wrap raw reasoning text thành
   * <thinking>...</thinking> format nhất quán với các provider khác.
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
    const thinkingParser = createKiroThinkingParser();

    await new Promise<void>((resolve, reject) => {
      const nodeStream = response.body as NodeJS.ReadableStream;

      const processBuffer = () => {
        let iterations = 0;
        while (buffer.length >= 16 && iterations < 1000) {
          iterations++;
          const totalLength = buffer.peekUint32BE(0);
          if (!totalLength || totalLength < 16 || totalLength > buffer.length)
            break;

          const eventData = buffer.read(totalLength);
          if (!eventData) break;

          const event = parseEventFrame(eventData);
          if (!event) continue;

          const eventType = event.headers[':event-type'] || '';

          if (eventType === 'assistantResponseEvent') {
            const content =
              typeof event.payload?.content === 'string'
                ? event.payload.content
                : '';
            if (content) {
              // Nếu đang có pending thinking chưa close, close nó trước
              if (thinkingParser.isActive() && onThinking) {
                const closingTag = thinkingParser.end();
                if (closingTag) onThinking(closingTag);
              }
              onContent(content);
            }
          } else if (eventType === 'reasoningContentEvent') {
            const rp = event.payload as Record<string, unknown> | null;
            const rt = rp?.reasoningText;
            let reasoning = '';
            if (rt && typeof rt === 'object') {
              reasoning =
                typeof (rt as any).text === 'string' ? (rt as any).text : '';
            } else if (typeof rt === 'string') {
              reasoning = rt;
            } else if (typeof rp?.text === 'string') {
              reasoning = rp.text;
            }
            if (reasoning && onThinking) {
              // feed() tự động emit '<thinking>' khi là chunk đầu tiên
              const wrapped = thinkingParser.feed(reasoning);
              onThinking(wrapped);
            }
          }
        }
      };

      nodeStream.on('data', (chunk: Buffer) => {
        buffer.push(
          new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
        );
        processBuffer();
      });

      nodeStream.on('end', () => {
        // Đóng thinking block nếu stream kết thúc mà chưa close
        if (thinkingParser.isActive() && onThinking) {
          const closingTag = thinkingParser.end();
          if (closingTag) onThinking(closingTag);
        }
        resolve();
      });
      nodeStream.on('error', (err: Error) => reject(err));
    });
  }

  // ─── Get Usage ────────────────────────────────────────────────────────

  /**
   * Fetch usage quota từ Kiro/CodeWhisperer GetUsageLimits endpoint.
   *
   * Trả về:
   *   - usage: phần trăm đã dùng (0–100), tính từ resource AGENTIC_REQUEST
   *     hoặc resource đầu tiên có total > 0.
   *   - resetUsageAt: ISO string của ngày reset, hoặc null.
   *
   * Thử theo thứ tự:
   *   1. POST /  (x-amz-target: GetUsageLimits) — canonical, có profileArn
   *   2. GET /getUsageLimits — fallback cho một số account/region
   */
  async getUsage(
    credential: string,
  ): Promise<{ usage: number; resetUsageAt: string | null }> {
    const authData = this.parseAuthData(credential);
    const { accessToken, authMethod } = authData;

    if (!accessToken) {
      throw new Error('[Kiro] getUsage: missing accessToken');
    }

    // Resolve runtime region từ profileArn (không phải IdC region)
    let profileArn = authData.profileArn;
    const resolvedRegion = resolveKiroRuntimeRegion(authData);
    const runtimeHost = kiroRuntimeHost(resolvedRegion);

    // Builder ID không cần profileArn, IDC cần — discover nếu chưa có
    if (
      !profileArn &&
      authMethod !== 'builder-id' &&
      authMethod !== 'api_key'
    ) {
      try {
        profileArn =
          (await this.discoverProfileArn(accessToken, authData.region)) ??
          undefined;
      } catch {
        /* non-fatal */
      }
    }

    if (
      !profileArn &&
      authMethod !== 'builder-id' &&
      authMethod !== 'api_key'
    ) {
      throw new Error('[Kiro] getUsage: profileArn not available');
    }

    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(authMethod === 'api_key' ? { tokentype: 'API_KEY' } : {}),
    };

    const payload: Record<string, unknown> = {
      origin: 'AI_EDITOR',
      resourceType: 'AGENTIC_REQUEST',
      ...(profileArn ? { profileArn } : {}),
    };

    // Attempt 1: POST (canonical)
    let data: Record<string, unknown> | null = null;
    const postRes = await fetch(runtimeHost, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/x-amz-json-1.0',
        'x-amz-target': 'AmazonCodeWhispererService.GetUsageLimits',
      },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (postRes?.ok) {
      data = (await postRes.json()) as Record<string, unknown>;
    }

    // Attempt 2: GET fallback
    if (!data) {
      const qParams = new URLSearchParams({
        origin: 'AI_EDITOR',
        resourceType: 'AGENTIC_REQUEST',
        ...(profileArn ? { profileArn } : {}),
      });
      const getRes = await fetch(`${runtimeHost}/getUsageLimits?${qParams}`, {
        method: 'GET',
        headers: authHeaders,
      }).catch(() => null);

      if (getRes?.ok) {
        data = (await getRes.json()) as Record<string, unknown>;
      } else if (getRes) {
        const errText = await getRes.text().catch(() => '');
        throw new Error(
          `[Kiro] GetUsageLimits failed (${getRes.status}): ${errText.slice(0, 200)}`,
        );
      } else {
        throw new Error('[Kiro] GetUsageLimits: all attempts failed');
      }
    }

    return this.parseKiroUsage(data!);
  }

  /**
   * Parse GetUsageLimits response → { usage %, resetUsageAt }.
   * Ưu tiên resource AGENTIC_REQUEST, fallback về resource đầu tiên có data.
   */
  private parseKiroUsage(data: Record<string, unknown>): {
    usage: number;
    resetUsageAt: string | null;
  } {
    const usageList = Array.isArray(data.usageBreakdownList)
      ? data.usageBreakdownList
      : [];

    // Check overage (unlimited) — nếu enabled, usage = 0 (không giới hạn)
    const overageConfig = (data.overageConfiguration ?? {}) as Record<
      string,
      unknown
    >;
    const overageEnabled =
      String(overageConfig.overageStatus ?? '').toUpperCase() === 'ENABLED' ||
      data.overageEnabled === true ||
      overageConfig.overageEnabled === true;

    if (overageEnabled) {
      return { usage: 0, resetUsageAt: this.parseResetTime(data) };
    }

    // Tìm resource AGENTIC_REQUEST trước, fallback về resource đầu tiên
    const target =
      usageList.find(
        (b: unknown) =>
          typeof (b as any)?.resourceType === 'string' &&
          (b as any).resourceType.toUpperCase() === 'AGENTIC_REQUEST',
      ) ?? usageList[0];

    if (!target) {
      return { usage: 0, resetUsageAt: this.parseResetTime(data) };
    }

    const b = target as Record<string, unknown>;
    const used =
      Number(b.currentUsageWithPrecision ?? b.currentUsage ?? 0) || 0;
    const total = Number(b.usageLimitWithPrecision ?? b.usageLimit ?? 0) || 0;
    const usagePercent =
      total > 0 ? Math.min(100, Math.round((used / total) * 10000) / 100) : 0;

    return { usage: usagePercent, resetUsageAt: this.parseResetTime(data) };
  }

  private parseResetTime(data: Record<string, unknown>): string | null {
    const raw = data.nextDateReset ?? data.resetDate;
    if (raw == null) return null;
    try {
      // AWS trả về Unix timestamp (seconds hoặc milliseconds).
      // Nếu là số < 1e10 thì là seconds → nhân 1000 để ra ms.
      // Nếu là số >= 1e10 thì đã là ms rồi.
      // Nếu là string ISO thì dùng thẳng.
      let ms: number;
      if (typeof raw === 'number') {
        ms = raw < 1e10 ? raw * 1000 : raw;
      } else {
        const parsed = Number(raw);
        if (
          !isNaN(parsed) &&
          String(raw)
            .trim()
            .match(/^\d+(\.\d+)?$/)
        ) {
          ms = parsed < 1e10 ? parsed * 1000 : parsed;
        } else {
          ms = new Date(raw as string).getTime();
        }
      }
      return isNaN(ms) ? null : new Date(ms).toISOString();
    } catch {
      return null;
    }
  }

  // ─── Upload File ──────────────────────────────────────────────────────

  /**
   * Kiro không có upload API — encode file thành data URL và trả về
   * dưới dạng file_id. Khi gửi message, chat.controller sẽ thấy file_id
   * dạng "data:..." và đưa vào image_url block trong messages.
   *
   * Chỉ hỗ trợ image (Claude models trên Kiro mới nhận được ảnh).
   * File không phải image → throw lỗi rõ ràng.
   */
  async uploadFile(
    _credential: string,
    file: Express.Multer.File,
  ): Promise<{ id: string; url: string }> {
    const mimeType = file.mimetype || 'application/octet-stream';

    if (!mimeType.startsWith('image/')) {
      throw new Error(
        `Kiro only supports image attachments (received: ${mimeType})`,
      );
    }

    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return { id: dataUrl, url: dataUrl };
  }

  // ─── Get Models ───────────────────────────────────────────────────────

  /**
   * Lấy danh sách model từ Kiro/CodeWhisperer ListAvailableModels API.
   *
   * Model catalog là per-account/per-tier — free tier, Pro, Pro+ và enterprise IDC
   * admin-curated list cho các bộ model khác nhau.
   *
   * Attempt order (dừng khi thành công):
   *   1. GET /ListAvailableModels?origin=AI_EDITOR trên region-matched endpoint
   *   2. GET /ListAvailableModels?origin=AI_EDITOR trên us-east-1 fallback (nếu region khác)
   *   3. GET /ListAvailableModels?origin=AI_EDITOR&profileArn=... chỉ khi có profileArn
   *      (desktop accounts yêu cầu; Builder ID/IDC không gửi để tránh 403)
   *
   * Fallback về MODELS constant nếu tất cả attempt thất bại hoặc không có access token.
   */
  async getModels(credential: string): Promise<any[]> {
    const authData = this.parseAuthData(credential);
    const { accessToken, authMethod } = authData;

    if (!accessToken) {
      logger.warn('[Kiro] getModels: no access token, returning hardcoded models');
      return [...MODELS];
    }

    const resolvedRegion = resolveKiroRuntimeRegion(authData);

    // Build ordered endpoint list: region-matched đầu tiên, us-east-1 fallback nếu khác
    const endpoints: string[] = [
      `https://q.${resolvedRegion}.amazonaws.com/ListAvailableModels`,
    ];
    if (resolvedRegion !== 'us-east-1') {
      endpoints.push('https://q.us-east-1.amazonaws.com/ListAvailableModels');
    }

    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'x-amzn-kiro-agent-mode': 'vibe',
      'x-amzn-codewhisperer-optout': 'true',
      'amz-sdk-request': 'attempt=1; max=1',
    };
    if (authMethod === 'api_key') {
      authHeaders['tokentype'] = 'API_KEY';
    }

    // Pass 1: origin-only — works cho Builder ID / social / IDC
    for (const base of endpoints) {
      try {
        const res = await fetch(`${base}?origin=AI_EDITOR`, {
          method: 'GET',
          headers: authHeaders,
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const models = this.parseKiroModels(data);
          if (models.length > 0) return models;
        }
      } catch {
        /* try next */
      }
    }

    // Pass 2: retry với profileArn trên primary endpoint
    // Chỉ dùng cho desktop-style accounts — không gửi cho Builder ID / IDC (có thể 403)
    const profileArn = authData.profileArn;
    if (
      profileArn &&
      authMethod !== 'builder-id' &&
      authMethod !== 'idc'
    ) {
      try {
        const url = `${endpoints[0]}?origin=AI_EDITOR&profileArn=${encodeURIComponent(profileArn)}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: authHeaders,
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const models = this.parseKiroModels(data);
          if (models.length > 0) return models;
        }
      } catch {
        /* fall through to hardcoded */
      }
    }

    // Fallback: hardcoded MODELS constant
    logger.warn('[Kiro] getModels: ListAvailableModels failed, returning hardcoded models');
    return [...MODELS];
  }

  /**
   * Parse ListAvailableModels response → model array theo format Provider.
   *
   * Response shape:
   *   { models: [{ modelId, modelName?, tokenLimits?: { maxInputTokens } }] }
   *
   * Expand variant `-thinking` cho model hỗ trợ adaptive thinking
   * (claude-sonnet-*, claude-haiku-* hiện tại theo kiroModels.ts).
   */
  private parseKiroModels(data: Record<string, unknown>): any[] {
    const items = Array.isArray(data.models)
      ? data.models
      : Array.isArray(data.availableModels)
        ? data.availableModels
        : [];

    if (items.length === 0) return [];

    const THINKING_CAPABLE_PREFIXES = ['claude-sonnet', 'claude-haiku', 'claude-opus'];

    const supportsThinking = (modelId: string): boolean =>
      THINKING_CAPABLE_PREFIXES.some((prefix) => modelId.startsWith(prefix));

    const seen = new Set<string>();
    const result: any[] = [];

    for (const item of items) {
      const raw = item as Record<string, unknown>;
      const id =
        (typeof raw.modelId === 'string' ? raw.modelId.trim() : null) ||
        (typeof raw.id === 'string' ? raw.id.trim() : null);
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const name =
        (typeof raw.modelName === 'string' ? raw.modelName.trim() : null) ||
        (typeof raw.name === 'string' ? raw.name.trim() : null) ||
        `Kiro ${id}`;

      const tokenLimits = (raw.tokenLimits ?? {}) as Record<string, unknown>;
      const contextLength =
        typeof tokenLimits.maxInputTokens === 'number'
          ? tokenLimits.maxInputTokens
          : 200000;

      result.push({
        id,
        name: `Kiro ${name}`,
        is_thinking: false,
        max_context_length: contextLength,
        is_search: false,
        is_image_upload: false,
        is_video_upload: false,
        is_audio_upload: false,
        is_file_upload: false,
        is_larger_content_paste_upload: false,
        is_image_generator: false,
        is_video_generator: false,
        is_deep_research: false,
      });

      // Thêm variant thinking cho model hỗ trợ adaptive thinking
      if (supportsThinking(id)) {
        const thinkingId = `${id}-thinking`;
        if (!seen.has(thinkingId)) {
          seen.add(thinkingId);
          result.push({
            id: thinkingId,
            name: `Kiro ${name} (Thinking)`,
            is_thinking: true,
            max_context_length: contextLength,
            is_search: false,
            is_image_upload: false,
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
    }

    return result;
  }
}

export default new KiroProvider();
