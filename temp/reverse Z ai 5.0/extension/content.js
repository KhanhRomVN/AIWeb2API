// content.js - Injected into the page's isolated world

// Cross-browser API wrapper (Chrome + Firefox)
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
let indicator = null;
let currentRequestId = null;
let isStreaming = false; // ✅ Fix P2: Track streaming state to throttle remote_log
let isWafBlocked = false; // 🚨 WAF Shield: chặn gửi tiếp khi bị 403/429/503
let wafUnlockTimer = null; // ⏱️ Tự động mở khóa WAF sau 60s (CAPTCHA đã giải)

// 🛡️ Client-Side Rate Limiter — tối thiểu 4s giữa các request
const MIN_REQUEST_INTERVAL_MS = 4000;
let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
    const wait =
      MIN_REQUEST_INTERVAL_MS - elapsed + Math.floor(Math.random() * 800);
    console.log(
      `[Content] 🛡️ Rate limit: waiting ${wait}ms before next request`,
    );
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
}

console.log("[Content] Z.AI Bridge content script loaded (Network Mode).");

// 1. Inject inject.js vào MAIN world
const script = document.createElement("script");
script.src = browserAPI.runtime.getURL("inject.js");
script.onload = () => script.remove();
(document.documentElement || document.head).appendChild(script);

let sendBuffer = [];
let sendBufferTimer = null;

function safeSend(msgObj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  if (currentRequestId && !msgObj.requestId) {
    msgObj.requestId = currentRequestId;
  }

  sendBuffer.push(JSON.stringify(msgObj));

  if (!sendBufferTimer) {
    sendBufferTimer = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          // Gộp nhiều messages thành 1 WS frame, phân tách bằng \n
          const batch = sendBuffer.join("\n");
          ws.send(batch);
        } catch (e) {
          console.error("[Content] Batch send failed:", e);
        }
      }
      sendBuffer = [];
      sendBufferTimer = null;
    }, 50); // Batch mỗi 50ms
  }
}

// 2. Lắng nghe message từ inject.js (chạy ở MAIN world)
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data) return;

  if (data.type === "Z_AI_SSE_DELTA" && data.payload) {
    // Nhận được SSE chunk chuẩn xác 100% từ mạng
    const sseData = data.payload;

    // Kiểm tra nếu AI đã xong (Z.AI format)
    if (
      sseData.data &&
      sseData.data.phase === "done" &&
      sseData.data.done === true
    ) {
      console.log(
        "[Content] Received 'done' phase from network. Closing stream.",
      );
      isStreaming = false; // ✅ Fix P2: Reset streaming flag
      safeSend({ type: "stream_end" });
      return;
    }

    // Chuyển tiếp dữ liệu stream về local server
    if (sseData.data && sseData.data.delta_content) {
      isStreaming = true; // ✅ Fix P2: Set streaming flag — throttle remote_log
      safeSend({
        type: "stream_chunk",
        chunk: `data: ${JSON.stringify(sseData)}\n\n`,
        requestId: currentRequestId,
      });
    }
  } else if (data.type === "Z_AI_SSE_DELTAS" && data.payloads) {
    for (const payload of data.payloads) {
      if (
        payload.data &&
        payload.data.phase === "done" &&
        payload.data.done === true
      ) {
        console.log(
          "[Content] Received 'done' phase from network batch. Closing stream.",
        );
        isStreaming = false;
        safeSend({ type: "stream_end" });
        continue;
      }
      if (payload.data && payload.data.delta_content) {
        isStreaming = true;
        safeSend({
          type: "stream_chunk",
          chunk: `data: ${JSON.stringify(payload)}\n\n`,
          requestId: currentRequestId,
        });
      }
    }
  } else if (data.type === "Z_AI_STREAM_END_RAW") {
    // Dự phòng: Nếu stream đóng ở cấp độ TCP mà không có tag done
    isStreaming = false; // ✅ Fix P2: Reset streaming flag
    safeSend({ type: "stream_end", requestId: currentRequestId });
  } else if (data.type === "Z_AI_WAF_BLOCK") {
    // 🚨 WAF Shield: bật cờ + hiện indicator + auto-unlock sau 60s
    console.log(
      "[Content] 🚨 WAF block detected from inject.js! Status:",
      data.status,
    );
    isWafBlocked = true;
    updateIndicator(
      "🚨 WAF BLOCKED! Solve CAPTCHA (auto-retry in 60s)",
      "#FF5722",
    );
    safeSend({
      type: "waf_block",
      status: data.status,
      requestId: currentRequestId,
    });
    // ⏱️ Tự reset sau 60s — cho phép retry sau khi user giải CAPTCHA
    if (wafUnlockTimer) clearTimeout(wafUnlockTimer);
    wafUnlockTimer = setTimeout(() => {
      isWafBlocked = false;
      wafUnlockTimer = null;
      updateIndicator("🟡 WAF cooldown ended — retry allowed", "#FF9800");
      console.log("[Content] 🛡️ WAF auto-unlocked after 60s cooldown.");
    }, 60000);
  } else if (data.type === "Z_AI_USAGE" && data.usage) {
    console.log("[Content] 📊 Usage data from Z.AI API:", JSON.stringify(data.usage));
    safeSend({
      type: "usage",
      usage: data.usage,
      requestId: currentRequestId
    });
  } else if (data.type === "Z_AI_SEARCH_RESULTS" && data.results) {
    console.log("[Content] 🔍 Search results received:", data.results.length, "results");
    safeSend({
      type: "search_results",
      results: data.results,
      requestId: currentRequestId
    });
  } else if (data.type === "Z_AI_SEARCH_PHASE") {
    console.log("[Content] 🔍 Search phase:", data.phase);
    safeSend({
      type: "search_phase",
      phase: data.phase,
      requestId: currentRequestId
    });
  }
});

