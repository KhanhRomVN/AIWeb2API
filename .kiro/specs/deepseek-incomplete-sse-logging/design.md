# DeepSeek Incomplete SSE Logging — Bugfix Design

## Overview

Bug này không phải lỗi logic mà là lỗi **observability**: flow phát hiện INCOMPLETE SSE stream và auto-continue đã hoạt động đúng, nhưng thiếu log chi tiết ở mọi điểm quan trọng trong pipeline. Khi flow bị lỗi (server không gọi `/chat/continue`, Zen không nhận metadata, component không render UI), developer không có đủ thông tin để xác định điểm gãy.

Fix tập trung vào **thêm log** tại 3 file, không thay đổi bất kỳ logic xử lý nào:

1. `server/src/provider/deepseek.ts` — log chi tiết trong `parseSSEStream` (INCOMPLETE detection, stream end, summary) và trong auto-continue loop (attempt tracking, result, max limit)
2. `src/webview-ui/src/hooks/useChatLLM.ts` — log khi nhận metadata `continuing: true/false` và khi stream kết thúc với `isContinuing` còn `true`
3. `src/webview-ui/src/components/ChatPanel/ChatBody/index.tsx` — log khi `isContinuing` prop thay đổi qua `useEffect`

## Glossary

- **Bug_Condition (C)**: Điều kiện xác định input bị ảnh hưởng bởi bug — bất kỳ sự kiện nào trong pipeline SSE/continuation mà hiện tại không có log đủ chi tiết để debug
- **Property (P)**: Hành vi đúng khi bug condition xảy ra — log phải được emit với đầy đủ context (session ID, message ID, counts, before/after state)
- **Preservation**: Toàn bộ logic xử lý SSE, auto-continue, render UI phải tiếp tục hoạt động đúng như trước; chỉ thêm log, không thay đổi control flow
- **`parseSSEStream`**: Hàm private trong `DeepSeekProvider` tại `server/src/provider/deepseek.ts` — parse SSE response body, emit content/thinking/metadata, trả về `{ incomplete, responseMessageId }`
- **`handleMessage`**: Hàm public trong `DeepSeekProvider` — orchestrate toàn bộ flow: tạo session, gọi completion API, parse stream, auto-continue loop
- **`continueIncompleteResponse`**: Hàm private trong `DeepSeekProvider` — gọi POST `/api/v0/chat/continue` để resume truncated response
- **`useChatLLM`**: React hook tại `src/webview-ui/src/hooks/useChatLLM.ts` — quản lý state chat, đọc SSE stream từ Elara server, set `isContinuing` state
- **`ChatBody`**: React component tại `src/webview-ui/src/components/ChatPanel/ChatBody/index.tsx` — nhận `isContinuing` prop, render UI "Continuing long response…"
- **`isContinuing`**: React state trong `useChatLLM` và prop trong `ChatBody` — `true` khi server đang auto-continue response bị ngắt
- **`continuation_count`**: Số thứ tự lần continue hiện tại, được server gửi trong metadata
- **INCOMPLETE Pattern 1**: SSE event `{"p":"response/status","o":"SET","v":"INCOMPLETE"}`
- **INCOMPLETE Pattern 2**: SSE BATCH event chứa `{"p":"quasi_status","v":"INCOMPLETE"}`
- **`[DONE]`**: Token kết thúc stream bình thường trong SSE

## Bug Details

### Bug Condition

Bug xảy ra khi bất kỳ sự kiện nào trong pipeline SSE/continuation được xử lý mà không emit log đủ chi tiết. Cụ thể có 11 điểm trong code hiện tại thiếu log hoặc log không đủ context.

