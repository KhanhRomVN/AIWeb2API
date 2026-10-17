/**
 * ------------------------------------------------------------------
 * OpenCode Proxy Handler
 * ------------------------------------------------------------------
 * OpenCode không có luồng login qua browser: credential là JSON
 * `{ serverUrl, password? }` do người dùng nhập trực tiếp.
 * Handler này chỉ cho request đi tiếp, không capture gì.
 * ------------------------------------------------------------------
 */

import type { ProxyHandler } from '../../services/proxy.service';

export const proxyHandler: ProxyHandler = {
  onRequest: (_ctx: any, callback: () => void) => {
    callback();
  },
};