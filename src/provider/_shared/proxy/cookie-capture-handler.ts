/**
 * ------------------------------------------------------------------
 * Cookie Capture Handler Factory
 * ------------------------------------------------------------------
 * Gom khung `onRequest` bắt cookie/header từ proxy request.
 *
 * Mẫu lặp ở: mistral, freebuff, qwen (phần cookie), zai-browser, kiro.
 * Provider chỉ cần khai báo hosts + cookie marker + event name.
 * ------------------------------------------------------------------
 */

import { ProxyHandler, proxyEvents } from '../../../services/proxy.service';

export interface CookieCaptureOptions {
  /** Danh sách hostname substring để match (vd ['auth.mistral.ai', 'console.mistral.ai']) */
  hosts: string[];
  /**
   * Marker xuất hiện trong cookie header để xác nhận đã login.
   * Bỏ trống → chấp nhận mọi cookie không rỗng (kiểu mistral).
   */
  cookieMarker?: string;
  /** Event name emit khi capture được cookies */
  event: string;
  /**
   * Transform payload trước khi emit. Mặc định: emit raw cookie string.
   * Freebuff dùng `(cookies) => ({ cookies })`.
   */
  mapPayload?: (cookies: string) => unknown;
  /**
   * Header names bổ sung cần capture (lowercase key).
   * Nếu có, sẽ emit một event riêng với object headers thay vì cookie string.
   */
  extraHeaders?: string[];
  /** Event name cho extraHeaders payload (nếu extraHeaders được set) */
  headersEvent?: string;
}

/**
 * Tạo `onRequest` handler bắt cookie (và optionally extra headers).
 * Trả về partial ProxyHandler — provider spread vào object của mình.
 */
export function createCookieCaptureHandler(
  opts: CookieCaptureOptions,
): Pick<ProxyHandler, 'onRequest'> {
  const { hosts, cookieMarker, event, mapPayload, extraHeaders, headersEvent } = opts;

  return {
    onRequest: (ctx: any, callback: () => void) => {
      const host: string | undefined = ctx.clientToProxyRequest.headers.host;

      if (host && hosts.some((h) => host.includes(h))) {
        const reqCookies: string | undefined = ctx.clientToProxyRequest.headers.cookie;

        // Cookie capture
        if (reqCookies) {
          const matches = cookieMarker ? reqCookies.includes(cookieMarker) : true;
          if (matches) {
            const payload = mapPayload ? mapPayload(reqCookies) : reqCookies;
            proxyEvents.emit(event, payload);
          }
        }

        // Extra headers capture (kiểu qwen: bx-ua, x-csrf-token, ...)
        if (extraHeaders && extraHeaders.length > 0 && headersEvent) {
          const captured: Record<string, string> = {};
          for (const headerName of extraHeaders) {
            const value = ctx.clientToProxyRequest.headers[headerName];
            if (value) captured[headerName] = String(value);
          }
          // Also capture user-agent and cookie if present
          const ua = ctx.clientToProxyRequest.headers['user-agent'];
          if (ua) captured['User-Agent'] = String(ua);
          if (reqCookies) captured['Cookie'] = reqCookies;

          if (Object.keys(captured).length > 0) {
            proxyEvents.emit(headersEvent, captured);
          }
        }
      }

      callback();
    },
  };
}