// Remote Logging
// Only forward error/warn logs, not all console.log (Issue #5 fix)
let isLogging = false;

const originalLog = console.log;
console.log = (...args) => {
  originalLog.apply(console, args);
};

const originalError = console.error;
console.error = (...args) => {
  originalError.apply(console, args);
  if (isLogging) return;
  isLogging = true;
  try {
    if (isStreaming) return; // Skip safeSend to prevent WS flood during streaming
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "remote_log",
          logType: "error",
          text: args.join(" "),
        }),
      );
    }
  } catch (e) {
    originalError.apply(console, ["[Content] Failed to send remote log:", e]);
  } finally {
    isLogging = false;
  }
};

const originalWarn = console.warn;
console.warn = (...args) => {
  originalWarn.apply(console, args);
  if (isLogging) return;
  isLogging = true;
  try {
    if (isStreaming) return; // Skip safeSend to prevent WS flood during streaming
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "remote_log",
          logType: "warn",
          text: args.join(" "),
        }),
      );
    }
  } catch (e) {
    originalError.apply(console, ["[Content] Failed to send remote log:", e]);
  } finally {
    isLogging = false;
  }
};

function updateIndicator(text, color) {
  if (!indicator) indicator = document.getElementById("z-ai-bridge-indicator");
  if (indicator) {
    indicator.innerText = text;
    indicator.style.background = color;
  }
}

function injectIndicator() {
  const createIndicator = () => {
    if (document.getElementById("z-ai-bridge-indicator")) return;
    indicator = document.createElement("div");
    indicator.id = "z-ai-bridge-indicator";
    indicator.style.cssText =
      "position:fixed;bottom:20px;right:20px;background:#f44336;color:white;padding:8px 12px;zIndex:999999;borderRadius:4px;fontSize:12px;fontWeight:bold;fontFamily:sans-serif;boxShadow:0 2px 10px rgba(0,0,0,0.3);pointerEvents:none;";
    indicator.innerText = "🔴 Z.AI Bridge Disconnected";
    document.body.appendChild(indicator);
  };
  // Use DOMContentLoaded instead of polling (Issue #11 fix)
  if (document.body) {
    createIndicator();
  } else {
    document.addEventListener("DOMContentLoaded", createIndicator);
  }
}
injectIndicator();

