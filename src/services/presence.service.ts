/**
 * ------------------------------------------------------------------
 * Presence Service
 * ------------------------------------------------------------------
 * Theo dõi cửa sổ VSCode (client) nào đang active một account, lưu
 * trong bộ nhớ. Mục đích: cảnh báo trong UI rằng account đang được
 * dùng bởi cửa sổ khác.
 *
 * Cơ chế: mỗi webview sinh 1 clientId ổn định, gọi heartbeat định kỳ
 * khi account là currentAccount. Bản ghi được coi là "active" nếu
 * lastSeen trong vòng PRESENCE_TTL_MS.
 *
 * Main functions:
 * - heartbeatPresence() : Đăng ký/refresh 1 client đang dùng account
 * - releasePresence()   : Xoá đăng ký khi client đổi account hoặc đóng
 * - countOtherWindows() : Đếm số client khác đang dùng account
 * ------------------------------------------------------------------
 */

// ─── Constants ──────────────────────────────────────────────────────────

/** Bản ghi presence hết hạn nếu không có heartbeat trong 45s. */
const PRESENCE_TTL_MS = 45 * 1000;

// ─── State ──────────────────────────────────────────────────────────────

/** accountId → (clientId → lastSeenMs) */
const presence = new Map<string, Map<string, number>>();

// ─── Internal helpers ───────────────────────────────────────────────────

const pruneAccount = (accountId: string, now: number): void => {
  const clients = presence.get(accountId);
  if (!clients) return;
  for (const [clientId, lastSeen] of clients.entries()) {
    if (now - lastSeen > PRESENCE_TTL_MS) clients.delete(clientId);
  }
  if (clients.size === 0) presence.delete(accountId);
};

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Đăng ký/refresh rằng `clientId` đang active `accountId`.
 * Trả về số cửa sổ KHÁC (không tính clientId này) cũng đang active account đó.
 */
export const heartbeatPresence = (
  accountId: string,
  clientId: string,
): number => {
  const now = Date.now();
  pruneAccount(accountId, now);

  let clients = presence.get(accountId);
  if (!clients) {
    clients = new Map();
    presence.set(accountId, clients);
  }
  clients.set(clientId, now);

  let others = 0;
  for (const id of clients.keys()) {
    if (id !== clientId) others++;
  }
  return others;
};

/**
 * Xoá đăng ký của `clientId` khỏi `accountId` (khi đổi account hoặc webview đóng).
 */
export const releasePresence = (accountId: string, clientId: string): void => {
  const clients = presence.get(accountId);
  if (!clients) return;
  clients.delete(clientId);
  if (clients.size === 0) presence.delete(accountId);
};

/**
 * Đếm số clientId KHÁC `selfClientId` đang active `accountId`.
 */
export const countOtherWindows = (
  accountId: string,
  selfClientId: string | null | undefined,
): number => {
  const now = Date.now();
  pruneAccount(accountId, now);
  const clients = presence.get(accountId);
  if (!clients) return 0;
  let others = 0;
  for (const id of clients.keys()) {
    if (id !== selfClientId) others++;
  }
  return others;
};