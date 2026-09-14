/**
 * ------------------------------------------------------------------
 * Kiro Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Kiro với OAuth Device Code Flow.
 * Sử dụng AWS OIDC Device Authorization Grant cho Google/GitHub login.
 *
 * Main features:
 * - login()                     : Đăng nhập qua OAuth Device Code Flow
 * - initiateDeviceAuthorization : Bắt đầu device flow, lấy user_code
 * - pollForTokens()             : Polling để lấy tokens sau khi user authorize
 * - getUserProfile()            : Lấy thông tin user profile
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';
import fetch from 'node-fetch';
import { exec } from 'child_process';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Kiro Constants ──
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  BASE_URLS,
  DEVICE_CODE_FLOW,
  API_FIELDS,
  API_PATHS,
  AUTH_DATA_DEFAULTS,
  AUTH_METHODS,
  CONTENT_TYPES,
  DEFAULT_REGION,
  DEVICE_CODE_DEFAULTS,
  FALLBACK_EMAIL,
  HTTP_HEADER_NAMES,
  HTTP_HEADERS,
} from './kiro.constant';

// ── Kiro Types ──
import type {
  KiroAuthData,
  KiroAuthMethod,
  KiroClientRegistrationRequest,
  KiroClientRegistrationResponse,
  KiroDeviceAuthorizationRequest,
  KiroDeviceAuthorizationResponse,
  KiroTokenPollRequest,
  KiroTokenPollResponse,
  KiroUserProfileResponse,
  DeviceCodeResponse,
  DeviceTokenResponse,
  DeviceCodeError,
} from './kiro.types';

// ── Kiro Internal ──
import { proxyHandler } from './kiro.proxy-handler';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KiroProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class KiroProvider implements Provider {
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
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Device Authorization Flow ─────────────────────────────────────

  /**
   * Step 1: Initiate device authorization
   * Gọi AWS OIDC device authorization endpoint để lấy device_code và user_code
   */
  private async initiateDeviceAuthorization(
    authMethod: KiroAuthMethod,
  ): Promise<DeviceCodeResponse> {
    // Register OIDC client first
    const clientRegistration = await this.registerOIDCClient();

    // AWS OIDC device_authorization requires JSON body with clientId, clientSecret, startUrl
    const requestBody: KiroDeviceAuthorizationRequest = {
      clientId: clientRegistration.clientId,
      clientSecret: clientRegistration.clientSecret,
      startUrl: DEVICE_CODE_FLOW.START_URL,
    };

    const response = await fetch(DEVICE_CODE_FLOW.DEVICE_AUTHORIZATION_URL, {
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
      throw new Error(`Device authorization failed: ${response.status}`);
    }

    const data = (await response.json()) as KiroDeviceAuthorizationResponse;

    // AWS OIDC returns camelCase fields
    const deviceCodeResponse: DeviceCodeResponse = {
      device_code: data[API_FIELDS.DEVICE_CODE],
      user_code: data[API_FIELDS.USER_CODE],
      verification_uri:
        data[API_FIELDS.VERIFICATION_URI] || DEVICE_CODE_FLOW.VERIFICATION_URI,
      verification_uri_complete:
        data[API_FIELDS.VERIFICATION_URI_COMPLETE],
      expires_in:
        data[API_FIELDS.EXPIRES_IN] || DEVICE_CODE_DEFAULTS.EXPIRES_SEC,
      interval:
        data[API_FIELDS.INTERVAL] || DEVICE_CODE_DEFAULTS.INTERVAL_SEC,
    };

    // Store client credentials for token polling
    deviceCodeResponse.clientId = clientRegistration.clientId;
    deviceCodeResponse.clientSecret = clientRegistration.clientSecret;

    return deviceCodeResponse;
  }

  /**
   * Register OIDC client với AWS
   * Tạo dynamic client để sử dụng trong device flow
   */
  private async registerOIDCClient(): Promise<KiroClientRegistrationResponse> {
    const requestBody: KiroClientRegistrationRequest = {
      clientName: DEVICE_CODE_FLOW.CLIENT_NAME,
      clientType: DEVICE_CODE_FLOW.CLIENT_TYPE,
      scopes: DEVICE_CODE_FLOW.SCOPES,
      grantTypes: DEVICE_CODE_FLOW.GRANT_TYPES,
      issuerUrl: DEVICE_CODE_FLOW.ISSUER_URL,
    };

    const response = await fetch(DEVICE_CODE_FLOW.REGISTER_CLIENT_URL, {
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
      throw new Error(`OIDC client registration failed: ${response.status}`);
    }

    const data = (await response.json()) as KiroClientRegistrationResponse;
    return {
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      clientSecretExpiresAt:
        data[API_FIELDS.CLIENT_SECRET_EXPIRES_AT] || 0,
    };
  }

  /**
   * Step 2: Poll for tokens
   * Polling AWS OIDC token endpoint cho đến khi user authorize
   */
  private async pollForTokens(
    deviceCode: string,
    clientId: string,
    clientSecret: string,
    interval: number = DEVICE_CODE_FLOW.POLLING_INTERVAL,
  ): Promise<DeviceTokenResponse> {
    const startTime = Date.now();
    const maxWaitTime = DEVICE_CODE_FLOW.DEVICE_CODE_EXPIRES;

    while (Date.now() - startTime < maxWaitTime) {
      await this.sleep(interval);

      try {
        const requestBody: KiroTokenPollRequest = {
          clientId,
          clientSecret,
          deviceCode: deviceCode,
          grantType: DEVICE_CODE_FLOW.GRANT_TYPES[0],
        };

        const response = await fetch(DEVICE_CODE_FLOW.TOKEN_URL, {
          method: 'POST',
          headers: {
            [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
            [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = (await response.json()) as KiroTokenPollResponse;
          return {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresIn:
              data[API_FIELDS.EXPIRES_IN] ||
              DEVICE_CODE_DEFAULTS.TOKEN_EXPIRES_SEC,
            tokenType:
              data[API_FIELDS.TOKEN_TYPE] ||
              DEVICE_CODE_DEFAULTS.TOKEN_TYPE,
          };
        }

        // Check for errors
        const errorData = (await response.json()) as DeviceCodeError;

        if (errorData.error === 'authorization_pending') {
          continue;
        }

        if (errorData.error === 'slow_down') {
          interval += DEVICE_CODE_DEFAULTS.SLOW_DOWN_INCREMENT_MS;
          continue;
        }

        if (errorData.error === 'access_denied') {
          logger.error('[Kiro] User denied authorization');
          throw new Error('User denied authorization');
        }

        if (errorData.error === 'expired_token') {
          logger.error('[Kiro] Device code expired');
          throw new Error('Device code expired. Please try again.');
        }

        logger.error('[Kiro] Unknown error:', errorData);
        throw new Error(`Token polling failed: ${errorData.error}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('denied')) {
          throw error;
        }
        logger.warn('[Kiro] Polling error (will retry):', error);
        continue;
      }
    }

    throw new Error('Device code authorization timeout. Please try again.');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Auto-open browser helper
   * Cross-platform browser launcher
   */
  private openBrowser(url: string): void {
    const platform = process.platform;

    let cmd: string;
    if (platform === 'darwin') {
      // macOS
      cmd = `open "${url}"`;
    } else if (platform === 'win32') {
      // Windows
      cmd = `start "" "${url}"`;
    } else {
      // Linux
      cmd = `xdg-open "${url}"`;
    }

    exec(cmd, (error) => {
      if (error) {
        logger.warn('[Kiro] Could not auto-open browser:', error.message);
      }
    });
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { kiroMethod?: 'google' | 'github' }) {
    const method: KiroAuthMethod = options?.kiroMethod || AUTH_METHODS.GOOGLE;
    try {
      // Step 1: Lấy device code và user code
      const deviceAuth = await this.initiateDeviceAuthorization(method);

      // Build enhanced signin URL with provider pre-selection and redirect
      // Format: /signin?user_code=XXX&login_provider=Github&redirect_to_after_auth=/account/device?user_code=XXX
      const loginProvider =
        method === AUTH_METHODS.GITHUB ? 'Github' : 'Google';
      const encodedRedirect = encodeURIComponent(
        `${API_PATHS.DEVICE}?user_code=${deviceAuth.user_code}`,
      );
      const enhancedSigninUrl = `${BASE_URLS.KIRO_APP}${API_PATHS.SIGNIN}?user_code=${deviceAuth.user_code}&login_provider=${loginProvider}&redirect_to_after_auth=${encodedRedirect}`;

      // Auto-open browser with enhanced signin URL
      this.openBrowser(enhancedSigninUrl);

      // Step 2: Poll for tokens
      const tokens = await this.pollForTokens(
        deviceAuth.device_code,
        deviceAuth.clientId || '',
        deviceAuth.clientSecret || '',
        deviceAuth.interval * 1000,
      );

      // Step 3: Get user profile
      let email = '';
      const fallbackEmail = `${FALLBACK_EMAIL.PREFIX}${method}-${Date.now()}${FALLBACK_EMAIL.SUFFIX}`;
      try {
        const profile = await this.getUserProfile(tokens.accessToken);
        email = profile.email || fallbackEmail;
      } catch (e) {
        email = fallbackEmail;
      }

      // Step 4: Tạo auth data object
      const authData: KiroAuthData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        authMethod: AUTH_METHODS.DEVICE,
        clientId: deviceAuth.clientId,
        clientSecret: deviceAuth.clientSecret,
        region: DEFAULT_REGION,
      };

      return {
        success: true,
        cookies: JSON.stringify(authData),
        email,
      };
    } catch (error) {
      logger.error('[Kiro] Login failed:', error);
      throw error;
    }
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(credential: string): Promise<{ email: string | null }> {
    try {
      const authData = this.parseAuthData(credential);

      const response = await fetch(`${BASE_URL}${API_PATHS.USER_PROFILE}`, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `${HTTP_HEADERS.BEARER_PREFIX}${authData.accessToken}`,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        },
      });

      if (!response.ok) {
        logger.warn(`[Kiro] Get Profile returned status ${response.status}`);
        return { email: null };
      }

      const data = (await response.json()) as KiroUserProfileResponse;

      return {
        email:
          data[API_FIELDS.EMAIL] ||
          data[API_FIELDS.USER]?.[API_FIELDS.EMAIL] ||
          null,
      };
    } catch (e) {
      logger.error('[Kiro] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Auth Data Parser ───────────────────────────────────────────────

  private parseAuthData(credential: string): KiroAuthData {
    try {
      const parsed = JSON.parse(credential) as Partial<KiroAuthData>;
      return {
        accessToken: parsed.accessToken || credential,
        refreshToken: parsed.refreshToken || AUTH_DATA_DEFAULTS.REFRESH_TOKEN,
        authMethod: parsed.authMethod || AUTH_DATA_DEFAULTS.METHOD,
        expiresIn: parsed.expiresIn,
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        region: parsed.region || DEFAULT_REGION,
      };
    } catch {
      // Nếu không parse được, coi như là access token thuần
      return {
        accessToken: credential,
        refreshToken: AUTH_DATA_DEFAULTS.REFRESH_TOKEN,
        authMethod: AUTH_DATA_DEFAULTS.METHOD,
        region: DEFAULT_REGION,
      };
    }
  }

  // ─── Handle Message (Placeholder) ───────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { onError } = options;
    onError(new Error('Kiro handleMessage not implemented yet'));
  }
}

export default new KiroProvider();