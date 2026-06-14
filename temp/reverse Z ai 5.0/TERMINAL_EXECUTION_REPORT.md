# Báo cáo Phân tích Toàn bộ Vấn đề — Terminal Execution

> **Ngày phân tích:** 2025-01  
> **Project:** Zen — AI Coding Assistant VS Code Extension  
> **Phạm vi:** Toàn bộ hệ thống Terminal Execution (backend + frontend + agent)  
> **Tổng số vấn đề phát hiện:** 18 (2 Critical, 6 High, 7 Medium, 3 Low)

---

## Mục lục

1. [Kiến trúc Tổng quan](#1-kiến-trúc-tổng-quan)
2. [Vấn đề Critical](#2-vấn-đề-critical)
3. [Vấn đề High](#3-vấn-đề-high)
4. [Vấn đề Medium](#4-vấn-đề-medium)
5. [Vấn đề Low](#5-vấn-đề-low)
6. [Bảng Tổng hợp Mức độ Nghiêm trọng](#6-bảng-tổng-hợp-mức-độ-nghiêm-trọng)
7. [Khuyến nghị Ưu tiên Fix](#7-khuyến-nghị-ưu-tiên-fix)

---

## 1. Kiến trúc Tổng quan

### 1.1 Data Flow Diagram

```
AI Response (run_command)
  → useToolExecution.executeSingleAction()
    → extensionService.postMessage("runCommand")
      → TerminalHandler.handleRunCommand()
        → SecurityValidator.validateCommand()
        → ProcessManager.startInteractive()
          → BridgeClient.send("create") ←→ TerminalBridge (node-pty)
        → ProcessManager.sendInput(command, actionId)
          → Wraps với ZEN_CMD_START/END markers
          → BridgeClient.send("input")
            → PTY executes → output stream back
              → BridgeClient.handleMessage("output")
                → processOutputLine() → marker detection
                → ZenPTY.writeEmitter → VS Code Terminal
                → onDidWriteData → ZenChatViewProvider → webview "terminalOutput"
              → BridgeClient.handleMessage("status")
                → onTerminalStatusChanged → webview "terminalStatusChanged"
              → End marker detected → _triggerCommandFinished()
                → onCommandFinished → ZenChatViewProvider → webview "commandExecuted"
                  → useToolExecution resolves Promise
                    → stripMarkers + stripAnsi → result string gửi lại AI
```

### 1.2 Kiến trúc 4 lớp

```
┌─────────────────────────────────────────────────────┐
│                   UI Layer (Webview)                │
│    TerminalBlock.tsx / MiniTerminal.tsx (xterm.js)  │
│    TerminalToolItem.tsx / useToolExecution.ts        │
├─────────────────────────────────────────────────────┤
│              Controller Layer (Routing)              │
│  ChatController → TerminalHandler / AgentHandler     │
├─────────────────────────────────────────────────────┤
│               Agent Layer (Security)                 │
│  AgentCapabilityManager → PermissionValidator        │
│                          → SecurityValidator          │
│                          → CommandExecutor            │
├─────────────────────────────────────────────────────┤
│            Process Layer (PTY Management)            │
│  ProcessManager → BridgeClient ←→ TerminalBridge     │
│                  (Unix Socket IPC)                    │
│                       ↓                              │
│                   node-pty                            │
└─────────────────────────────────────────────────────┘
```

### 1.3 Danh sách Files liên quan

| File | Dòng | Vai trò |
|------|------|---------|
| `src/managers/TerminalBridge.ts` | 298 | PTY Bridge Server (độc lập process) |
| `src/managers/ProcessManager.ts` | 862 | Terminal lifecycle, ZenPTY, BridgeClient |
| `src/utils/terminalUtils.ts` | 167 | EchoSuppressor, stripAnsi, stripMarkers (backend) |
| `src/agent/capabilities/CommandExecutor.ts` | 49 | Agent command execution (child_process.exec) |
| `src/agent/AgentCapabilityManager.ts` | 79 | Capability dispatcher + permission check |
| `src/agent/validators/PermissionValidator.ts` | 173 | User permission validation |
| `src/agent/validators/SecurityValidator.ts` | 120 | Hard security validation |
| `src/controllers/handlers/TerminalHandler.ts` | 96 | Webview message handler cho terminal |
| `src/controllers/handlers/AgentHandler.ts` | 35 | Agent action handler |
| `src/controllers/ChatController.ts` | 307 | Central message router |
| `src/providers/ZenChatViewProvider.ts` | 237 | Event forwarding → webview |
| `src/controllers/handlers/ConversationHandler.ts` | 582 | Save/read terminal output |
| `src/webview-ui/src/utils/terminalUtils.ts` | ~80 | stripAnsi, stripMarkers (frontend) |
| `src/webview-ui/src/components/TerminalBlock.tsx` | ~230 | xterm.js terminal display |
| `src/webview-ui/src/components/ChatPanel/ChatFooter/components/MiniTerminal.tsx` | ~95 | Mini terminal trong chat footer |
| `src/webview-ui/src/components/ChatPanel/ChatBody/components/ToolActions/TerminalToolItem.tsx` | ~140 | Terminal tool action UI |
| `src/webview-ui/src/hooks/useToolExecution.ts` | ~350 | Frontend tool execution hook |

---

## 2. Vấn đề Critical

### 🔴 BUG-01: Hai Execution Path không thống nhất

**Mô tả:**  
Hệ thống có 2 đường dẫn thực thi lệnh hoàn toàn riêng biệt, không chia sẻ logic:

| | Agent Path | Interactive Path |
|---|---|---|
| **Entry** | `AgentHandler → AgentCapabilityManager → CommandExecutor` | `TerminalHandler → ProcessManager → BridgeClient → TerminalBridge → node-pty` |
| **Executor** | `child_process.exec()` | `node-pty` (PTY) |
| **Output** | stdout/stderr string đồng bộ | Stream real-time qua Unix Socket |
| **Security** | `SecurityValidator` + `PermissionValidator` (2 tầng) | Chỉ `SecurityValidator` (1 tầng) |
| **Timeout** | 30 giây cứng | Không có timeout |
| **Interactive** | Không | Có (persistent terminal) |
| **Marker tracking** | Không | Có (ZEN_CMD_START/END) |

**Code chứng minh:**

```typescript
// CommandExecutor.ts — Agent path: exec() đơn giản
async execute(action: AgentAction): Promise<AgentExecutionResult> {
  const { stdout, stderr } = await execAsync(action.command, {
    cwd: this.workspaceRoot,
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 10,
  });
}

// ProcessManager.ts — Interactive path: PTY phức tạp
async startInteractive(cwd, terminalId?, overrideShellPath?) {
  const ptyInternal = new ZenPTY(cwd, logFilePath, id);
  this.bridgeClient.send({ type: "create", id, shell, args, cwd, ... });
}
```

**Hệ quả:**
- `CommandExecutor` không có echo suppression, marker tracking, hay output streaming
- Lệnh chạy qua `CommandExecutor` không hiển thị trong UI terminal
- Security validation không nhất quán
- Không thể track/lifecycle-manage lệnh chạy qua Agent path
- Duplicate logic → gấp đôi công việc maintain

---

### 🔴 BUG-02: Security Bypass trong Interactive Path

**Mô tả:**  
`TerminalHandler.handleRunCommand()` chỉ gọi `SecurityValidator.validateCommand()`, bỏ qua hoàn toàn `PermissionValidator`:

```typescript
// TerminalHandler.ts
public async handleRunCommand(message: any, webviewView: vscode.WebviewView) {
  // Chỉ 1 tầng security check!
  const securityCheck = SecurityValidator.validateCommand(message.commandText);
  if (!securityCheck.safe) {
    throw new Error(securityCheck.reason || "Command validation failed");
  }
  // ❌ KHÔNG kiểm tra AgentPermissions (executeSafeCommand, executeAllCommands)
  // ❌ KHÔNG kiểm tra permission mode (bypassPermissions, auto, plan...)
}
```

Trong khi đó, `CommandExecutor` (Agent path) đi qua đủ 2 tầng:

```typescript
// AgentCapabilityManager.ts
public async executeAction(action: AgentAction): Promise<AgentExecutionResult> {
  const validation = this.validator.validate(action); // PermissionValidator → SecurityValidator
  if (!validation.allowed) {
    return { success: false, error: validation.reason || "Permission denied" };
  }
}
```

**Hệ quả:**  
User có thể set `permissionMode = "plan"` (chỉ cho phép đọc), nhưng `run_command` vẫn thực thi bất kỳ lệnh nào qua interactive path. Đây là lỗ hổng security nghiêm trọng.

---

## 3. Vấn đề High

### 🟠 BUG-03: Status Monitoring chỉ hoạt động trên Linux

**Mô tả:**  
`checkBusy()` và `getCwd()` trong `TerminalBridge.ts` chỉ đọc `/proc/` — hoàn toàn không hoạt động trên Windows và macOS:

```typescript
// TerminalBridge.ts
function getCwd(pid: number): string {
  try {
    if (os.platform() === "linux") {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    }
  } catch (e) {}
  return ""; // ❌ Trả về rỗng trên Windows/macOS
}

function checkBusy(pid: number): boolean {
  try {
    if (os.platform() === "linux") {
      // ... parse /proc/[pid]/stat
      return isBusy;
    }
  } catch (e) {}
  return false; // ❌ Luôn trả về false trên Windows/macOS
}
```

**Hệ quả:**
- Trên Windows: Terminal luôn hiển thị `status: "free"` kể cả khi đang chạy lệnh
- `ProcessManager.list()` luôn trả `state: "free"` → UI sai trạng thái
- `onTerminalStatusChanged` không bao giờ fire → tool output không được finalize đúng cách
- Tên terminal không cập nhật (luôn hiển thị shell name thay vì command đang chạy)

---

### 🟠 BUG-04: Marker Wrapping không hỗ trợ đúng Windows

**Mô tả:**  
Trong `ProcessManager.sendInput()`, marker wrapping cho Windows có nhiều vấn đề:

```typescript
// ProcessManager.ts — sendInput()
if (isWindows && !isPwsh) {
  // cmd.exe
  finalInput = `echo ZEN_CMD_START: ${actionId} & ${cleanCmd} & echo ZEN_CMD_END: ${actionId}\r\n`;
} else if (isPwsh) {
  // PowerShell
  finalInput = `Write-Output "ZEN_CMD_START: ${actionId}"; ${cleanCmd}; Write-Output "ZEN_CMD_END: ${actionId}"\r\n`;
} else {
  // bash / zsh
  finalInput = `stty -echo; echo "ZEN_CMD_START: ${actionId}"; ${cleanCmd}; echo "ZEN_CMD_END: ${actionId}"; stty echo\n`;
}
```

**Các vấn đề cụ thể:**

1. **cmd.exe dùng `&` thay `&&`**: `&` chạy lệnh tiếp theo kể cả khi lệnh trước thất bại → `ZEN_CMD_END` luôn được in. Nhưng nếu đổi sang `&&`, END marker sẽ không được in khi command fail → command không bao giờ được finalize.

2. **PowerShell `Write-Output`**: Ghi vào stdout pipeline, không phải trực tiếp console. Nếu command thay đổi output encoding hoặc redirect, marker có thể bị nuốt.

3. **Không có `stty -echo` cho Windows**: Trên bash/zsh, `stty -echo` suppress echo. Trên Windows, echo suppression hoàn toàn dựa vào `EchoSuppressor` — nhưng logic echo trên cmd/powershell khác bash, dẫn đến output không sạch.

4. **Shell detection sai**: `isPwsh` kiểm tra `shellPath.includes("pwsh") || shellPath.includes("powershell")`, nhưng `overrideShellPath` có thể là Git Bash, WSL, Cygwin — tất cả đều rơi vào nhánh `else` (bash/zsh) và dùng `stty` → crash trên Windows.

---

### 🟠 BUG-05: Race Condition — startInteractive → sendInput

**Mô tả:**  
Giữa `startInteractive()` và `sendInput()` có race condition:

```typescript
// TerminalHandler.ts
public async handleRunCommand(message: any, webviewView: vscode.WebviewView) {
  const result = await this.processManager.startInteractive(cwd);
  const terminalId = result.id;

  // ✅ Trả terminalId cho webview ngay
  webviewView.webview.postMessage({
    command: "runCommandResult",
    requestId: message.requestId,
    terminalId,
    actionId: message.actionId,
  });

  // ⚠️ Gửi input NGAY LẬP TỨC — PTY có thể chưa sẵn sàng!
  this.processManager.sendInput(terminalId, `${message.commandText}\n`, message.actionId);
}
```

`startInteractive()` gửi message `create` qua socket và return ngay — không đợi PTY thực sự khởi động. Dù `BridgeClient` có message queue, input đến khi shell chưa init hoàn toàn → marker `stty -echo` chạy không đúng thời điểm → echo không bị suppress → output bẩn.

---

### 🟠 BUG-06: Race Condition — onCommandFinished fire trước webview ready

**Mô tả:**  
`onCommandFinished` listener được đăng ký trong `resolveWebviewView()`:

```typescript
// ZenChatViewProvider.ts
this._processManager.onCommandFinished((event) => {
  webviewView.webview.postMessage({
    command: "commandExecuted",
    actionId: event.actionId,
    output: event.output,
    terminalId: event.terminalId,
    commandText: event.commandText,
  });
});
```

Nếu lệnh chạy rất nhanh (ví dụ `echo hello`), `onCommandFinished` có thể fire trước khi webview JavaScript kịp đăng ký `window.addEventListener("message", ...)`. Output bị mất vĩnh viễn → Promise trong `useToolExecution` không bao giờ resolve → AI không nhận được kết quả.

---

### 🟠 BUG-07: Memory Leak — Terminal instances không được tự động dọn

**Mô tả:**  
Khi user đóng VS Code terminal panel, `ZenPTY.attachedToVSCode = false` nhưng terminal vẫn tồn tại trong `terminalMap`:

```typescript
// ProcessManager.ts
vscode.window.onDidCloseTerminal((terminal) => {
  for (const [id, entry] of this.terminalMap.entries()) {
    if (entry.terminal === terminal) {
      entry.pty.attachedToVSCode = false;
      entry.terminal = null as any; // ❌ Set null nhưng KHÔNG xóa khỏi map!
      break;
    }
  }
});
```

Đặc biệt, `TerminalHandler.handleRunCommand()` LUÔN tạo terminal mới — không bao giờ tái sử dụng:

```typescript
const result = await this.processManager.startInteractive(cwd);
// ❌ Không bao giờ truyền terminalId → luôn tạo mới
```

**Hệ quả:**
- Mỗi lệnh = 1 terminal mới, terminal cũ không bao giờ bị xóa khỏi `terminalMap`
- `BridgeClient.ptyMap` cũng accumulate
- Log files accumulate trong `projectDir/terminals/`
- Chỉ `close()` mới dọn dẹp, nhưng không có cơ chế tự động gọi

---

### 🟠 BUG-08: Output Capture không đáng tin cậy

**BUG-08a: Marker bị ANSI穿插 phá hỏng**

`stripMarkers()` trong `terminalUtils.ts` (backend) sử dụng regex cực kỳ phức tạp:

```typescript
const ansi = "\\x1b\\[[0-9;?]*[A-Za-z~]|\\x1b\\].*?(?:\\x07|\\x1b\\\\)";
const messy = `(?:${ansi}|\\r(?!\\n)|[\\x00-\\x09\\x0B-\\x0C\\x0E-\\x1F\\x7F]| )*`;
const markerBody = (m: string) => `${messy}${esc(m)}${messy}`;
```

Regex này có thể:
- **False negative**: ANSI sequence không match pattern → marker không bị strip → hiển thị trong output
- **False positive**: Nội dung bình thường bị nhầm là marker → bị xóa
- **Catastrophic backtracking**: Nested quantifiers `(?:...| )*` với overlapping alternatives

**BUG-08b: EchoSuppressor có thể bỏ lỡ**

`EchoSuppressor` chỉ check queue[0] và queue[1]:

```typescript
public process(data: string): string {
  while (this.queue.length > 0) {
    const current = this.queue[0];
    const match = this.findMatchWithAnsi(result, current.wrapped);
    if (match) { this.queue.shift(); continue; }
    if (this.queue.length > 1) {
      const next = this.queue[1];
      // Chỉ thử skip 1 item!
    }
    break; // ❌ Nếu queue[0] và [1] đều không match → DỪNG
  }
}
```

Nếu echo bị split thành 3+ chunks, chỉ check 2 đầu queue → echo không bị suppress.

**BUG-08c: lineBuffer processing có thể split marker**

```typescript
if (pty.lineBuffer.length > 0 &&
    !pty.lineBuffer.includes("ZEN_CMD_START") &&
    !pty.lineBuffer.includes("ZEN_CMD_END")) {
  this.processOutputLine(id, pty, pty.lineBuffer);
  pty.lineBuffer = "";
}
```

Nếu `ZEN_CMD_START` bị split giữa 2 TCP packets (ví dụ `ZEN_CMD_STA` + `RT: uuid`), check `includes()` sẽ không phát hiện → flush sớm → marker không được xử lý đúng.

---

## 4. Vấn đề Medium

### 🟡 BUG-09: TerminalBridge Auto-Shutdown có thể giết terminals đang chạy

```typescript
// TerminalBridge.ts
const idleShutdownTimer = setTimeout(() => {
  if (clientCount === 0) process.exit(0);
}, 30_000);

server.on("connection", (sock) => {
  sock.on("close", () => {
    clientCount--;
    if (clientCount <= 0 && terminals.size === 0) {
      setTimeout(() => process.exit(0), 5000);
    }
  });
});
```

**Kịch bản lỗi:**
1. Extension reload (development) → clientCount = 0
2. Nếu tất cả terminals complete tự nhiên trong vòng 5s → `terminals.size === 0` → process exit
3. Extension reconnect → TerminalBridge đã chết → mất tất cả terminals
4. Nếu VS Code crash hoặc computer sleep → tương tự

---

### 🟡 BUG-10: ProcessManager.stop() phá hủy terminal thay vì chỉ dừng lệnh

```typescript
// ProcessManager.ts
public stop(id: string) {
  const entry = this.terminalMap.get(id);
  if (entry) {
    entry.pty.stop(); // Gửi "close" đến bridge → kill PTY
    if (entry.pty.activeActionId) {
      (entry.pty as any)._triggerCommandFinished(finalOutput);
    } else {
      this.close(id); // ❌ XÓA terminal khỏi map, delete log file!
    }
  }
}
```

Trong `TerminalToolItem.tsx`, nút "Finalize" gọi cả `stopCommand` LẪN `stopTerminal`:

```typescript
extensionService.postMessage({ command: "stopCommand", actionId, terminalId });
if (terminalId) extensionService.postMessage({ command: "stopTerminal", terminalId });
```

→ Terminal bị kill và xóa hoàn toàn — không thể tái sử dụng.

---

### 🟡 BUG-11: _triggerCommandFinished là hack

```typescript
// ProcessManager.ts — trong startInteractive()
(ptyInternal as any)._triggerCommandFinished = (output: string) => {
  this.onCommandFinishedEmitter.fire({
    actionId: actionId!,
    output: output,
    terminalId: terminalId,
    commandText: ptyInternal.lastCommandText || undefined,
  });
};
```

Vấn đề:
- Monkey-patch bypass TypeScript type system
- Closure capture `id` — fragile
- Không type-safe — dễ break khi refactor
- Comment trong code: *"This is a hacky way to get back to ProcessManager. In a cleaner design, we'd use events."*

**Khuyến nghị:** Sử dụng event emitter pattern chuẩn trên `ZenPTY` class.

---

### 🟡 BUG-12: Duplicate stripAnsi/stripMarkers (Backend vs Frontend)

| File | stripAnsi | stripMarkers |
|------|-----------|--------------|
| `src/utils/terminalUtils.ts` (backend) | Regex đơn giản | Regex phức tạp |
| `src/webview-ui/src/utils/terminalUtils.ts` (frontend) | Regex khác, xử lý `\r` overwrite | Copy-paste từ backend |

**Vấn đề:**
- `stripAnsi` backend không xử lý `\r` overwrite, frontend thì có → kết quả khác nhau
- Bất kỳ bug fix nào cũng phải apply 2 lần
- Nếu 2 version diverge thêm, output sẽ không nhất quán

---

### 🟡 BUG-13: CommandExecutor Timeout hard-coded 30s

```typescript
// CommandExecutor.ts
const { stdout, stderr } = await execAsync(action.command, {
  timeout: 30000, // ❌ Hard-coded
  maxBuffer: 1024 * 1024 * 10,
});
```

Lệnh như `npm install`, `docker build`, `cargo build` có thể chạy hàng chục phút. Timeout 30s sẽ kill chúng. Không có cách nào configure hoặc override.

---

### 🟡 BUG-14: Socket Path cố định → Conflict giữa nhiều VS Code instances

```typescript
const SOCKET_PATH = path.join(os.homedir(), "khanhromvn-zen", "bridge.sock");
```

Chỉ có 1 socket path toàn hệ thống. Nếu user mở 2 VS Code windows cùng extension:
- Cả 2 kết nối đến cùng TerminalBridge
- Terminal từ window A xuất hiện trong window B
- `BridgeClient.ptyMap` chỉ chứa PTY của window hiện tại → output từ window khác bị mất

---

### 🟡 BUG-15: Agent Permissions mặc định tất cả false

```typescript
// ZenChatViewProvider.ts
const defaultPermissions: AgentPermissions = {
  readProjectFile: false,
  readAllFile: false,
  editProjectFiles: false,
  editAddFile: false,
  executeSafeCommand: false,
  executeAllCommands: false,
};
```

Tất cả permissions mặc định `false` → Agent path (CommandExecutor) không thể thực thi bất kỳ lệnh nào. Nhưng Interactive path (ProcessManager) bypass hoàn toàn permissions → mâu thuẫn: Agent bị chặn nhưng terminal thì không.

---

## 5. Vấn đề Low

### 🟢 BUG-16: handleRunCommand luôn tạo terminal mới

```typescript
// TerminalHandler.ts
const result = await this.processManager.startInteractive(cwd);
// ❌ Không bao giờ truyền terminalId → mỗi lệnh = 1 terminal mới
```

AI gửi 3 lệnh → tạo 3 terminals riêng biệt. Không có cách reuse terminal cho các lệnh liên tiếp. Lãng phí resource.

---

### 🟢 BUG-17: TerminalBlock xterm.js instance leak

```typescript
// TerminalBlock.tsx
useEffect(() => {
  if (!xtermRef.current) {
    const term = new Terminal({ ... });
    return () => {
      term.dispose();
      xtermRef.current = null;
    };
  }
}, [isXtermVisible]); // ❌ Re-create khi isXtermVisible thay đổi
```

Khi `status` chuyển từ `busy` → `free`, `isXtermVisible` có thể toggle → xterm bị dispose và re-create → mất scroll position, flickering.

---

### 🟢 BUG-18: ZenPTY.handleInput tracking không chính xác

```typescript
// ZenPTY.handleInput()
if (!this.activeActionId) {
  for (const char of cleanData) {
    if (char === "\r" || char === "\n") {
      this.currentInputBuffer = "";
    } else if (char === "\x7f" || char === "\b") {
      this.currentInputBuffer = this.currentInputBuffer.slice(0, -1);
    } else if (char.charCodeAt(0) >= 32) {
      this.currentInputBuffer += char;
    }
  }
}
```

Không xử lý:
- Arrow keys / navigation (thay đổi cursor position)
- Ctrl+U (xóa cả dòng)
- Ctrl+W (xóa word)
- Tab completion
- Bracketed paste (dán multi-line)

→ `currentInputBuffer` và `lastCommandText` thường không khớp với lệnh thực tế.

---

### 🟢 BUG-19: Log files không dọn khi TerminalBridge crash

Nếu TerminalBridge process crash (SIGKILL, OOM), log files trong `projectDir/terminals/*.log` không được dọn. `ProcessManager.close()` mới xóa log, nhưng nếu bridge crash, `close()` không bao giờ được gọi → log files accumulate vĩnh viễn.

---

## 6. Bảng Tổng hợp Mức độ Nghiêm trọng

| # | Mã | Vấn đề | Mức độ | File chính |
|---|-----|--------|--------|------------|
| 1 | BUG-01 | Hai execution path không thống nhất | 🔴 CRITICAL | CommandExecutor.ts, ProcessManager.ts |
| 2 | BUG-02 | Security bypass trong Interactive path | 🔴 CRITICAL | TerminalHandler.ts |
| 3 | BUG-03 | Status monitoring chỉ hoạt động trên Linux | 🟠 HIGH | TerminalBridge.ts |
| 4 | BUG-04 | Marker wrapping không hỗ trợ đúng Windows | 🟠 HIGH | ProcessManager.ts |
| 5 | BUG-05 | Race condition: startInteractive → sendInput | 🟠 HIGH | TerminalHandler.ts, ProcessManager.ts |
| 6 | BUG-06 | Race condition: onCommandFinished trước webview ready | 🟠 HIGH | ZenChatViewProvider.ts |
| 7 | BUG-07 | Memory leak: Terminal instances không được dọn | 🟠 HIGH | ProcessManager.ts |
| 8 | BUG-08 | Output capture không đáng tin cậy (3 sub-issues) | 🟠 HIGH | terminalUtils.ts, ProcessManager.ts |
| 9 | BUG-09 | TerminalBridge auto-shutdown giết terminals | 🟡 MEDIUM | TerminalBridge.ts |
| 10 | BUG-10 | stop() phá hủy terminal thay vì dừng lệnh | 🟡 MEDIUM | ProcessManager.ts, TerminalToolItem.tsx |
| 11 | BUG-11 | _triggerCommandFinished là hack | 🟡 MEDIUM | ProcessManager.ts |
| 12 | BUG-12 | Duplicate stripAnsi/stripMarkers | 🟡 MEDIUM | terminalUtils.ts (x2) |
| 13 | BUG-13 | CommandExecutor timeout hard-coded | 🟡 MEDIUM | CommandExecutor.ts |
| 14 | BUG-14 | Socket path cố định → multi-instance conflict | 🟡 MEDIUM | TerminalBridge.ts, ProcessManager.ts |
| 15 | BUG-15 | Agent permissions mặc định false nhưng terminal bypass | 🟡 MEDIUM | ZenChatViewProvider.ts, TerminalHandler.ts |
| 16 | BUG-16 | Mỗi runCommand tạo terminal mới | 🟢 LOW | TerminalHandler.ts |
| 17 | BUG-17 | TerminalBlock xterm.js instance leak | 🟢 LOW | TerminalBlock.tsx |
| 18 | BUG-18 | handleInput tracking không chính xác | 🟢 LOW | ProcessManager.ts |
| 19 | BUG-19 | Log files không dọn khi bridge crash | 🟢 LOW | TerminalBridge.ts |

---

## 7. Khuyến nghị Ưu tiên Fix

### Phase 1 — Critical Security & Architecture (1-2 tuần)

1. **BUG-02**: Thêm `PermissionValidator` vào `TerminalHandler.handleRunCommand()` — kiểm tra `permissionMode` từ settings trước khi thực thi lệnh
2. **BUG-01**: Unify hai execution path — cho phép `CommandExecutor` sử dụng `ProcessManager` thay vì `child_process.exec()`, hoặc ngược lại inject marker tracking vào Agent path

### Phase 2 — Cross-Platform & Reliability (1-2 tuần)

3. **BUG-03**: Implement `checkBusy()`/`getCwd()` cho Windows (sử dụng `wmic` hoặc `powershell` queries) và macOS (sử dụng `lsof`)
4. **BUG-04**: Thêm hỗ trợ Git Bash/WSL shell detection; test marker wrapping trên cmd.exe, PowerShell, Git Bash
5. **BUG-06**: Thêm message queue/buffer trong `ZenChatViewProvider` cho `commandExecuted` events, flush khi webview ready
6. **BUG-07**: Implement auto-cleanup cho orphaned terminals (LRU hoặc max count), reuse terminals cho consecutive commands

### Phase 3 — Output Quality & Stability (1 tuần)

7. **BUG-08**: Rewrite `stripMarkers()` với parser-based approach thay vì regex; tăng `EchoSuppressor` queue depth; thêm marker reassembly logic cho split packets
8. **BUG-05**: Thêm `await` hoặc ready signal từ PTY trước khi gửi input
9. **BUG-10**: Tách `stop()` thành `stopCommand()` (chỉ dừng lệnh hiện tại) và `killTerminal()` (phá hủy terminal)
10. **BUG-11**: Refactor `_triggerCommandFinished` thành proper event pattern trên `ZenPTY`

### Phase 4 — Minor Improvements (1 tuần)

11. **BUG-12**: Extract shared `terminalUtils` thành package riêng, import ở cả backend và frontend
12. **BUG-13**: Make CommandExecutor timeout configurable qua settings
13. **BUG-14**: Thêm workspace hash vào socket path để hỗ trợ multi-instance
14. **BUG-15**: Sync default permissions với permission mode settings
15. Các BUG-16 đến BUG-19

---

> **Kết luận:** Hệ thống Terminal Execution có kiến trúc khá tham vọng với PTY bridge tách biệt và marker-based output capture, nhưng hiện tại có nhiều vấn đề nghiêm trọng về security consistency, cross-platform compatibility, và reliability. Ưu tiên hàng đầu là fix security bypass (BUG-02) và thống nhất hai execution path (BUG-01).