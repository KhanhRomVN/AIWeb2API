import type { Logger } from '../../../utils/logger';

/**
 * Cấu hình cho hàm parseCredential linh hoạt.
 */
export interface CredentialParseOptions<T extends Record<string, any>> {
  /**
   * Danh sách các khóa trong JSON cần kiểm tra để lấy Access Token / Main Credential.
   * Ưu tiên theo thứ tự mảng.
   */
  accessKeys: readonly string[];
  
  /**
   * Danh sách các khóa trong JSON cần kiểm tra để lấy Refresh Token.
   */
  refreshKeys?: readonly string[];
  
  /**
   * Prefix đặc trưng nếu credential là JWT thô (ví dụ: 'ey'). 
   * Nếu cung cấp, sẽ bỏ qua bước parse JSON nếu bắt đầu bằng prefix này.
   */
  jwtPrefix?: string;
  
  /**
   * Các Regex để trích xuất Access Token từ chuỗi cookie/raw string fallback.
   * Mỗi regex phải có nhóm capture thứ nhất ([1]) chứa token.
   */
  cookieAccessRegexes?: RegExp[];
  
  /**
   * Các Regex để trích xuất Refresh Token từ chuỗi cookie/raw string fallback.
   */
  cookieRefreshRegexes?: RegExp[];
  
  /**
   * Hàm mapper tùy chỉnh để chuyển đổi kết quả parse cơ bản sang dạng T cụ thể của provider.
   * Nhận vào object `{ accessToken, refreshToken, rawParsed? }` và trả về T.
   */
  mapResult?: (base: { 
    accessToken: string; 
    refreshToken: string;
    jsonPayload?: Record<string, unknown>;
  }) => T;

  /**
   * Logger instance để ghi cảnh báo khi parse lỗi.
   */
  logger?: Logger;
  
  /**
   * Nhãn tên provider để log.
   */
  label?: string;
}

export interface ParsedCredentialBase {
  accessToken: string;
  refreshToken: string;
}

/**
 * Hàm generic để parse credential string thành object cấu trúc.
 * Hỗ trợ 3 luồng chính:
 * 1. JSON String -> Extract keys.
 * 2. Raw JWT (starts with prefix) -> Treat as accessToken.
 * 3. Cookie/String Fallback -> Use RegEx to extract tokens.
 */
export function parseTokenCredential<T extends ParsedCredentialBase>(
  credential: string,
  opts: CredentialParseOptions<T>,
): T {
  const {
    accessKeys,
    refreshKeys = [],
    jwtPrefix,
    cookieAccessRegexes = [],
    cookieRefreshRegexes = [],
    mapResult,
    logger,
    label = 'Provider',
  } = opts;

  const defaultMap = (base: { accessToken: string; refreshToken: string; jsonPayload?: Record<string, unknown> }): T => {
    // Cast an toàn vì caller đảm bảo T extend ParsedCredentialBase
    return base as unknown as T;
  };
  const finalMapper = mapResult || defaultMap;

  if (!credential) {
    return finalMapper({ accessToken: '', refreshToken: '' });
  }

  const trimmed = credential.trim();

  // 1. Thử parse JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      
      let accessToken = '';
      for (const key of accessKeys) {
        const val = parsed[key];
        if (typeof val === 'string' && val.length > 0) {
          accessToken = val;
          break;
        }
      }

      let refreshToken = '';
      for (const key of refreshKeys) {
        const val = parsed[key];
        if (typeof val === 'string' && val.length > 0) {
          refreshToken = val;
          break;
        }
      }

      // Nếu tìm thấy accessToken trong JSON, trả về ngay
      if (accessToken) {
        return finalMapper({ accessToken, refreshToken, jsonPayload: parsed });
      }
      
      // Nếu JSON hợp lệ nhưng không có key mong muốn, có thể fallthrough xuống dưới
      // hoặc coi như rỗng tùy policy. Ở đây ta fallthrough để thử regex nếu cần.
    } catch (e) {
      logger?.warn(`[${label}] Credential is not valid JSON, falling back to raw parsing`, e);
    }
  }

  // 2. Kiểm tra JWT Prefix
  if (jwtPrefix && trimmed.startsWith(jwtPrefix)) {
    return finalMapper({ accessToken: trimmed, refreshToken: '' });
  }

  // 3. Fallback: Trích xuất từ Cookie String hoặc Raw String bằng Regex
  
  let accessToken = '';
  for (const regex of cookieAccessRegexes) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      accessToken = match[1];
      break;
    }
  }

  let refreshToken = '';
  if (refreshKeys.length > 0 || cookieRefreshRegexes.length > 0) {
    for (const regex of cookieRefreshRegexes) {
      const match = trimmed.match(regex);
      if (match && match[1]) {
        refreshToken = match[1];
        break;
      }
    }
  }

  // Nếu vẫn chưa có accessToken sau khi chạy hết regex, coi cả chuỗi là token (fallback cuối cùng)
  if (!accessToken) {
    accessToken = trimmed;
  }

  return finalMapper({ accessToken, refreshToken });
}