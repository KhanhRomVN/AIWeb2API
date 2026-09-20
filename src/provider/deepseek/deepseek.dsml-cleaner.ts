/**
 * ------------------------------------------------------------------
 * DeepSeek DSML Artifact Cleaner
 * ------------------------------------------------------------------
 * DeepSeek models đôi khi emit các token DSML (DeepSeek Markup Language)
 * thừa vào trong response. Chúng KHÔNG phải là tool call hợp lệ mà là
 * artifact nội bộ của model, ví dụ:
 *
 *   </｜｜DSML｜｜>
 *   </｜｜DSML｜｜ parameter>
 *   <｜｜DSML｜｜ parameter name="read_file">
 *   </｜｜DSML｜｜ parameter name="read_file">
 *
 * File này xử lý việc strip các token này ra khỏi content chunk
 * TRƯỚC KHI emit về client, giữ cho response sạch.
 * ------------------------------------------------------------------
 */

/**
 * Ký tự separator trong DSML token là full-width vertical bar (U+FF5C) `｜`,
 * không phải ASCII pipe (U+007C) `|`. Cả hai đều được cover bởi character
 * class `[|｜]` bên dưới.
 *
 * Các pattern được sắp xếp từ specific → general để tránh partial match:
 * 1. Closing tag với attributes:  </｜｜DSML｜｜ parameter name="...">
 * 2. Opening tag với attributes:  <｜｜DSML｜｜ parameter name="...">
 * 3. Plain closing/opening tag:   </｜｜DSML｜｜>  /  <｜｜DSML｜｜>
 */
const DSML_PATTERNS: RegExp[] = [
  // Closing tags (với hoặc không có attributes)
  /<\/\s*[|｜]{2}\s*DSML\s*[|｜]{2}[^>]*>/g,
  // Opening tags (với hoặc không có attributes)
  /<\s*[|｜]{2}\s*DSML\s*[|｜]{2}[^>]*>/g,
];

/**
 * Xóa tất cả DSML artifact tokens khỏi một string content.
 *
 * Được gọi trên từng content chunk TRƯỚC KHI emit ra ngoài,
 * đảm bảo client không bao giờ nhận được token thừa.
 *
 * @param content - Content chunk từ DeepSeek SSE stream.
 * @returns Content đã được làm sạch.
 */
export function cleanDSMLArtifacts(content: string): string {
  let cleaned = content;
  for (const pattern of DSML_PATTERNS) {
    pattern.lastIndex = 0; // reset vì các regex có flag /g
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
}
