/**
 * ------------------------------------------------------------------
 * Gemini Constants
 * ------------------------------------------------------------------
 * Constants cho Gemini Web API.
 *
 * Main exports:
 * - PROVIDER_ID         : ID định danh provider
 * - PROVIDER_NAME       : Tên hiển thị
 * - IS_ENABLED          : Bật/tắt provider
 * - WEBSITE_URL         : URL website
 * - AUTH_METHOD         : Phương thức xác thực
 * - CONNECTION_TYPE     : Loại kết nối (https/browser)
 * - MODELS              : Danh sách models hỗ trợ
 * - IS_PAUSABLE         : Hỗ trợ tạm dừng session
 * - IS_MEMORY           : Hỗ trợ bộ nhớ dài hạn
 * - BASE_URL            : Base URL cho Gemini
 * - GEMINI_BL           : Build label (bl parameter)
 * - MODEL_MAP           : Mapping từ model name sang mode và think level
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'gemini';
export const PROVIDER_NAME = 'Gemini';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://gemini.google.com/';
export const AUTH_METHOD = ['google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.5 Flash - Fast and efficient model for everyday tasks, optimized for quick responses',
  },
  {
    id: 'gemini-3.5-flash-thinking',
    name: 'Gemini 3.5 Flash Thinking',
    is_thinking: true,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.5 Flash Thinking - Enhanced reasoning with step-by-step thinking process for complex problems',
  },
  {
    id: 'gemini-3.5-flash-thinking-lite',
    name: 'Gemini 3.5 Flash Thinking Lite',
    is_thinking: true,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.5 Flash Thinking Lite - Lightweight version with thinking mode, balances speed and depth',
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini 3.1 Pro - Professional-grade model with advanced capabilities for complex tasks',
  },
  {
    id: 'gemini-auto',
    name: 'Gemini Auto',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini Auto - Automatically selects optimal model based on task complexity and requirements',
  },
  {
    id: 'gemini-flash-lite',
    name: 'Gemini Flash Lite',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Google Gemini Flash Lite - Ultra-lightweight model for resource-constrained environments and high throughput',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const BASE_URL = 'https://gemini.google.com';

// Gemini Web build label — may need periodic update
export const GEMINI_BL = 'boq_assistant-bard-web-server_20260525.09_p0';

// Model mapping: MODE_CATEGORY enum from Gemini frontend JS source
// 1=FAST, 2=THINKING, 3=PRO, 4=AUTO, 5=FAST_DYNAMIC_THINKING, 6=FLASH_LITE
export const MODEL_MAP: Record<
  string,
  { mode: number; think: number; desc: string }
> = {
  'gemini-3.5-flash': {
    mode: 1,
    think: 4,
    desc: 'Fast general-purpose model',
  },
  'gemini-3.5-flash-thinking': {
    mode: 2,
    think: 0,
    desc: 'Deep thinking mode, longest output (~20k chars)',
  },
  'gemini-3.1-pro': {
    mode: 3,
    think: 4,
    desc: 'Pro model (requires cookie for real routing)',
  },
  'gemini-auto': { mode: 4, think: 4, desc: 'Auto model selection' },
  'gemini-3.5-flash-thinking-lite': {
    mode: 5,
    think: 0,
    desc: 'Dynamic thinking with adaptive depth',
  },
  'gemini-flash-lite': { mode: 6, think: 4, desc: 'Lightweight fast model' },
};

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const GEMINI_EVENTS = {
  COOKIES: 'gemini-cookies',
  USER_INFO: 'gemini-user-info',
} as const;
