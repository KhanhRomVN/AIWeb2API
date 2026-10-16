/**
 * Tiện ích xử lý chuỗi Cookie HTTP.
 */

/**
 * Phân tích chuỗi cookie (`key1=val1; key2=val2`) thành object Record.
 * Bỏ qua các phần tử rỗng hoặc không có dấu `=`.
 */
export function parseCookieString(cookie: string): Record<string, string> {
  if (!cookie) return {};
  
  const result: Record<string, string> = {};
  const pairs = cookie.split(';');
  
  for (const pair of pairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) continue;
    
    const eqIndex = trimmedPair.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = trimmedPair.substring(0, eqIndex).trim();
    const value = trimmedPair.substring(eqIndex + 1).trim();
    
    if (key) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Lấy giá trị của một cookie cụ thể từ chuỗi cookie.
 * Trả về null nếu không tìm thấy.
 */
export function getCookieValue(cookie: string, name: string): string | null {
  const parsed = parseCookieString(cookie);
  return parsed[name] ?? null;
}