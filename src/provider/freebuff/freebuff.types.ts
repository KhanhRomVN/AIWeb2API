/**
 * ------------------------------------------------------------------
 * Freebuff Types
 * ------------------------------------------------------------------
 * Định nghĩa các kiểu dữ liệu dùng cho Freebuff Provider.
 * ------------------------------------------------------------------
 */

// ─── Credential ──────────────────────────────────────────────────────────

/**
 * Credential Freebuff đã parse từ JSON string.
 * Format lưu trong DB: JSON.stringify({ cookies })
 */
export interface FreebuffCredential {
  /** Raw cookie string (next-auth session cookies) */
  cookies: string;
}

// ─── Auth / Session ──────────────────────────────────────────────────────

export interface FreebuffUserProfile {
  user?: {
    name?: string;
    email?: string;
    image?: string;
  };
  expires?: string;
}

// ─── Request Payload ─────────────────────────────────────────────────────

export interface FreebuffRequestBody {
  /** Thread ID nếu tiếp tục conversation, null nếu tạo mới */
  threadId: string | null;
  /** Nội dung tin nhắn */
  content: string;
  /** Model ID (dạng đầy đủ, vd: "z-ai/glm-5.3-flash") */
  model: string;
  /** Mức độ reasoning, null nếu model không hỗ trợ */
  reasoningEffort: string | null;
  /** Danh sách ảnh đã upload (optional) */
  images?: Array<{
    storageId: string;
    mediaType: string;
    name: string;
    descriptionStorageId?: string;
  }>;
}

// ─── SSE Event Types ─────────────────────────────────────────────────────

export interface FreebuffSSEMetaEvent {
  type: 'meta';
  threadId?: string;
  title?: string;
  model?: string;
  accessTier?: string;
}

export interface FreebuffSSEReasoningEvent {
  type: 'reasoning_delta';
  delta?: string;
  text?: string;
}

export interface FreebuffSSEDeltaEvent {
  type: 'delta';
  delta?: string;
  text?: string;
}

export interface FreebuffSSESuggestionsEvent {
  type: 'suggestions';
  suggestions?: string[];
  followups?: string[];
}

export interface FreebuffSSETitleEvent {
  type: 'title';
  threadId?: string;
  title?: string;
}

export interface FreebuffSSEDoneEvent {
  type: 'done';
}

/** Union type cho tất cả SSE events từ Freebuff */
export type FreebuffSSEEvent =
  | FreebuffSSEMetaEvent
  | FreebuffSSEReasoningEvent
  | FreebuffSSEDeltaEvent
  | FreebuffSSESuggestionsEvent
  | FreebuffSSETitleEvent
  | FreebuffSSEDoneEvent;

// ─── Threads API Response ─────────────────────────────────────────────────

export interface FreebuffThread {
  id: string;
  title?: string;
  model?: string;
  updated_at?: string;
  created_at?: string;
}

export interface FreebuffThreadsResponse {
  threads?: FreebuffThread[];
  /** "limited" = ngoài vùng full access hoặc dùng VPN, "full" = full access */
  accessTier?: string;
}

// ─── Usage ───────────────────────────────────────────────────────────────

export interface FreebuffUsageInfo {
  remaining?: number;
  accessTier?: string;
}

// ─── Freebucks Session ────────────────────────────────────────────────────

export interface FreebucksSessionResponse {
  freebucks?: {
    daily?: {
      limit?: number;
      spent?: number;
      remaining?: number;
      /** ISO 8601 UTC — thời điểm reset daily freebucks */
      resetAt?: string;
      resetTimeZone?: string;
    };
  };
}

// ─── Upload ──────────────────────────────────────────────────────────────

export interface FreebuffUploadResponse {
  kind: 'image';
  /** Storage ID dùng trong `images` array của /api/chat/stream request */
  storageId: string;
  /** Public URL của ảnh */
  url?: string;
  /** MIME type, vd: "image/png" */
  mediaType: string;
  /** Tên file */
  name: string;
  /** Storage ID của AI-generated description */
  descriptionStorageId?: string;
}

/** Object đặt vào `images` array trong /api/chat/stream request body */
export interface FreebuffImageAttachment {
  storageId: string;
  mediaType: string;
  name: string;
  descriptionStorageId?: string;
}

// ─── Subscriptions / Usage ────────────────────────────────────────────────

export interface FreebuffSubscriptionTier {
  id: string;
  displayName: string;
  priceUsd: number;
  dailySessions?: number;
  fiveDaySessions?: number;
  monthlySessions?: number;
  dailyPremiumSessions?: number;
  /** Luôn false trong response API — không dùng để xác định active tier */
  current?: boolean;
}

export interface FreebuffSubscriptionResponse {
  subscription?: {
    /** null nếu free plan */
    tierId: string | null;
    tiers?: FreebuffSubscriptionTier[];
  };
}
