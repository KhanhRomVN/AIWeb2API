/**
 * ------------------------------------------------------------------
 * Kiro Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Kiro với OAuth Device Code Flow.
 * Sử dụng AWS OIDC Device Authorization Grant cho Google/GitHub login.
 *
 * Main features:
 * - login()                    : Đăng nhập qua OAuth Device Code Flow
 * - initiateDeviceAuthorization: Bắt đầu device flow, lấy user_code
 * - pollForTokens()            : Polling để lấy tokens sau khi user authorize
 * - getProfile()               : Lấy thông tin user profile
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

// ── Kiro Imports ──
import { proxyHandler } from './kiro.proxy-handler';
import { BASE_URL, DEVICE_CODE_FLOW } from './kiro.constant';
import type {
  KiroAuthData,
  DeviceCodeResponse,
  DeviceTokenResponse,
  DeviceCodeError,
} from './kiro.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KiroProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class KiroProvider implements Provider {
  name = 'Kiro';
  proxyHandler = proxyHandler;

  // ─── Device Authorization Flow ─────────────────────────────────────

  /**
   * Step 1: Initiate device authorization
   * Gọi AWS OIDC device authorization endpoint để lấy device_code và user_code
   */
  private async initiateDeviceAuthorization(
    authMethod: 'google' | 'github',
  ): Promise<DeviceCodeResponse> {
    // Register OIDC client first
    const clientRegistration = await this.registerOIDCClient();

    // AWS OIDC device_authorization requires JSON body with clientId, clientSecret, startUrl
    const response = await fetch(DEVICE_CODE_FLOW.DEVICE_AUTHORIZATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        clientId: clientRegistration.clientId,
        clientSecret: clientRegistration.clientSecret,
        startUrl: DEVICE_CODE_FLOW.START_URL,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Kiro] Device authorization failed:', errorText);
      throw new Error(`Device authorization failed: ${response.status}`);
    }

    const data = (await response.json()) as any;

    // AWS OIDC returns camelCase fields
    const deviceCodeResponse: DeviceCodeResponse = {
      device_code: data.deviceCode,
      user_code: data.userCode,
      verification_uri:
        data.verificationUri || DEVICE_CODE_FLOW.VERIFICATION_URI,
      verification_uri_complete: data.verificationUriComplete,
      expires_in: data.expiresIn || 600,
      interval: data.interval || 5,
    };

    // Store client credentials for token polling
    (deviceCodeResponse as any).clientId = clientRegistration.clientId;
    (deviceCodeResponse as any).clientSecret = clientRegistration.clientSecret;

    return deviceCodeResponse;
  }

  /**
   * Register OIDC client với AWS
   * Tạo dynamic client để sử dụng trong device flow
   */
  private async registerOIDCClient(): Promise<{
    clientId: string;
    clientSecret: string;
    clientSecretExpiresAt: number;
  }> {
    const response = await fetch(DEVICE_CODE_FLOW.REGISTER_CLIENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        clientName: DEVICE_CODE_FLOW.CLIENT_NAME,
        clientType: DEVICE_CODE_FLOW.CLIENT_TYPE,
        scopes: DEVICE_CODE_FLOW.SCOPES,
        grantTypes: DEVICE_CODE_FLOW.GRANT_TYPES,
        issuerUrl: DEVICE_CODE_FLOW.ISSUER_URL,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Kiro] OIDC client registration failed:', errorText);
      throw new Error(`OIDC client registration failed: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return {
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      clientSecretExpiresAt: data.clientSecretExpiresAt || 0,
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
        const response = await fetch(DEVICE_CODE_FLOW.TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            clientId,
            clientSecret,
            deviceCode: deviceCode,
            grantType: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          return {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresIn: data.expiresIn || 3600,
            tokenType: data.tokenType || 'Bearer',
          };
        }

        // Check for errors
        const errorData = (await response.json()) as DeviceCodeError;

        if (errorData.error === 'authorization_pending') {
          continue;
        }

        if (errorData.error === 'slow_down') {
          interval += 5000;
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
    const method = options?.kiroMethod || 'google';
    try {
      // Step 1: Lấy device code và user code
      const deviceAuth = await this.initiateDeviceAuthorization(method);

      // Build device verification URL
      const deviceVerificationUrl = `${DEVICE_CODE_FLOW.VERIFICATION_URI}?user_code=${deviceAuth.user_code}`;

      // Build enhanced signin URL with provider pre-selection and redirect
      // Format: /signin?user_code=XXX&login_provider=Github&redirect_to_after_auth=/account/device?user_code=XXX
      const loginProvider = method === 'github' ? 'Github' : 'Google';
      const encodedRedirect = encodeURIComponent(
        `/account/device?user_code=${deviceAuth.user_code}`,
      );
      const enhancedSigninUrl = `https://app.kiro.dev/signin?user_code=${deviceAuth.user_code}&login_provider=${loginProvider}&redirect_to_after_auth=${encodedRedirect}`;

      // Auto-open browser with enhanced signin URL
      this.openBrowser(enhancedSigninUrl);

      // Step 2: Poll for tokens
      const tokens = await this.pollForTokens(
        deviceAuth.device_code,
        (deviceAuth as any).clientId,
        (deviceAuth as any).clientSecret,
        deviceAuth.interval * 1000,
      );

      // Step 3: Get user profile
      let email = '';
      try {
        const profile = await this.getProfile(tokens.accessToken);
        email = profile.email || `kiro-${method}-${Date.now()}@kiro.local`;
      } catch (e) {
        email = `kiro-${method}-${Date.now()}@kiro.local`;
      }

      // Step 4: Tạo auth data object
      const authData: KiroAuthData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        authMethod: 'device',
        clientId: (deviceAuth as any).clientId,
        clientSecret: (deviceAuth as any).clientSecret,
        region: 'us-east-1',
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

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const authData = this.parseAuthData(credential);

      const response = await fetch(`${BASE_URL}/api/user/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authData.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn(`[Kiro] Get Profile returned status ${response.status}`);
        return { email: null };
      }

      const data: any = await response.json();

      return {
        email: data.email || data.user?.email || null,
        name: data.name || data.user?.name || data.displayName,
        id: data.id || data.userId || data.user?.id,
      };
    } catch (e) {
      logger.error('[Kiro] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Auth Data Parser ───────────────────────────────────────────────

  private parseAuthData(credential: string): KiroAuthData {
    try {
      const parsed = JSON.parse(credential);
      return {
        accessToken: parsed.accessToken || credential,
        refreshToken: parsed.refreshToken || '',
        authMethod: parsed.authMethod || 'device',
        expiresIn: parsed.expiresIn,
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        region: parsed.region || 'us-east-1',
      };
    } catch {
      // Nếu không parse được, coi như là access token thuần
      return {
        accessToken: credential,
        refreshToken: '',
        authMethod: 'device',
        region: 'us-east-1',
      };
    }
  }

  // ─── Handle Message (Placeholder) ───────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { onError } = options;
    onError(new Error('Kiro handleMessage not implemented yet'));
  }

  // ─── Routes ─────────────────────────────────────────────────────────

  registerRoutes(_router: Router) {}

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    return model.toLowerCase().includes('kiro');
  }
}

export default new KiroProvider();