**Formal Specification:**
```
FUNCTION isBugCondition(event)
  INPUT: event — một sự kiện trong pipeline SSE/continuation
  OUTPUT: boolean

  RETURN (
    -- Elara server: parseSSEStream
    (event.type = "INCOMPLETE_PATTERN1" AND NOT hasDetailedLog(event, ["sessionId", "messageId", "contentChunks", "bytesProcessed"]))
    OR (event.type = "INCOMPLETE_PATTERN2" AND NOT hasDetailedLog(event, ["sessionId", "messageId", "batchPayload", "accumulatedState"]))
    OR (event.type = "STREAM_END_NO_DONE" AND NOT hasWarningLog(event, ["sessionId", "bytesReceived", "chunksReceived"]))
    OR (event.type = "PARSE_COMPLETE" AND NOT hasSummaryLog(event, ["totalBytes", "contentChunks", "finalStatus", "responseMessageId"]))

    -- Elara server: handleMessage auto-continue loop
    OR (event.type = "CONTINUATION_START" AND NOT hasAttemptLog(event, ["attemptNumber", "maxAttempts", "sessionId", "messageId"]))
    OR (event.type = "CONTINUATION_END" AND NOT hasResultLog(event, ["result", "duration", "errorMessage"]))
    OR (event.type = "MAX_CONTINUATIONS_REACHED" AND NOT hasWarningLog(event, ["sessionId", "totalAttempts"]))

    -- Zen: useChatLLM
    OR (event.type = "META_CONTINUING_TRUE" AND NOT hasDetailedLog(event, ["continuationCount", "isContinuingBefore", "isContinuingAfter", "conversationId"]))
    OR (event.type = "META_CONTINUING_FALSE" AND NOT hasLog(event, ["isContinuingBefore", "isContinuingAfter", "conversationId"]))
    OR (event.type = "STREAM_DONE_WHILE_CONTINUING" AND NOT hasWarningLog(event, ["conversationId", "isContinuingState"]))

    -- Zen: ChatBody
    OR (event.type = "IS_CONTINUING_PROP_CHANGE" AND NOT hasLog(event, ["newValue"]))
  )
END FUNCTION
```

### Examples

- **Pattern 1 INCOMPLETE thiếu context**: Server log `[DeepSeek] Response INCOMPLETE detected (session=abc123, msgId=456)` — đúng nhưng thiếu số content chunks đã nhận và bytes đã xử lý tại thời điểm đó
- **Pattern 2 INCOMPLETE thiếu context**: Server log `[DeepSeek] Response INCOMPLETE detected via BATCH (session=abc123, msgId=456)` — thiếu nội dung BATCH payload liên quan
- **Stream kết thúc không có `[DONE]`**: Không có log nào — developer không biết stream bị cắt hay kết thúc bình thường
- **`parseSSEStream` hoàn thành**: Không có summary log — không biết tổng bytes, số chunks, trạng thái cuối
- **Continuation attempt bắt đầu**: Log `[DeepSeek] Auto-continuing response (attempt 1/10, session=abc123)` — thiếu messageId và timestamp
- **Continuation attempt kết thúc**: Không có log kết quả — không biết attempt thành công hay thất bại
- **MAX_CONTINUATIONS đạt giới hạn**: Log warn đã có nhưng thiếu tổng số lần đã thử
- **Zen nhận `continuing: true`**: Log `[Zen] DeepSeek continuing response (part 1)` — thiếu `isContinuing` before/after và conversationId
- **Zen nhận `continuing: false`**: Không có log — developer không biết server đã gửi completion signal
- **Stream done với `isContinuing=true`**: Không có log — developer không biết server quên gửi `continuing: false`
- **`isContinuing` prop thay đổi trong ChatBody**: Không có log — không xác nhận được prop flow từ parent

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `parseSSEStream` phải tiếp tục parse đúng tất cả SSE event types (INCOMPLETE Pattern 1 & 2, `[DONE]`, content fragments, thinking fragments, metadata)
- Auto-continue loop trong `handleMessage` phải tiếp tục gọi `/chat/continue` đúng số lần, với đúng payload, và dừng đúng điều kiện
- `useChatLLM` phải tiếp tục set `isContinuing` state đúng khi nhận metadata `continuing: true/false`
- `ChatBody` phải tiếp tục render UI "Continuing long response…" khi `isContinuing=true` và ẩn khi `false`
- `stopGeneration` phải tiếp tục reset `isContinuing` về `false`
- Thinking content (THINK fragments) phải tiếp tục được forward đúng đến `onThinking` callback
- Continuation attempt thất bại phải tiếp tục throw error và propagate đúng

