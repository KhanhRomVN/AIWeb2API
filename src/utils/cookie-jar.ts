/**
 * ------------------------------------------------------------------
 * Cookie Jar
 * ------------------------------------------------------------------
 * Wrapper cho tough-cookie để quản lý cookies trong các request.
 *
 * Main functions:
 * - setCookie()      : Thêm cookie từ Set-Cookie header
 * - getCookieString(): Lấy cookies dạng string cho Cookie header
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Cookie, CookieJar as ToughCookieJar } from 'tough-cookie';

// ─── Class ──────────────────────────────────────────────────────────────

export class CookieJar {
  private jar: ToughCookieJar;

  constructor() {
    this.jar = new ToughCookieJar();
  }

  setCookie(cookieStr: string, url: string): void {
    try {
      this.jar.setCookieSync(cookieStr, url);
    } catch (error) {
      // Ignore invalid cookies
    }
  }

  getCookieString(url: string): string {
    try {
      return this.jar.getCookieStringSync(url);
    } catch (error) {
      return '';
    }
  }
}
