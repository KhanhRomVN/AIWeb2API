// HuggingChat-specific types

export interface HuggingChatConversation {
  conversationId?: string;
  rootMessageId?: string;
  messages?: HuggingChatMessage[];
}

export interface HuggingChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
}

export interface HuggingChatStreamToken {
  type: 'stream' | 'title' | 'finalAnswer' | 'status';
  token?: string;
  title?: string;
}

export interface HuggingChatModel {
  id: string;
  displayName?: string;
  name?: string;
  providers?: Array<{ context_length?: number }>;
}
