/**
 * ------------------------------------------------------------------
 * Chrome TLS Fingerprint Constants
 * ------------------------------------------------------------------
 * JA3 + HTTP/2 fingerprint giống hệt ở 4 provider:
 * claude, gemini, huggingchat, kimi.
 *
 * Nếu update Chrome version → cập nhật tại đây, tất cả provider
 * import sẽ tự nhận bản mới.
 * ------------------------------------------------------------------
 */

/**
 * JA3 fingerprint khớp với Chrome (cipher suite + extension list điển hình).
 * Dùng cho mọi request đi qua ImpersonateHttpClient để qua Cloudflare/WAF.
 */
export const CHROME_JA3 =
  '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0';

/**
 * HTTP/2 fingerprint (SETTINGS frame + window update + pseudo-header order).
 * Format: `<settings>|<windowUpdate>|<priority>|<pseudoHeaderOrder>`.
 */
export const CHROME_HTTP2_FINGERPRINT =
  '1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p';

/**
 * Factory tạo impersonate profile đồng nhất.
 * Provider truyền `userAgent` riêng vì mỗi target site yêu cầu UA khác nhau.
 */
export function createChromeProfile(userAgent: string) {
  return {
    ja3: CHROME_JA3,
    http2Fingerprint: CHROME_HTTP2_FINGERPRINT,
    userAgent,
  } as const;
}