**Scope:**
Tất cả input không liên quan đến các điểm log mới phải hoàn toàn không bị ảnh hưởng. Cụ thể:
- SSE stream hoàn thành bình thường với `[DONE]` — không bị ảnh hưởng
- Content chunks bình thường (không có metadata continuing) — không bị ảnh hưởng
- Mouse clicks, keyboard input, và các tương tác UI khác — không bị ảnh hưởng
- Các provider khác (không phải DeepSeek) — không bị ảnh hưởng

## Hypothesized Root Cause

Bug này là **thiếu sót trong implementation** chứ không phải lỗi logic. Khi feature auto-continue được implement, developer đã thêm log cơ bản nhưng không đủ chi tiết để debug end-to-end flow. Cụ thể:

1. **Thiếu tracking state trong `parseSSEStream`**: Hàm không track `contentChunkCount` và `totalBytesProcessed` nên không thể log chúng khi phát hiện INCOMPLETE hay khi kết thúc

2. **Thiếu log tại stream end tự nhiên**: Vòng `for await` trong `parseSSEStream` kết thúc khi stream hết data mà không có log — không phân biệt được với `[DONE]`

3. **Thiếu log kết quả continuation**: Auto-continue loop log khi bắt đầu attempt nhưng không log khi kết thúc (thành công hay thất bại với duration)

4. **Thiếu log `continuing: false` trong Zen**: Điều kiện `isContinuing && metaObj.continuing === false` có code set state nhưng không có log

5. **Thiếu `useEffect` log trong `ChatBody`**: Component không có `useEffect` để log khi `isContinuing` prop thay đổi — đây là pattern chuẩn để debug prop flow trong React

6. **Thiếu log stream-done-while-continuing trong Zen**: Sau vòng `while (!done)`, không có check `if (isContinuing)` để log cảnh báo

## Correctness Properties

Property 1: Bug Condition — Detailed Logging at All Pipeline Events

_For any_ sự kiện trong pipeline SSE/continuation mà `isBugCondition(event)` trả về `true` (tức là sự kiện đó thiếu log đủ chi tiết), sau khi fix, hệ thống SHALL emit log với đầy đủ context fields được định nghĩa trong bug condition — bao gồm session ID, message ID, counts, before/after state tùy theo loại sự kiện.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11**

Property 2: Preservation — No Logic Change

_For any_ input mà `isBugCondition(input)` trả về `false` (tức là input không liên quan đến các điểm log mới), hệ thống sau fix SHALL produce exactly the same behavior as before the fix — không có thay đổi về control flow, state transitions, hay output của `parseSSEStream`, `handleMessage`, `useChatLLM`, hay `ChatBody`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Fix chỉ thêm log statements, không thay đổi logic. Tất cả thay đổi là additive.

---

**File 1**: `server/src/provider/deepseek.ts`

**Function**: `parseSSEStream`

**Specific Changes**:

1. **Thêm tracking counters**: Khai báo `let contentChunkCount = 0` và `let totalBytesProcessed = 0` ở đầu hàm. Tăng `totalBytesProcessed += chunkStr.length` trong vòng `for await`, tăng `contentChunkCount++` mỗi khi `onContent` được gọi.

2. **Nâng cấp log INCOMPLETE Pattern 1**: Thay log hiện tại bằng log bao gồm `contentChunkCount` và `totalBytesProcessed`:
   ```typescript
   logger.info(
     `[DeepSeek] INCOMPLETE detected (Pattern 1) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed}`,
   );
   ```

3. **Nâng cấp log INCOMPLETE Pattern 2**: Tương tự, thêm context vào log BATCH:
   ```typescript
   logger.info(
     `[DeepSeek] INCOMPLETE detected (Pattern 2/BATCH) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed}`,
   );
   ```

4. **Thêm log stream end tự nhiên**: Sau vòng `for await` kết thúc (trước `return`), thêm:
   ```typescript
   if (!isIncomplete) {
     logger.debug(
       `[DeepSeek] Stream ended naturally (no [DONE] token) | session=${sessionId} | msgId=${responseMessageId} | bytesProcessed=${totalBytesProcessed} | contentChunks=${contentChunkCount}`,
     );
   }
   ```

