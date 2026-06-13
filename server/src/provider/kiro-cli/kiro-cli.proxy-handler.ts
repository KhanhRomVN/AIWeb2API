import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy-events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('KiroCLIProvider');

export const proxyHandler: ProxyHandler = {
  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && (host.includes('kiro.dev') || host.includes('amazonaws.com'))) {
      logger.debug(`[Proxy] Response from ${host}${url}`);
    }

    if (
      host &&
      host.includes('auth.desktop.kiro.dev') &&
      (url.includes('/refreshToken') || url.includes('/oauth/token'))
    ) {
      logger.info(`[Proxy] Detected Kiro auth token request (${url})`);
      try {
        const json = JSON.parse(body);
        if (json.accessToken) {
          logger.info('[Proxy] Successfully captured access token.');
          const sessionData = {
            access_token: json.accessToken,
            refresh_token: json.refreshToken || '',
            expires_at: new Date(
              Date.now() + (json.expiresIn || 3600) * 1000,
            ).toISOString(),
            provider: json.provider || 'google',
            profile_arn: json.profileArn || '',
            email: json.email || '',
          };
          proxyEvents.emit('kiro-cli-tokens', {
            cookies: JSON.stringify(sessionData),
            email: json.email || '',
          });
        } else {
          logger.warn(`[Proxy] refreshToken responded but no accessToken: ${body.substring(0, 500)}`);
        }
      } catch (e: any) {
        logger.error(`[Proxy] Failed to parse Kiro auth response: ${e.message}`);
      }
    }

    if (
      host &&
      host.includes('amazonaws.com') &&
      url.includes('ListAvailableModels')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.models) {
          logger.info(`[Proxy] Captured ${json.models.length} models from AWS.`);
          proxyEvents.emit('kiro-cli-models', json.models);
        }
      } catch (e) {}
    }
  },
};
