// Claude-specific types

export interface ClaudeOrganization {
  uuid: string;
  name: string;
  created_by_user?: {
    email: string;
  };
}

export interface ClaudeMessage {
  uuid: string;
  text?: string;
  content?: Array<{ type: string; text?: string }>;
  role: 'human' | 'assistant';
}

export interface ClaudeConversation {
  uuid: string;
  name: string;
  chat_messages?: ClaudeMessage[];
  rootMessageId?: string;
}

export interface ClaudeMessagePayload {
  prompt: string;
  timezone: string;
  model: string;
  attachments: any[];
  files: string[];
  rendering_mode: string;
  parent_message_uuid: string;
  locale: string;
  tools: ClaudeTool[];
  personalized_styles: ClaudePersonalizedStyle[];
}

export interface ClaudeTool {
  type: string;
  name: string;
}

export interface ClaudePersonalizedStyle {
  type: string;
  key: string;
  name: string;
  nameKey: string;
  prompt: string;
  summary: string;
  summaryKey: string;
  isDefault: boolean;
}

export interface ClaudeStreamEvent {
  type?: string;
  completion?: string;
  delta?: { text?: string };
  stop_reason?: string;
}
