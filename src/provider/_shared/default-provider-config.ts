/**
 * ------------------------------------------------------------------
 * Default Provider Configuration
 * ------------------------------------------------------------------
 * Cung cấp các giá trị mặc định cho `static config` của provider.
 * Mục đích: Giảm boilerplate khi khai báo config trong từng provider class.
 * 
 * Usage:
 * ```ts
 * import { DEFAULT_PROVIDER_CONFIG } from '../_shared/default-provider-config';
 * 
 * static config = {
 *   ...DEFAULT_PROVIDER_CONFIG,
 *   provider_id: PROVIDER_ID,
 *   provider_name: PROVIDER_NAME,
 *   // ... other specific fields
 * };
 * ```
 * ------------------------------------------------------------------
 */

export interface BaseProviderConfig {
  is_enabled: boolean;
  auth_method: string;
  connection_type: string;
  is_pausable: boolean;
  can_regenerate: boolean;
  token_count_mode: 'incremental' | 'cumulative';
  blocked_time_ranges: Array<{ startTime: number; endTime: number }>;
  supports_session_cleanup: boolean;
}

/**
 * Giá trị mặc định phổ biến nhất cho hầu hết providers.
 * Các provider cụ thể nên override những field cần thiết.
 */
export const DEFAULT_PROVIDER_CONFIG: BaseProviderConfig = {
  is_enabled: true,
  auth_method: 'cookie', // Hầu hết dùng cookie/session; OAuth provider sẽ override
  connection_type: 'http',
  is_pausable: false,
  can_regenerate: true,
  token_count_mode: 'incremental',
  blocked_time_ranges: [],
  supports_session_cleanup: false,
};