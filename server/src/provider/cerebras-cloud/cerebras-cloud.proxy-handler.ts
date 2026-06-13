import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy-events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CerebrasProxy');

// =============================================================================
// PROXY HANDLER
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('cloud.cerebras.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('authjs.session-token')) {
        logger.debug('[Proxy] Captured Cerebras session-token cookie');
        proxyEvents.emit('cerebras-cookies', reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('cloud.cerebras.ai') &&
      url.includes('/api/auth/session')
    ) {
      try {
        const json = JSON.parse(body);
        if (json?.user?.email) {
          logger.info(
            `[Proxy] Captured Cerebras user email: ${json.user.email}`,
          );
          proxyEvents.emit('cerebras-user-info', {
            email: json.user.email,
            name: json.user.name,
            id: json.user.id,
          });
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  },
};