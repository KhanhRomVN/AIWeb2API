import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MistralProvider');

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (
      host &&
      (host.includes('auth.mistral.ai') || host.includes('console.mistral.ai'))
    ) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.length > 0) {
        logger.debug('[Proxy] Captured Mistral cookies');
        proxyEvents.emit('mistral-cookies', reqCookies);
      }
    }
    callback();
  },
};
