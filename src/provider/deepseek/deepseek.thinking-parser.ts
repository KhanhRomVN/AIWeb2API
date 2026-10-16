/**
 * ------------------------------------------------------------------
 * DeepSeek Thinking Parser
 * ------------------------------------------------------------------
 * Kế thừa ThinkingTagParser — chỉ thêm mapping metadata riêng.
 * ------------------------------------------------------------------
 */

import { ThinkingTagParser, ThinkingEndMeta } from '../_shared/thinking';

export interface DeepSeekThinkingMetadata {
  elapsed_secs?: number;
}

export class DeepSeekThinkingParser extends ThinkingTagParser {
  constructor() {
    super({ trackElapsed: false });
  }

  end(meta?: DeepSeekThinkingMetadata | ThinkingEndMeta): string {
    return super.end(meta as ThinkingEndMeta);
  }
}

export function createDeepSeekThinkingParser(): DeepSeekThinkingParser {
  return new DeepSeekThinkingParser();
}