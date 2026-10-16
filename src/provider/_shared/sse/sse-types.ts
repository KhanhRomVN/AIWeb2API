export interface SseCallbacks {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: Record<string, unknown>) => void;
  onRaw?: (data: string) => void;
}