5. **Thêm summary log trước mỗi `return`**: Cả hai return points (`[DONE]` và cuối hàm) đều log summary:
   ```typescript
   logger.debug(
     `[DeepSeek] parseSSEStream complete | session=${sessionId} | status=${isIncomplete ? 'INCOMPLETE' : 'COMPLETE'} | msgId=${responseMessageId} | totalBytes=${totalBytesProcessed} | contentChunks=${contentChunkCount}`,
   );
   ```

---

**File 1**: `server/src/provider/deepseek.ts`

**Function**: `handleMessage` (auto-continue loop)

**Specific Changes**:

6. **Nâng cấp log attempt start**: Thêm `messageId` và timestamp vào log hiện tại:
   ```typescript
   logger.info(
     `[DeepSeek] Auto-continue attempt ${continuationCount}/${MAX_CONTINUATIONS} | session=${sessionId} | msgId=${responseMessageId}`,
   );
   ```

7. **Thêm log attempt result**: Sau khi `parseSSEStream` trả về trong loop, log kết quả:
   ```typescript
   logger.info(
     `[DeepSeek] Auto-continue attempt ${continuationCount} result | incomplete=${continueResult.incomplete} | newMsgId=${continueResult.responseMessageId ?? 'unchanged'} | session=${sessionId}`,
   );
   ```

8. **Nâng cấp log MAX_CONTINUATIONS**: Log hiện tại đã có nhưng thêm `continuationCount` rõ ràng hơn (đã có trong log hiện tại, chỉ verify).

---

**File 2**: `src/webview-ui/src/hooks/useChatLLM.ts`

**Function**: `sendMessage` (SSE reading loop)

**Specific Changes**:

9. **Nâng cấp log `continuing: true`**: Thay log hiện tại bằng log đầy đủ hơn:
   ```typescript
   const prevContinuing = isContinuing;
   setIsContinuing(true);
   console.log(
     `[Zen] isContinuing: ${prevContinuing} → true | continuation_count=${metaObj.continuation_count ?? '?'} | conversationId=${backendConversationId || currentConversationIdRef.current || 'none'}`,
   );
   ```

10. **Thêm log `continuing: false`**: Thêm log vào nhánh `else if`:
    ```typescript
    } else if (isContinuing && metaObj.continuing === false) {
      console.log(
        `[Zen] isContinuing: true → false (server signaled completion) | conversationId=${backendConversationId || currentConversationIdRef.current || 'none'}`,
      );
      setIsContinuing(false);
    }
    ```

11. **Thêm log stream-done-while-continuing**: Sau vòng `while (!done)`, trước khi xử lý remaining buffer:
    ```typescript
    if (isContinuing) {
      console.warn(
        `[Zen] Stream ended but isContinuing is still true — server may not have sent continuing:false | conversationId=${backendConversationId || currentConversationIdRef.current || 'none'}`,
      );
    }
    ```

---

**File 3**: `src/webview-ui/src/components/ChatPanel/ChatBody/index.tsx`

**Component**: `ChatBody`

**Specific Changes**:

12. **Thêm `useEffect` log `isContinuing` prop**: Thêm effect sau các effect hiện có:
    ```typescript
    useEffect(() => {
      console.log(`[ChatBody] isContinuing prop changed: ${isContinuing}`);
    }, [isContinuing]);
    ```

## Testing Strategy

### Validation Approach

Testing theo hai phase: (1) chạy test trên code **chưa fix** để xác nhận bug condition — các log chi tiết không xuất hiện; (2) chạy test trên code **đã fix** để xác nhận Property 1 (log đầy đủ) và Property 2 (logic không thay đổi).

### Exploratory Bug Condition Checking

**Goal**: Xác nhận rằng trên code chưa fix, các sự kiện trong pipeline không có log đủ chi tiết. Confirm root cause analysis.

**Test Plan**: Mock SSE stream với INCOMPLETE payload, chạy `parseSSEStream`, capture log output, assert rằng log thiếu các fields như `contentChunks`, `bytesProcessed`. Tương tự cho Zen hook và ChatBody component.

