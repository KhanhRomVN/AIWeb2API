// Groq-specific types

export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GroqChatPayload {
  model: string;
  messages: GroqMessage[];
  stream: boolean;
  temperature?: number;
}

export interface GroqStreamDelta {
  content?: string;
  role?: string;
}

export interface GroqStreamChoice {
  delta?: GroqStreamDelta;
  finish_reason?: string | null;
}

export interface GroqStreamChunk {
  choices?: GroqStreamChoice[];
}

export interface GroqModel {
  id: string;
  active?: boolean;
  context_window?: number;
  metadata?: {
    display_name?: string;
    model_card?: string;
  };
  features?: {
    reasoning?: boolean;
  };
}
