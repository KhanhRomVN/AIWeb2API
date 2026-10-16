/**
 * ------------------------------------------------------------------
 * Kiro Thinking Parser
 * ------------------------------------------------------------------
 * Kế thừa ThinkingTagParser với trackElapsed=false (Kiro không đo giờ).
 * ------------------------------------------------------------------
 */

import { ThinkingTagParser } from '../_shared/thinking';

export interface KiroThinkingChunk {
  type: 'thinking';
  content: string;
}

export class KiroThinkingParser extends ThinkingTagParser {
  constructor() {
    super({ trackElapsed: false });
  }
}

export function createKiroThinkingParser(): KiroThinkingParser {
  return new KiroThinkingParser();
}