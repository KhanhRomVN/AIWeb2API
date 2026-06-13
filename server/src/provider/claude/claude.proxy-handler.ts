import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy-events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ClaudeProvider');

let lastCapturedCookies = '';

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('claude.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (
        reqCookies &&
        reqCookies.includes('sessionKey=') &&
        reqCookies !== lastCapturedCookies
      ) {
        lastCapturedCookies = reqCookies;
        logger.debug('[Proxy] Captured NEW Claude sessionKey cookie');
        proxyEvents.emit('claude-cookies', reqCookies);
      }
    }
    callback();
  },
};
