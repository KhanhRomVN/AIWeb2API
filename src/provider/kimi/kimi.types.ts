/**
 * ------------------------------------------------------------------
 * Kimi Types
 * ------------------------------------------------------------------
 * Type definitions cho Kimi AI API.
 *
 * Main exports:
 * - KIMI_BASE_URL      : Base URL
 * - KimiCredential     : Credential structure
 * - KimiChatRequest    : Chat request payload
 * - KIMI_MODELS        : Model constants
 * ------------------------------------------------------------------
 */

// ─── Constants (re-export) ─────────────────────────────────────────────

export { KIMI_BASE_URL, KIMI_MODELS } from './kimi.constant';

// ─── Types ──────────────────────────────────────────���───────────────────

export interface KimiCredential {
  accessToken: string;
  refreshToken?: string;
  cookies?: string;
  deviceId?: string;
  sessionId?: string;
  trafficId?: string;
  userAgent?: string;
}

export interface KimiChatRequest {
  chat_id?: string;
  scenario?: 'SCENARIO_K2D5' | 'SCENARIO_OK_COMPUTER' | string;
  tools?: Array<{ type: string; search?: Record<string, any> }>;
  options?: {
    thinking?: boolean;
    enablePlugin?: boolean;
    reasoningEffort?: string;
    model?: string;
  };
  message?: {
    role: string;
    blocks: Array<{
      text?: { content: string };
      [key: string]: any;
    }>;
  };
}