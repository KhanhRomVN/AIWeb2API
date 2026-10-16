/**
 * ------------------------------------------------------------------
 * JSON Response Sniffer Factory
 * ------------------------------------------------------------------
 * Gom khung `onResponseBody`: host + URL match → JSON.parse → callback.
 *
 * Mẫu lặp ở: freebuff (/api/auth/session → json.user.email),
 * kimi (token response), deepseek (login response), qwen (signin response).
 * ------------------------------------------------------------------
 */

import { ProxyHandler } from '../../../services/proxy.service';
import { createLogger } from '../../../utils/logger';

export interface JsonResponseSnifferOptions<T = any> {
  /** Danh sách hostname substring để match */
  hosts: string[];
  /** URL substring phải chứa (vd '/api/auth/session') */
  urlIncludes: string;
  /** Callback xử lý JSON đã parse thành công */
  onJson: (json: T, ctx: any) => void;
  /** Fallback regex khi body không phải JSON hợp lệ (kiểu huggingchat/gemini) */
  fallbackRegex?: RegExp;
  /** Fallback handler khi regex match */
  onFallback?: (match: RegExpExecArray, ctx: any) => void;
  /** Label cho logger warning khi parse fail */
  label?: string;
}

/**
 * Tạo `onResponseBody` handler parse JSON và dispatch.
 * Trả về partial ProxyHandler — provider spread vào object của mình.
 */
export function createJsonResponseSniffer<T = any>(
  opts: JsonResponseSnifferOptions<T>,
): Pick<ProxyHandler, 'onResponseBody'> {
  const { hosts, urlIncludes, onJson, fallbackRegex, onFallback, label } = opts;
  const logger = createLogger(label ?? 'JsonSniffer');

  return {
    onResponseBody: (ctx: any, body: string) => {
      const host: string | undefined = ctx.clientToProxyRequest.headers.host;
      const url: string = ctx.clientToProxyRequest.url || '';

      if (!host || !hosts.some((h) => host.includes(h))) return;
      if (!url.includes(urlIncludes)) return;

      try {
        const json = JSON.parse(body) as T;
        onJson(json, ctx);
      } catch {
        if (fallbackRegex && onFallback) {
          const match = fallbackRegex.exec(body);
          if (match) {
            onFallback(match, ctx);
          }
        } else {
          logger.warn(`[Proxy] Failed to parse JSON response for ${urlIncludes}`);
        }
      }
    },
  };
}