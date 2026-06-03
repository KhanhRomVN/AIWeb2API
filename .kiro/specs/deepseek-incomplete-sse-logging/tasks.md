# Implementation Plan

## Overview

Thêm 12 log statements vào 3 file để đảm bảo observability đầy đủ cho pipeline SSE/continuation của DeepSeek. Fix chỉ additive (không thay đổi logic), theo thứ tự: viết exploration test → viết preservation test → implement → verify.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Missing Detailed Logs at SSE/Continuation Pipeline Events
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the missing-log bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — mock each of the 11 pipeline events and assert the required log fields are present
  - Test cases to cover (from Bug Condition `isBugCondition` spec in design):
    - Mock `parseSSEStream` with INCOMPLETE Pattern 1 payload → assert log contains `contentChunks` and `bytesProcessed`
    - Mock `parseSSEStream` with INCOMPLETE Pattern 2 (BATCH) payload → assert log contains `contentChunks` and `bytesProcessed`
    - Mock `parseSSEStream` with stream ending naturally (no `[DONE]`) → assert a warning log is emitted
    - Mock `parseSSEStream` completing → assert summary log contains `totalBytes`, `contentChunks`, `finalStatus`, `responseMessageId`
    - Mock auto-continue loop starting an attempt → assert log contains `attemptNumber`, `maxAttempts`, `sessionId`, `messageId`
    - Mock auto-continue loop finishing an attempt → assert log contains `result`, `duration`
    - Mock MAX_CONTINUATIONS reached → assert warning log contains `sessionId`, `totalAttempts`
    - Mock `useChatLLM` receiving `continuing: true` metadata → assert log contains `continuationCount`, `isContinuingBefore`, `isContinuingAfter`, `conversationId`
    - Mock `useChatLLM` receiving `continuing: false` metadata → assert log contains `isContinuingBefore`, `isContinuingAfter`, `conversationId`
    - Mock `useChatLLM` stream done while `isContinuing=true` → assert warning log contains `conversationId`, `isContinuingState`
    - Render `ChatBody` with `isContinuing` prop changing → assert `console.log` is called with new value
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., "INCOMPLETE Pattern 1 log missing `contentChunks` field", "no log emitted when stream ends without `[DONE]`")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - SSE Parsing Logic and State Transitions Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (inputs where `isBugCondition` returns false):
    - Observe: `parseSSEStream` with normal stream + `[DONE]` returns `{incomplete: false}` with correct `responseMessageId`
    - Observe: `parseSSEStream` accumulates and emits content chunks correctly via `onContent`
    - Observe: `parseSSEStream` routes THINK fragments to `onThinking` callback correctly
    - Observe: `useChatLLM` sets `isContinuing=true` when receiving `continuing: true` metadata
    - Observe: `useChatLLM` resets `isContinuing=false` when `stopGeneration` is called
    - Observe: `ChatBody` renders "Continuing long response…" UI when `isContinuing=true`, hides it when `false`
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements in design:
    - For all valid SSE stream payloads (mix of content, thinking, INCOMPLETE, DONE): `parseSSEStream` return value `{incomplete, responseMessageId}` is identical before and after fix
    - For all content chunk sequences: total content emitted via `onContent` is identical before and after fix
    - For all THINK fragment sequences: content routed to `onThinking` is identical before and after fix
    - For all metadata event sequences (`continuing: true/false`): `isContinuing` state transitions in `useChatLLM` are identical before and after fix
    - For all `isContinuing` boolean values: `ChatBody` render output (presence/absence of "Continuing long response…") is identical before and after fix
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 3. Fix: Add detailed logging at all SSE/continuation pipeline events

  - [ ] 3.1 Add tracking counters and upgrade INCOMPLETE Pattern 1 log in `parseSSEStream` (`server/src/provider/deepseek.ts`)
    - Declare `let contentChunkCount = 0` and `let totalBytesProcessed = 0` at the top of `parseSSEStream`
    - Increment `totalBytesProcessed += chunkStr.length` inside the `for await` loop
    - Increment `contentChunkCount++` each time `onContent` is called
    - Replace existing INCOMPLETE Pattern 1 log with:
      ```typescript
      logger.info(
        `[DeepSeek] INCOMPLETE detected (Pattern 1) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed}`,
      );
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "INCOMPLETE_PATTERN1"` and log lacks `contentChunks`, `bytesProcessed`_
    - _Expected_Behavior: log SHALL contain `sessionId`, `messageId`, `contentChunks`, `bytesProcessed` (Requirement 2.1)_
    - _Preservation: `parseSSEStream` return value and `onContent`/`onThinking` callbacks must remain unchanged (Requirements 3.1, 3.7)_
    - _Requirements: 2.1_

  - [ ] 3.2 Upgrade INCOMPLETE Pattern 2 (BATCH) log in `parseSSEStream` (`server/src/provider/deepseek.ts`)
    - Replace existing INCOMPLETE Pattern 2 log with:
      ```typescript
      logger.info(
        `[DeepSeek] INCOMPLETE detected (Pattern 2/BATCH) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed}`,
      );
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "INCOMPLETE_PATTERN2"` and log lacks `contentChunks`, `bytesProcessed`_
    - _Expected_Behavior: log SHALL contain `sessionId`, `messageId`, `contentChunks`, `bytesProcessed` (Requirement 2.2)_
    - _Preservation: BATCH detection logic and `isIncomplete` flag must remain unchanged (Requirements 3.1, 3.2)_
    - _Requirements: 2.2_

  - [ ] 3.3 Add natural stream-end warning log in `parseSSEStream` (`server/src/provider/deepseek.ts`)
    - After the `for await` loop ends (before `return`), add:
      ```typescript
      if (!isIncomplete) {
        logger.debug(
          `[DeepSeek] Stream ended naturally (no [DONE] token) | session=${sessionId} | msgId=${responseMessageId} | bytesProcessed=${totalBytesProcessed} | contentChunks=${contentChunkCount}`,
        );
      }
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "STREAM_END_NO_DONE"` and no warning log exists_
    - _Expected_Behavior: SHALL log warning distinguishing natural end from `[DONE]` end, with `sessionId`, `bytesReceived`, `chunksReceived` (Requirement 2.3)_
    - _Preservation: return value of `parseSSEStream` must remain unchanged (Requirement 3.1)_
    - _Requirements: 2.3_

  - [ ] 3.4 Add summary log at both return points in `parseSSEStream` (`server/src/provider/deepseek.ts`)
    - Before the `return` inside the `[DONE]` branch and before the final `return` at end of function, add:
      ```typescript
      logger.debug(
        `[DeepSeek] parseSSEStream complete | session=${sessionId} | status=${isIncomplete ? 'INCOMPLETE' : 'COMPLETE'} | msgId=${responseMessageId} | totalBytes=${totalBytesProcessed} | contentChunks=${contentChunkCount}`,
      );
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "PARSE_COMPLETE"` and no summary log exists_
    - _Expected_Behavior: SHALL log summary with `totalBytes`, `contentChunks`, `finalStatus`, `responseMessageId` (Requirement 2.4)_
    - _Preservation: both return paths must still return correct `{incomplete, responseMessageId}` (Requirement 3.1)_
    - _Requirements: 2.4_

  - [ ] 3.5 Upgrade auto-continue attempt start log in `handleMessage` (`server/src/provider/deepseek.ts`)
    - Replace existing attempt-start log with:
      ```typescript
      logger.info(
        `[DeepSeek] Auto-continue attempt ${continuationCount}/${MAX_CONTINUATIONS} | session=${sessionId} | msgId=${responseMessageId}`,
      );
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "CONTINUATION_START"` and log lacks `messageId`_
    - _Expected_Behavior: SHALL log `attemptNumber`, `maxAttempts`, `sessionId`, `messageId` (Requirement 2.5)_
    - _Preservation: auto-continue loop control flow must remain unchanged (Requirement 3.2)_
    - _Requirements: 2.5_

  - [ ] 3.6 Add auto-continue attempt result log in `handleMessage` (`server/src/provider/deepseek.ts`)
    - After `parseSSEStream` returns inside the continuation loop, add:
      ```typescript
      logger.info(
        `[DeepSeek] Auto-continue attempt ${continuationCount} result | incomplete=${continueResult.incomplete} | newMsgId=${continueResult.responseMessageId ?? 'unchanged'} | session=${sessionId}`,
      );
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "CONTINUATION_END"` and no result log exists_
    - _Expected_Behavior: SHALL log `result`, `duration`, `errorMessage` on failure (Requirement 2.6)_
    - _Preservation: error propagation from failed continuation attempts must remain unchanged (Requirement 3.8)_
    - _Requirements: 2.6_

  - [ ] 3.7 Verify MAX_CONTINUATIONS warning log in `handleMessage` (`server/src/provider/deepseek.ts`)
    - Verify existing MAX_CONTINUATIONS warning log includes `sessionId` and total attempts count
    - If missing, upgrade to:
      ```typescript
      logger.warn(
        `[DeepSeek] Max continuations reached | session=${sessionId} | totalAttempts=${continuationCount}`,
      );
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "MAX_CONTINUATIONS_REACHED"` and log lacks `totalAttempts`_
    - _Expected_Behavior: SHALL log warning with `sessionId` and `totalAttempts` (Requirement 2.7)_
    - _Preservation: loop termination behavior must remain unchanged (Requirement 3.2)_
    - _Requirements: 2.7_

  - [ ] 3.8 Upgrade `continuing: true` log in `useChatLLM` (`src/webview-ui/src/hooks/useChatLLM.ts`)
    - Capture `prevContinuing` before calling `setIsContinuing(true)`, then log:
      ```typescript
      const prevContinuing = isContinuing;
      setIsContinuing(true);
      console.log(
        `[Zen] isContinuing: ${prevContinuing} → true | continuation_count=${metaObj.continuation_count ?? '?'} | conversationId=${backendConversationId || currentConversationIdRef.current || 'none'}`,
      );
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "META_CONTINUING_TRUE"` and log lacks `continuationCount`, `isContinuingBefore`, `isContinuingAfter`, `conversationId`_
    - _Expected_Behavior: SHALL log `continuation_count`, before/after `isContinuing` state, `conversationId` (Requirement 2.8)_
    - _Preservation: `setIsContinuing(true)` call must remain; `isContinuing` state transition must be identical (Requirements 3.3, 3.5)_
    - _Requirements: 2.8_

  - [ ] 3.9 Add `continuing: false` log in `useChatLLM` (`src/webview-ui/src/hooks/useChatLLM.ts`)
    - In the `else if (isContinuing && metaObj.continuing === false)` branch, add log before `setIsContinuing(false)`:
      ```typescript
      } else if (isContinuing && metaObj.continuing === false) {
        console.log(
          `[Zen] isContinuing: true → false (server signaled completion) | conversationId=${backendConversationId || currentConversationIdRef.current || 'none'}`,
        );
        setIsContinuing(false);
      }
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "META_CONTINUING_FALSE"` and no log exists_
    - _Expected_Behavior: SHALL log completion signal with before/after `isContinuing` state and `conversationId` (Requirement 2.9)_
    - _Preservation: `setIsContinuing(false)` call must remain; state transition must be identical (Requirements 3.3, 3.6)_
    - _Requirements: 2.9_

  - [ ] 3.10 Add stream-done-while-continuing warning in `useChatLLM` (`src/webview-ui/src/hooks/useChatLLM.ts`)
    - After the `while (!done)` loop ends, before processing remaining buffer, add:
      ```typescript
      if (isContinuing) {
        console.warn(
          `[Zen] Stream ended but isContinuing is still true — server may not have sent continuing:false | conversationId=${backendConversationId || currentConversationIdRef.current || 'none'}`,
        );
      }
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "STREAM_DONE_WHILE_CONTINUING"` and no warning log exists_
    - _Expected_Behavior: SHALL log warning with `conversationId` and `isContinuingState` (Requirement 2.10)_
    - _Preservation: post-loop processing logic must remain unchanged (Requirements 3.3, 3.6)_
    - _Requirements: 2.10_

  - [ ] 3.11 Add `useEffect` log for `isContinuing` prop in `ChatBody` (`src/webview-ui/src/components/ChatPanel/ChatBody/index.tsx`)
    - Add a new `useEffect` after existing effects in `ChatBody`:
      ```typescript
      useEffect(() => {
        console.log(`[ChatBody] isContinuing prop changed: ${isContinuing}`);
      }, [isContinuing]);
      ```
    - _Bug_Condition: `isBugCondition(event)` where `event.type = "IS_CONTINUING_PROP_CHANGE"` and no log exists_
    - _Expected_Behavior: SHALL log new value of `isContinuing` prop on every change (Requirement 2.11)_
    - _Preservation: render output of `ChatBody` must remain identical — `useEffect` does not affect render (Requirements 3.4, 3.5)_
    - _Requirements: 2.11_

  - [ ] 3.12 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Detailed Logs Present at All Pipeline Events
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (all 11 log assertions)
    - When this test passes, it confirms all required log fields are now emitted
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms all 11 logging points are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [ ] 3.13 Verify preservation tests still pass
    - **Property 2: Preservation** - SSE Parsing Logic and State Transitions Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in parsing logic, state transitions, or render output)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run full test suite for both Elara server and Zen extension
  - Verify Property 1 (bug condition) test passes — all 11 log points emit correct fields
  - Verify Property 2 (preservation) test passes — no behavioral regressions
  - Ensure all tests pass; ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "wave": 4, "tasks": ["3.5", "3.6", "3.7"] },
    { "wave": 5, "tasks": ["3.8", "3.9", "3.10"] },
    { "wave": 6, "tasks": ["3.11"] },
    { "wave": 7, "tasks": ["3.12", "3.13"] },
    { "wave": 8, "tasks": ["4"] }
  ]
}
```

## Notes

- Tasks 1 và 2 phải chạy trên code **chưa fix** — kết quả expected là: task 1 FAIL, task 2 PASS
- Tasks 3.1–3.11 là các thay đổi additive, không thay đổi control flow hay logic
- Tasks 3.12 và 3.13 re-run đúng các test đã viết ở task 1 và 2 (không viết test mới)
- File Elara: `server/src/provider/deepseek.ts` (8 thay đổi: 3.1–3.7)
- File Zen hook: `src/webview-ui/src/hooks/useChatLLM.ts` (3 thay đổi: 3.8–3.10)
- File Zen component: `src/webview-ui/src/components/ChatPanel/ChatBody/index.tsx` (1 thay đổi: 3.11)