// ============================================================
// 🧠 Full DOM Optimizer — Ẩn thinking + Containment + Hide Old Messages
// Giảm tải browser khi stream code lớn, chống lag và treo trang
// ============================================================

(function optimizeZaiDOM() {
  const style = document.createElement("style");
  style.id = "z-ai-dom-optimizer";
  style.textContent = `
    /* ===== THINKING: Ẩn hoàn toàn ===== */
    .thinking-chain-container,
    .thinking-block {
      display: none !important;
      max-height: 0 !important;
      overflow: hidden !important;
      visibility: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* ===== MESSAGES CŨ: Chỉ ẩn tin cũ thông qua class tĩnh được JS quản lý ===== */
    .z-ai-old-message {
      display: none !important;
    }

    /* ===== OUTPUT: CSS Containment — ngăn reflow cascade ===== */
    .prose,
    .chat-assistant,
    .chat-user,
    article {
      contain: content;
      content-visibility: auto;
      contain-intrinsic-size: auto 800px;
    }

    pre, code {
      contain: content;
      content-visibility: auto;
      contain-intrinsic-size: auto 600px;
    }

    pre {
      max-height: 400px !important;
      overflow-y: auto !important;
    }

    [class*="captcha"],
    [class*="challenge"],
    [class*="verify"],
    [class*="slider"],
    iframe[src*="captcha"],
    [class*="error"],
    [class*="toast"],
    [class*="notification"] {
      display: block !important;
      visibility: visible !important;
      content-visibility: visible !important;
      contain: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
  let hideMsgTimer = null;

  function hideOldMessages() {
    hideMsgTimer = null;
    const containers = document.querySelectorAll(
      ".chat-assistant, .chat-user, article",
    );
    const total = containers.length;
    if (total <= 2) return;

    // Ẩn tin nhắn cũ (giữ lại 2 tin nhắn mới nhất)
    for (let i = 0; i < total - 2; i++) {
      if (!containers[i].classList.contains("z-ai-old-message")) {
        containers[i].classList.add("z-ai-old-message");
      }
    }
    // Đảm bảo 2 tin nhắn mới nhất luôn visible
    for (let i = Math.max(0, total - 2); i < total; i++) {
      containers[i].classList.remove("z-ai-old-message");
    }
  }

  function scheduleHideOldMessages() {
    if (hideMsgTimer) return;
    hideMsgTimer = setTimeout(hideOldMessages, 500);
  }

  const hideMsgObserver = new MutationObserver(() => {
    scheduleHideOldMessages();
  });
  hideMsgObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Chạy 1 lần khi khởi tạo
  hideOldMessages();
  console.log(
    "[Content] 🧠 JS Message Hider activated (MutationObserver + 500ms throttle).",
  );
})();

// ============================================================
// 🟢 Page Ready Detection — Chờ textarea rồi báo server
// ============================================================

let _pageReadyObserver = null;
let _pageReadyTimeout = null;

function waitForPageReadyAndSignal(context) {
  if (_pageReadyObserver) {
    _pageReadyObserver.disconnect();
    _pageReadyObserver = null;
  }
  if (_pageReadyTimeout) {
    clearTimeout(_pageReadyTimeout);
    _pageReadyTimeout = null;
  }

  const ta = document.querySelector("textarea");
  if (ta) {
    console.log(`[Content] ✅ page_ready (immediate) — context: ${context}`);
    safeSend({ type: "page_ready", context });
    return;
  }

  _pageReadyObserver = new MutationObserver(() => {
    const ta2 = document.querySelector("textarea");
    if (ta2) {
      _pageReadyObserver.disconnect();
      _pageReadyObserver = null;
      clearTimeout(_pageReadyTimeout);
      _pageReadyTimeout = null;
      console.log(`[Content] ✅ page_ready (observed) — context: ${context}`);
      safeSend({ type: "page_ready", context });
    }
  });
  _pageReadyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  _pageReadyTimeout = setTimeout(() => {
    if (_pageReadyObserver) {
      _pageReadyObserver.disconnect();
      _pageReadyObserver = null;
    }
    _pageReadyTimeout = null;
    console.warn(`[Content] ⚠️ page_ready timeout (15s) — proceeding anyway`);
    safeSend({ type: "page_ready", context, timedOut: true });
  }, 15000);
}

function connectWS() {
  if (ws)
    try {
      ws.close();
    } catch (e) {}
  ws = new WebSocket("ws://127.0.0.1:8899?client=content");

  ws.onopen = () => {
    console.log("[Content] Connected to WS");
    isWafBlocked = false; // 🚨 WAF Shield: reset cờ khi reconnect
    if (wafUnlockTimer) {
      clearTimeout(wafUnlockTimer);
      wafUnlockTimer = null;
    }
    updateIndicator("🟢 Z.AI Bridge Connected (Network Mode)", "#4CAF50");
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Báo server biết trang đã sẵn sàng (chờ textarea)
    waitForPageReadyAndSignal("startup");
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.action === "send_prompt") {
        currentRequestId = data.requestId;
        if (data.isNewChat) {
          console.log("[Content] 🆕 Starting a new conversation (isNewChat = true).");
        } else {
          console.log("[Content] ➡️ Continuing active conversation (isNewChat = false).");
        }
        handleSendPrompt(data.prompt, data.isSearch || false);
      } else if (data.action === "cancel_stream") {
        // Logic dừng stream (có thể bấm nút stop trên UI nếu cần)
        const textarea = document.querySelector("textarea");
        if (textarea) {
          const container =
            textarea.closest("form") || textarea.parentElement?.parentElement;
          const btns = container?.querySelectorAll("button");
          if (btns) {
            for (const btn of btns) {
              if (
                btn.innerHTML.toLowerCase().includes("rect") ||
                btn.innerHTML.toLowerCase().includes("square")
              ) {
                btn.click();
                break;
              }
            }
          }
        }
      } else if (data.action === "reset_page") {
        // Ignored reload/redirect to keep the current conversation page active
        console.log("[Content] ℹ️ reset_page received but ignored to keep current chat page.");
        waitForPageReadyAndSignal("reset_ignored");
      }
    } catch (e) {
      console.error("[Content] Error parsing WS message:", e);
    }
  };

  ws.onclose = () => {
    // Flush & cleanup send buffer trước khi đánh dấu disconnected
    if (sendBuffer.length > 0) {
      console.warn(
        "[Content] WS closed with",
        sendBuffer.length,
        "unsent messages — dropped",
      );
      sendBuffer = [];
    }
    if (sendBufferTimer) {
      clearTimeout(sendBufferTimer);
      sendBufferTimer = null;
    }
    updateIndicator("🔴 Z.AI Bridge Disconnected", "#f44336");
    // Exponential backoff with max retries (Issue #10 fix)
    if (!reconnectTimer) {
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts), 60000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectWS();
        }, delay);
      } else {
        console.log("[Content] Max reconnect attempts reached. Giving up.");
      }
    }
  };
}
connectWS();

async function handleSendPrompt(prompt, isSearch) {
  // ← NEW: Set search flag for inject.js to pick up
  if (isSearch) {
    console.log("[Content] 🔍 Search mode: sending Z_AI_ENABLE_SEARCH to inject.js");
    window.postMessage({ type: "Z_AI_ENABLE_SEARCH" }, "*");
  }

  // 🚨 WAF Shield: chặn gửi khi bị WAF block
  if (isWafBlocked) {
    console.warn(
      "[Content] 🚨 WAF blocked — aborting send. Solve CAPTCHA first.",
    );
    safeSend({
      type: "stream_end",
      requestId: currentRequestId,
      error: "WAF_BLOCKED",
    });
    return;
  }

  // 🛡️ Rate limiter: đảm bảo tối thiểu 4s giữa các request
  await rateLimit();

  const maxRetries = 30;
  let retries = 0;
  let textarea = document.querySelector("textarea");
  while (!textarea && retries < maxRetries) {
    await new Promise((r) => setTimeout(r, 500));
    textarea = document.querySelector("textarea");
    retries++;
  }
  if (!textarea) return;

  textarea.focus();

  let typedSuccessfully = false;
  const wordCount = prompt.trim().split(/\s+/).length;

  // ⌨️ Phương án 0: Gõ từng ký tự (≤ 50 từ) — human-like nhất, WAF-resistant nhất
  if (wordCount <= 50) {
    try {
      // Xóa sạch trước
      document.execCommand("selectAll", false, null);
      const deleteOk = document.execCommand("delete", false, null);
      if (!deleteOk) {
        const ns = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        ).set;
        ns.call(textarea, "");
      }

      console.log(
        `[Content] ⌨️ Char-by-char mode: ${prompt.length} chars, ${wordCount} words`,
      );
      for (const char of prompt) {
        document.execCommand("insertText", false, char);
        // Delay ngẫu nhiên 8–20ms mỗi ký tự — tốc độ gõ nhanh (~3000–7500 ký tự/phút)
        await new Promise((r) => setTimeout(r, 6 + Math.random() * 10));
      }

      // Dispatch event cuối — data = ký tự cuối giống gõ thật
      textarea.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: prompt.slice(-1),
        }),
      );
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      typedSuccessfully = true;
    } catch (e) {
      console.warn(
        "[Content] ⌨️ Char-by-char failed, falling back to chunk mode:",
        e,
      );
    }
  }

  // 🚀 Phương án 1: nativeSetter cho prompt dài (> 1000 ký tự) — nhanh hơn
  if (!typedSuccessfully && prompt.length > 1000) {
    try {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      ).set;
      nativeSetter.call(textarea, prompt);
      textarea.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: prompt.slice(-1),
        }),
      );
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      typedSuccessfully = true;
    } catch (e) {}
  }

  // 📦 Phương án 2: chunk ~30 ký tự cho prompt trung bình (> 50 từ, ≤ 1000 ký tự)
  if (!typedSuccessfully) {
    textarea.focus();
    let execDeleteOk = false;
    try {
      document.execCommand("selectAll", false, null);
      execDeleteOk = document.execCommand("delete", false, null);
    } catch (e) {
      execDeleteOk = false;
    }
    if (!execDeleteOk) {
      try {
        const ns = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        ).set;
        ns.call(textarea, "");
      } catch (e) {
        textarea.value = "";
      }
    }

    try {
      const CHUNK_SIZE = 30;
      for (let i = 0; i < prompt.length; i += CHUNK_SIZE) {
        const chunk = prompt.slice(i, i + CHUNK_SIZE);
        document.execCommand("insertText", false, chunk);
        if (i + CHUNK_SIZE < prompt.length) {
          await new Promise((r) => setTimeout(r, 8 + Math.random() * 18));
        }
      }
      textarea.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: prompt.slice(-1),
        }),
      );
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      typedSuccessfully = true;
    } catch (e) {
      // Fallback cuối: native setter
      try {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        ).set;
        nativeSetter.call(textarea, prompt);
      } catch (e2) {
        textarea.value = prompt;
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // Fix WAF #1: Random delay 200–500ms (không đều đặn)
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  // Click nút Send
  const container =
    textarea.closest("form") || textarea.parentElement?.parentElement;
  const sendBtn =
    container?.querySelector('button[type="submit"]') ||
    document.getElementById("send-message-button");
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.removeAttribute("disabled");

    // 📜 Scroll button vào tầm nhìn + blur/focus sequence (human behavior)
    try {
      sendBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
      await new Promise((r) => setTimeout(r, 60 + Math.random() * 80));
      textarea.blur();
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
    } catch (e) {}

    // Fix WAF #2: Mouse event trail trước click — giống human behavior
    try {
      sendBtn.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 45));
      sendBtn.dispatchEvent(
        new MouseEvent("mouseenter", { bubbles: false, cancelable: false }),
      );
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 30));
      sendBtn.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
      sendBtn.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
      sendBtn.click();
      sendBtn.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: false, cancelable: false }),
      );
    } catch (e) {
      // Fallback nếu MouseEvent fail
      sendBtn.click();
    }
  } else {
    const form = textarea.closest("form");
    if (form)
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
  }
}
