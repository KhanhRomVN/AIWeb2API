# Thinking Normalization

## Tổng quan

AIWeb2API chuẩn hóa thinking output từ các provider khác nhau thành một format chung: `<thinking>...</thinking>`. Điều này cho phép client (Zen) xử lý thinking content một cách nhất quán mà không cần biết provider gốc.

## Format chung

```xml
<thinking>
... thinking content ...
</thinking>
<!-- thinking_elapsed: 2.5s -->
```

## Provider-specific Implementation

### DeepSeek

**Raw format:**
- Fragment type: `"THINK"`
- Thinking content: plain text chunks
- Metadata: `elapsed_secs`

**Parser:** `deepseek.thinking-parser.ts`

**Cách hoạt động:**
1. SSE parser phát hiện fragment với `type: "THINK"`
2. Thinking parser tự động wrap content trong `<thinking>` tags
3. Khi chuyển sang RESPONSE mode, emit closing tag `</thinking>`
4. Metadata `elapsed_secs` được thêm vào comment

**Example:**
```typescript
// Input stream
{ type: "THINK", content: "We need answer user..." }
{ type: "THINK", content: " Need parse..." }
{ type: "RESPONSE", content: "Xin chào!" }

// Output
<thinking>We need answer user... Need parse...</thinking>
<!-- thinking_elapsed: 2.3s -->
Xin chào!
```

### Qwen

**Raw format:**
- Phase: `"thinking_summary"`
- Structure: 
  ```json
  {
    "delta": {
      "phase": "thinking_summary",
      "extra": {
        "summary_title": { "content": ["..."] },
        "summary_thought": { "content": ["..."] }
      }
    }
  }
  ```
- Backward compatibility: `reasoning_content` field

**Parser:** `qwen.thinking-parser.ts`

**Cách hoạt động:**
1. SSE parser phát hiện phase `"thinking_summary"`
2. Extract `summary_title` và `summary_thought` arrays
3. Format thành structured thinking content:
   ```
   ### Title
   ...title text...
   
   ### Thought
   ...thought text...
   ```
4. Wrap trong `<thinking>` tags
5. Khi status = "finished", emit closing tag

**Example:**
```typescript
// Input stream
{
  phase: "thinking_summary",
  extra: {
    summary_title: { content: ["Greeting the user warmly"] },
    summary_thought: { content: ["I recognize the Vietnamese greeting..."] }
  }
}

// Output
<thinking>### Title
Greeting the user warmly

### Thought
I recognize the Vietnamese greeting...</thinking>
```

## Usage trong SSE Parsers

### DeepSeek SSE Parser

```typescript
import { createDeepSeekThinkingParser } from './deepseek.thinking-parser';

const thinkingParser = createDeepSeekThinkingParser();

// Khi gặp THINK fragment
if (fragment.type === 'THINK') {
  const normalized = thinkingParser.feed(fragment.content);
  onThinking(normalized); // Emit <thinking>content
}

// Khi chuyển sang RESPONSE
if (fragment.type === 'RESPONSE') {
  const closing = thinkingParser.end({ elapsed_secs });
  onThinking(closing); // Emit </thinking>
}
```

### Qwen SSE Parser

```typescript
import { createQwenThinkingParser } from './qwen.thinking-parser';

const thinkingParser = createQwenThinkingParser();

// Khi gặp thinking_summary phase
if (phase === 'thinking_summary') {
  const normalized = thinkingParser.feedSummary({
    title: extra.summary_title?.content,
    thought: extra.summary_thought?.content,
  });
  onThinking(normalized); // Emit <thinking>### Title\n...
  
  if (status === 'finished') {
    const closing = thinkingParser.end();
    onThinking(closing); // Emit </thinking>
  }
}
```

## Client Integration (Zen)

Client nhận thinking content đã được chuẩn hóa qua callback `onThinking`:

```typescript
const response = await fetch('/api/chat', {
  // ... request config
});

// Parse SSE stream
for await (const chunk of parseSSE(response.body)) {
  if (chunk.type === 'thinking') {
    // Thinking content đã được wrap trong <thinking> tags
    displayThinking(chunk.content);
  } else if (chunk.type === 'content') {
    displayContent(chunk.content);
  }
}
```

## Benefits

1. **Consistent Format**: Client chỉ cần parse một format duy nhất
2. **Provider Agnostic**: Thêm provider mới không ảnh hưởng client code
3. **Structured Output**: XML tags dễ parse và render
4. **Metadata Support**: Comments cho metadata như elapsed time
5. **Backward Compatible**: Không break existing code

## Future Providers

Khi thêm provider mới có thinking support:

1. Tạo file `{provider}.thinking-parser.ts`
2. Implement parser class với methods:
   - `feed(chunk)`: Feed thinking chunks
   - `end()`: End thinking phase
   - `reset()`: Reset state
3. Integrate vào SSE parser của provider
4. Export từ provider index.ts

Format output phải tuân theo chuẩn `<thinking>...</thinking>`.
