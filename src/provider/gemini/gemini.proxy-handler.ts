import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GeminiProxy');

// =============================================================================
// PROXY HANDLER
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('gemini.google.com')) {
      logger.debug(`[Proxy] Gemini Request: ${url}`);

      // Capture cookies from authenticated requests
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies) {
        // Check if this looks like a valid authenticated session
        const hasSID = reqCookies.includes('SID=');
        const hasSecure1PSID = reqCookies.includes('__Secure-1PSID=');
        if (hasSID && hasSecure1PSID) {
          logger.info('[Proxy] Captured Gemini authenticated cookies');
          proxyEvents.emit('gemini-cookies', { cookies: reqCookies });

          // Extract SAPISID for auth header
          const sapisidMatch = reqCookies.match(/SAPISID=([^;]+)/);
          if (sapisidMatch) {
            proxyEvents.emit('gemini-sapisid', { sapisid: sapisidMatch[1] });
          }
        }
      }

      // Capture auth user from URL path
      const authUserMatch = url.match(/\/u\/(\d+)\//);
      if (authUserMatch) {
        proxyEvents.emit('gemini-auth-user', { authUser: authUserMatch[1] });
      }
    }

    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // Capture email from Google account info (multiple sources)
    const emailMatch =
      body.match(
        /"email"\s*:\s*"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})"/,
      ) || body.match(/"oPEP7c"\s*:\s*"([^"]+)"/);

    if (
      host &&
      host.includes('www.googleapis.com') &&
      url.includes('oauth2') &&
      url.includes('userinfo')
    ) {
      // GET /oauth2/v1/userinfo — cleanest JSON source
      if (emailMatch && emailMatch[1]) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (userinfo): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes('accounts.google.com') &&
      (url.includes('signin/oauth') || url.includes('userinfo'))
    ) {
      if (emailMatch && emailMatch[1] && !emailMatch[1].includes('***')) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (accounts): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes('gemini.google.com') &&
      url.includes('batchexecute') &&
      body.includes('o30O0e') &&
      body.includes('@')
    ) {
      // batchexecute rpcid=o30O0e — Gemini profile RPC contains email
      if (emailMatch && emailMatch[1]) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (batchexecute): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    }

    // Capture XSRF token from Gemini page source
    if (host && host.includes('gemini.google.com') && body.includes('SNlM0e')) {
      const xsrfMatch = body.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
      if (xsrfMatch && xsrfMatch[1]) {
        logger.info('[Proxy] Captured Gemini XSRF token');
        proxyEvents.emit('gemini-xsrf', { xsrfToken: xsrfMatch[1] });
      }
    }
  },
};