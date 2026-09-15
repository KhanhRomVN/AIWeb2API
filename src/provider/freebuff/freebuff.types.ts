/**
 * ------------------------------------------------------------------
 * Freebuff Types
 * ------------------------------------------------------------------
 * Định nghĩa các kiểu dữ liệu dùng cho Freebuff Provider.
 * ------------------------------------------------------------------
 */

export interface FreebuffUserProfile {
  user?: {
    name?: string;
    email?: string;
    image?: string;
  };
  expires?: string;
}

export interface FreebuffSSEMetaEvent {
  type: 'meta';
  threadId?: string;
  model?: string;
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

export interface FreebuffSSEEvent {
  type: 'meta' | 'reasoning_delta' | 'delta' | 'suggestions' | 'done' | 'title';
  threadId?: string;
  model?: string;
  delta?: string;
  text?: string;
  suggestions?: string[];
  followups?: string[];
}

export interface FreebuffRequestBody {
  content: string;
  message: string;
  model: string;
  threadId?: string;
}
