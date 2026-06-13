// Kiro CLI-specific types

export interface KiroCLITokens {
  accessToken: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
}

export interface KiroCLIConfig {
  tokenUrl: string;
  qUrl: string;
}

export interface KiroCLIConversationState {
  conversationId: string;
  history: KiroCLIHistoryItem[];
  currentMessage: {
    userInputMessage: KiroCLIUserMessage;
  };
  chatTriggerType: string;
  agentContinuationId: string;
  agentTaskType: string;
}

export interface KiroCLIHistoryItem {
  assistantResponseMessage?: { content: string };
  userInputMessage?: KiroCLIUserMessage;
}

export interface KiroCLIUserMessage {
  content: string;
  userInputMessageContext?: {
    envState?: {
      operatingSystem: string;
      currentWorkingDirectory: string;
    };
    tools?: any[];
  };
  origin?: string;
  modelId?: string;
}

export interface KiroCLIModel {
  modelId: string;
  modelName?: string;
  description?: string;
}

export interface KiroCLIUsage {
  usage: string;
  resetPeriod: 'day' | 'month' | string;
}
