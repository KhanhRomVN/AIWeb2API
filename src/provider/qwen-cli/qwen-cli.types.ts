// Qwen CLI-specific types

export interface QwenCLITokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface QwenCLIConfig {
  clientId: string;
  deviceCodeUrl: string;
  tokenUrl: string;
  scope: string;
  codeChallengeMethod: string;
}

export interface QwenCLIStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
  }>;
}
