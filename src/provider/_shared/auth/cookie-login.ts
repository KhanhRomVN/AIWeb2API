/**
 * ------------------------------------------------------------------
 * Cookie Login Helper
 * ------------------------------------------------------------------
 * Tiện ích hỗ trợ luồng đăng nhập qua CDP (Chrome DevTools Protocol).
 * 
 * Mục đích: Chuẩn hóa cấu hình `captureCredentialsViaCDP` và cung cấp
 * type definitions chung cho dữ liệu bắt được từ proxy/browser.
 * 
 * Lưu ý: Logic `validate` vẫn thuộc về từng provider vì phụ thuộc vào
 * format credential cụ thể (JWT, Session ID, Multi-part...) và yêu cầu
 * gọi API xác thực riêng (profile, bootstrap...).
 * ------------------------------------------------------------------
 */

import { loginService } from '../../../services/login.service';

/**
 * Dữ liệu thô thu thập được từ trình duyệt/proxy trong quá trình login.
 */
export interface CapturedLoginData {
  /** Chuỗi cookie HTTP header value */
  cookies: string;
  /** Email người dùng (nếu proxy bắt được từ response body) */
  email?: string;
  /** Headers bổ sung (nếu có extraEvents) */
  headers?: Record<string, string>;
  /** Các field động khác do provider emit qua event bus */
  [key: string]: unknown;
}

/**
 * Kết quả trả về từ hàm validate.
 */
export interface ValidateResult {
  isValid: boolean;
  /** Credential đã được serialize sẵn sàng lưu trữ */
  cookies?: string;
  /** Email đã xác minh */
  email?: string | null;
  /** Bất kỳ metadata bổ sung nào cần lưu cùng credential */
  [key: string]: unknown;
}

/**
 * Cấu hình cho luồng capture cookie login.
 */
export interface CookieLoginConfig {
  providerId: string;
  loginUrl: string;
  /** Prefix cho partition storage. Mặc định: 'login-' */
  partitionPrefix?: string;
  /** Event name cho cookie capture */
  cookieEvent: string;
  /** Event name cho user info/email capture */
  infoEvent?: string;
  /** Các event bổ sung cần lắng nghe (headers, tokens...) */
  extraEvents?: string[];
  /** Hàm kiểm tra tính hợp lệ và transform dữ liệu */
  validate: (data: CapturedLoginData) => Promise<ValidateResult>;
}

/**
 * Sinh tên partition duy nhất cho phiên login.
 * Dùng timestamp để tránh xung đột giữa các lần login liên tiếp.
 */
export function generateLoginPartition(prefix: string = 'login'): string {
  return `${prefix}-${Date.now()}`;
}

/**
 * Kết quả cuối cùng sau khi login thành công — khớp contract của
 * loginService.captureCredentialsViaCDP.
 */
export interface CaptureLoginResult {
  cookies: string;
  email?: string;
  headers?: Record<string, string>;
}

/**
 * Wrapper tiện ích cho loginService.captureCredentialsViaCDP.
 * Tự động sinh partition nếu chưa cung cấp, và enforce typing cho data.
 */
export async function captureCookieLogin(
  config: CookieLoginConfig,
): Promise<CaptureLoginResult> {
  const partition = config.partitionPrefix
    ? generateLoginPartition(config.partitionPrefix)
    : undefined;

  return await loginService.captureCredentialsViaCDP({
    providerId: config.providerId,
    loginUrl: config.loginUrl,
    partition,
    cookieEvent: config.cookieEvent,
    infoEvent: config.infoEvent,
    extraEvents: config.extraEvents,
    validate: config.validate,
  });
}