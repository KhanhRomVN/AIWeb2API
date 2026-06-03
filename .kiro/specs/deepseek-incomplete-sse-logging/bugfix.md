# Bugfix Requirements Document

## Introduction

Logic phát hiện incomplete SSE stream từ DeepSeek và auto-continue đã hoạt động ở cả Elara server lẫn Zen extension, nhưng thiếu hoàn toàn log chi tiết để developer có thể debug và xác nhận flow end-to-end. Cụ thể: server phát hiện INCOMPLETE nhưng không log đủ context; Zen nhận metadata `continuing: true/false` nhưng không log để xác nhận; component `ChatBody` render UI "Continuing long response…" nhưng không log khi `isContinuing` prop thay đổi. Hậu quả là khi flow bị lỗi (ví dụ: server không gọi /chat/continue, hoặc Zen không nhận được metadata), developer không có đủ thông tin để xác định điểm gãy.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN DeepSeek SSE stream trả về `{"p":"response/status","o":"SET","v":"INCOMPLETE"}` (Pattern 1) THEN hệ thống chỉ log một dòng info cơ bản mà không log session ID, message ID, số bytes đã nhận, hay số content chunks trước thời điểm phát hiện INCOMPLETE

1.2 WHEN DeepSeek SSE stream trả về BATCH update chứa `quasi_status=INCOMPLETE` (Pattern 2) THEN hệ thống chỉ log một dòng info cơ bản mà không log thông tin chi tiết về BATCH payload hay trạng thái tích lũy tại thời điểm đó

1.3 WHEN SSE stream kết thúc tự nhiên (reader trả về `done=true`) mà không có token `[DONE]` THEN hệ thống không log sự kiện này, khiến developer không phân biệt được stream kết thúc bình thường hay bị cắt đột ngột

1.4 WHEN `parseSSEStream` hoàn thành (dù complete hay incomplete) THEN hệ thống không log summary tổng hợp (tổng bytes nhận, số content chunks, trạng thái cuối)

1.5 WHEN server bắt đầu gọi `/chat/continue` cho một continuation attempt THEN hệ thống chỉ log một dòng info mà không log số thứ tự attempt (attempt 1/3, 2/3...) hay thông tin session/messageId đầy đủ

1.6 WHEN server kết thúc một continuation attempt (thành công hoặc thất bại) THEN hệ thống không log kết quả của attempt đó

1.7 WHEN số lần continuation đạt đến giới hạn MAX_CONTINUATIONS THEN hệ thống không log cảnh báo rõ ràng về việc đã đạt giới hạn

1.8 WHEN Zen nhận được SSE chunk chứa metadata `continuing: true` từ server THEN hệ thống chỉ log một dòng đơn giản mà không log `continuation_count` hay trạng thái `isContinuing` trước/sau khi thay đổi

1.9 WHEN Zen nhận được SSE chunk chứa metadata `continuing: false` từ server THEN hệ thống không log sự kiện này (điều kiện `isContinuing && metaObj.continuing === false` không có log)

1.10 WHEN stream kết thúc (`done=true`) trong khi state `isContinuing` vẫn còn là `true` THEN hệ thống không log cảnh báo, khiến developer không biết server đã không gửi `continuing: false` để đóng vòng lặp

1.11 WHEN `isContinuing` prop thay đổi trong component `ChatBody` THEN component không log gì, khiến developer không xác nhận được prop có được truyền đúng từ parent hay không

### Expected Behavior (Correct)

2.1 WHEN DeepSeek SSE stream trả về Pattern 1 INCOMPLETE SHALL log chi tiết bao gồm: session ID, message ID, số content chunks đã nhận, số bytes đã xử lý tại thời điểm phát hiện

2.2 WHEN DeepSeek SSE stream trả về Pattern 2 INCOMPLETE SHALL log chi tiết bao gồm: session ID, message ID, nội dung BATCH payload liên quan, và trạng thái tích lũy hiện tại

2.3 WHEN SSE stream kết thúc tự nhiên không có `[DONE]` SHALL log cảnh báo rõ ràng phân biệt với kết thúc bình thường, kèm session ID và số bytes/chunks đã nhận

2.4 WHEN `parseSSEStream` hoàn thành SHALL log summary bao gồm: tổng bytes nhận, số content chunks, trạng thái cuối (complete/incomplete), và responseMessageId nếu có

2.5 WHEN server bắt đầu mỗi continuation attempt SHALL log số thứ tự attempt (ví dụ: "attempt 1/3"), session ID, message ID, và timestamp bắt đầu

2.6 WHEN server kết thúc mỗi continuation attempt SHALL log kết quả (success/failure), thời gian thực hiện, và nếu thất bại thì log error message

2.7 WHEN số lần continuation đạt MAX_CONTINUATIONS SHALL log cảnh báo rõ ràng kèm session ID và tổng số lần đã thử

2.8 WHEN Zen nhận metadata `continuing: true` SHALL log đầy đủ: giá trị `continuation_count`, trạng thái `isContinuing` trước và sau khi set, và conversationId hiện tại

2.9 WHEN Zen nhận metadata `continuing: false` SHALL log sự kiện completion kèm trạng thái `isContinuing` trước và sau khi reset, và conversationId hiện tại

2.10 WHEN stream kết thúc với `isContinuing` vẫn là `true` SHALL log cảnh báo rõ ràng rằng server không gửi `continuing: false`, kèm conversationId và trạng thái cuối

2.11 WHEN `isContinuing` prop thay đổi trong `ChatBody` SHALL log giá trị mới của prop để xác nhận data flow từ parent đến component

### Unchanged Behavior (Regression Prevention)

3.1 WHEN DeepSeek SSE stream hoàn thành bình thường với `[DONE]` SHALL CONTINUE TO xử lý và trả về kết quả đúng mà không bị ảnh hưởng bởi các log mới

3.2 WHEN server phát hiện INCOMPLETE và gọi `/chat/continue` SHALL CONTINUE TO thực hiện auto-continue logic đúng như hiện tại

3.3 WHEN Zen nhận content chunks bình thường (không có metadata continuing) SHALL CONTINUE TO render nội dung đúng mà không bị ảnh hưởng bởi log mới

3.4 WHEN `isContinuing` là `false` (trạng thái bình thường) SHALL CONTINUE TO không hiển thị UI "Continuing long response…" trong `ChatBody`

3.5 WHEN `isContinuing` là `true` SHALL CONTINUE TO hiển thị UI "Continuing long response…" với animation pulse đúng như hiện tại

3.6 WHEN user dừng generation (stopGeneration) SHALL CONTINUE TO reset `isContinuing` về `false` đúng như hiện tại

3.7 WHEN `parseSSEStream` xử lý thinking content (THINK fragments) SHALL CONTINUE TO phân tách và forward đúng đến `onThinking` callback

3.8 WHEN continuation attempt thất bại SHALL CONTINUE TO throw error và propagate lên handler đúng như hiện tại
