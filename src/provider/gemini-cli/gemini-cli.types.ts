// Gemini CLI-specific types

export interface GeminiCLITokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  projectId?: string;
}

export interface GeminiCLIConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface GeminiCLIMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GeminiCLIRequestBody {
  model: string;
  project: string;
  user_prompt_id: string;
  request: {
    contents: GeminiCLIMessage[];
  };
}

export interface GeminiCLIStreamChunk {
  response?: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export interface GeminiCLIModel {
  modelId: string;
}
