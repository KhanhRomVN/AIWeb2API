import { Router } from 'express';
import { Message } from './message.types';

export interface SendMessageOptions {
  credential: string;
  provider_id: string;
  accountId?: string;
  model: string;
  messages: Message[];
  conversationId?: string;
  parent_message_id?: string;
  search?: boolean;
  ref_file_ids?: Array<
    | string
    | {
        file_id: string;
        url: string;
        type?: string;
        name?: string;
        file_type?: string;
        showType?: string;
        file_class?: string;
      }
  >;
  thinking?: boolean;
  stream?: boolean;
  // Edit message support
  edit_message_id?: string; // ID của message cần edit (fid trong Qwen)
  user_action?: 'chat' | 'edit'; // Action type: chat (mới), edit (sửa nội dung hoặc regenerate)
  message_fid?: string; // Pre-generated fid for normal chat (Qwen) to ensure UI/server UUID match
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onDone: () => void;
  onError: (err: any) => void;
  onRaw?: (data: string) => void;
  onSessionCreated?: (sessionId: string) => void;
  /**
   * Được gọi khi provider rotate credential (ví dụ DeepSeek check_device trả token mới).
   * Caller (service layer) chịu trách nhiệm persist credential mới vào DB.
   */
  onCredentialRotated?: (newCredential: string) => void | Promise<void>;
}

export interface Provider {
  name: string;
  handleMessage(options: SendMessageOptions): Promise<void>;
  uploadFile?(
    credential: string,
    file: any,
    conversationId?: string,
  ): Promise<any>;
  getModels?(credential: string, accountId?: string): Promise<any[]>;
  login?(options?: any): Promise<any>;
  getUserProfile?(credential: string): Promise<{ email: string | null }>;
  refreshToken?(refreshToken: string): Promise<any>;
  getUsage?(
    credential: string,
  ): Promise<{ usage: number; resetUsageAt: string | null }>;
  /**
   * Xóa toàn bộ conversation/session của account — dùng khi bị time-block.
   * Nếu provider không hỗ trợ → không implement.
   */
  deleteAllSessions?(credential: string): Promise<boolean>;
  /**
   * Provider có hỗ trợ xóa toàn bộ conversation (session cleanup) không.
   * Nếu true và deleteAllSessions() được implement, AIWeb2API sẽ expose field
   * `supports_session_cleanup: true` cho Zen webview biết để kích hoạt cơ chế
   * health-check và auto-cleanup khi account không còn ở chat view.
   */
  supportsSessionCleanup?: boolean;
  proxyHandler?: any;
  /**
   * Cấu hình giới hạn & chặn giờ dùng cho provider.
   * Nếu không set → không áp dụng giới hạn nào.
   */
  usagePolicy?: {
    requestLimit?: number;
    /**
     * Chu kỳ reset cho `requestLimit`.
     * 'day'   = 00:00 UTC mỗi ngày.
     * 'week'  = thứ Hai 00:00 UTC.
     * 'month' = ngày 1 hàng tháng 00:00 UTC.
     * Mặc định: 'day'.
     */
    requestLimitPeriod?: 'day' | 'week' | 'month';
    /**
     * Danh sách khung giờ bị chặn (UTC).
     * Mỗi phần tử: [startTime, endTime) exclusive, tính theo giờ UTC (0–23).
     * Label được tạo động theo timezone của client — không hardcode.
     */
    blockedTimeRanges?: Array<{
      startTime: number;
      endTime: number;
    }>;
  };
}
