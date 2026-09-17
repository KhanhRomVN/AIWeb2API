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
  ref_file_ids?: Array<string | { 
    file_id: string; 
    url: string;
    type?: string;
    name?: string;
    file_type?: string;
    showType?: string;
    file_class?: string;
  }>;
  thinking?: boolean;
  stream?: boolean;
  temperature?: number;
  // Edit message support
  edit_message_id?: string; // ID của message cần edit (fid trong Qwen)
  user_action?: 'chat' | 'edit'; // Action type: chat (mới) hoặc edit (sửa)
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
  uploadFile?(credential: string, file: any): Promise<any>;
  getModels?(credential: string, accountId?: string): Promise<any[]>;
  login?(options?: any): Promise<any>;
  getUserProfile?(credential: string): Promise<{ email: string | null }>;
  refreshToken?(refreshToken: string): Promise<any>;
  getUsage?(
    credential: string,
  ): Promise<{ usage: number; resetUsageAt: string | null }>;
  proxyHandler?: any;
}
