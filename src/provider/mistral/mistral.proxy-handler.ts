/**
 * ------------------------------------------------------------------
 * Mistral Proxy Handler
 * ------------------------------------------------------------------
 * Capture cookies từ auth.mistral.ai và console.mistral.ai.
 * ------------------------------------------------------------------
 */

import type { ProxyHandler } from '../../services/proxy.service';
import { createCookieCaptureHandler } from '../_shared/proxy/cookie-capture-handler';
import { MISTRAL_EVENTS, MISTRAL_HOSTS } from './mistral.constant';

export const proxyHandler: ProxyHandler = {
  ...createCookieCaptureHandler({
    hosts: [MISTRAL_HOSTS.AUTH, MISTRAL_HOSTS.CONSOLE],
    event: MISTRAL_EVENTS.COOKIES,
  }),
};