**Test Cases**:
1. **INCOMPLETE Pattern 1 — thiếu context**: Mock stream với `{"p":"response/status","o":"SET","v":"INCOMPLETE"}`, assert log không chứa `contentChunks` hay `bytesProcessed` (sẽ pass trên unfixed code)
2. **Stream end tự nhiên — không có log**: Mock stream kết thúc không có `[DONE]`, assert không có log nào về stream end (sẽ pass trên unfixed code)
3. **`continuing: false` — không có log**: Mock Zen nhận metadata `{continuing: false}` khi `isContinuing=true`, assert không có log nào (sẽ pass trên unfixed code)
4. **`isContinuing` prop change — không có log**: Render `ChatBody` với `isContinuing` thay đổi, assert không có `console.log` từ component (sẽ pass trên unfixed code)

**Expected Counterexamples**:
- Log output thiếu các fields chi tiết
- Một số sự kiện hoàn toàn không có log

### Fix Checking

**Goal**: Verify rằng sau fix, tất cả sự kiện trong bug condition đều có log đầy đủ.

**Pseudocode:**
```
FOR ALL event WHERE isBugCondition(event) DO
  result := runPipelineWithFixedCode(event)
  ASSERT hasDetailedLog(result.logs, event.requiredFields)
END FOR
```

### Preservation Checking

**Goal**: Verify rằng logic xử lý không thay đổi — output của `parseSSEStream`, state transitions trong `useChatLLM`, và render output của `ChatBody` giống hệt trước fix.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) = fixedBehavior(input)
END FOR
```

**Testing Approach**: Property-based testing phù hợp cho preservation checking vì:
- Generate nhiều SSE stream payloads khác nhau tự động
- Catch edge cases mà manual test bỏ sót
- Đảm bảo mạnh mẽ rằng behavior không thay đổi cho tất cả non-buggy inputs

**Test Plan**: Capture behavior của code chưa fix cho các input bình thường, sau đó viết property-based test verify behavior giống hệt sau fix.

**Test Cases**:
1. **Normal stream completion**: Verify `parseSSEStream` trả về `{incomplete: false}` cho stream có `[DONE]` — giống hệt trước và sau fix
2. **Content accumulation**: Verify tổng content được emit qua `onContent` giống hệt trước và sau fix
3. **Thinking content routing**: Verify THINK fragments vẫn được forward đúng đến `onThinking`
4. **`isContinuing` state transitions**: Verify `useChatLLM` set/reset `isContinuing` đúng khi nhận metadata

### Unit Tests

- Test `parseSSEStream` với INCOMPLETE Pattern 1: verify log chứa `contentChunks` và `bytesProcessed`
- Test `parseSSEStream` với INCOMPLETE Pattern 2: verify log chứa BATCH context
- Test `parseSSEStream` với stream end tự nhiên: verify warning log được emit
- Test `parseSSEStream` summary log: verify log xuất hiện ở cả hai return points
- Test auto-continue loop: verify log attempt start chứa `msgId`, log attempt result chứa `incomplete` status
- Test `useChatLLM` với `continuing: true`: verify log chứa `continuation_count` và before/after state
- Test `useChatLLM` với `continuing: false`: verify log được emit
- Test `useChatLLM` stream done while continuing: verify warning log
- Test `ChatBody` `isContinuing` prop change: verify `console.log` được gọi với giá trị mới

### Property-Based Tests

- Generate random SSE stream payloads (mix of content, thinking, INCOMPLETE, DONE) — verify `parseSSEStream` trả về đúng `{incomplete, responseMessageId}` trước và sau fix
- Generate random sequences của metadata events (`continuing: true/false`) — verify `isContinuing` state transitions trong `useChatLLM` giống hệt trước và sau fix
- Generate random `isContinuing` boolean values — verify `ChatBody` render output (có/không có "Continuing long response…") giống hệt trước và sau fix

### Integration Tests

- Test full flow: Elara server nhận INCOMPLETE stream → gọi `/chat/continue` → Zen nhận `continuing: true` → `ChatBody` render UI → Zen nhận `continuing: false` → `ChatBody` ẩn UI; verify tất cả log xuất hiện đúng thứ tự
- Test flow với MAX_CONTINUATIONS: verify warning log xuất hiện sau 10 attempts
- Test `stopGeneration` flow: verify `isContinuing` reset về `false` và không có spurious log
