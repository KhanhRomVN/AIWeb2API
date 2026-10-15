/**
 * ------------------------------------------------------------------
 * Cooldown Service
 * ------------------------------------------------------------------
 * Quản lý thời gian chờ bắt buộc giữa các request gửi lên Upstream AI.
 * Sử dụng Dynamic Import để nạp registry constants tập trung từ 
 * ../provider/constants.ts, đảm bảo tính đóng gói và dễ bảo trì.
 * ------------------------------------------------------------------
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('CooldownService');

// Map lưu trữ timestamp (ms) của lần request gần nhất cho mỗi key.
const lastRequestTimestamps = new Map<string, number>();

type ProviderConstantsMap = Record<string, number>;

/** Cache kết quả import động của module constants */
let constantsPromise: Promise<ProviderConstantsMap> | null = null;

async function getConstantsRegistry(): Promise<ProviderConstantsMap> {
  if (!constantsPromise) {
    // Dynamic import file constants tập trung (cần .js cho node16/nodenext resolution)
    constantsPromise = import('../provider/constants.js')
      .then(mod => mod.PROVIDER_CONSTANTS as unknown as ProviderConstantsMap)
      .catch((err) => {
        logger.error('[Cooldown] Failed to load provider constants:', err);
        return {} as ProviderConstantsMap; // Fallback empty object
      });
  }
  return constantsPromise;
}

async function getCooldownMs(providerId: string): Promise<number> {
  const registry = await getConstantsRegistry();
  const value = registry[providerId];
  
  if (value === undefined || value <= 0) {
    logger.debug(`[Cooldown] No valid constant found for provider: ${providerId}`);
    return 0;
  }
  
  return value;
}

/**
 * Chờ cho đến khi đủ thời gian cooldown kể từ lần request trước đó.
 * 
 * @param key - Khóa duy nhất để track cooldown (ví dụ: accountId).
 * @param providerId - ID của provider để tra cứu cấu hình cooldown.
 */
export async function waitForProviderCooldown(
  key: string,
  providerId: string,
): Promise<void> {
  const cooldownMs = await getCooldownMs(providerId);

  // Nếu provider chưa được đăng ký hoặc cooldown <= 0 -> Bỏ qua
  if (!cooldownMs || cooldownMs <= 0) {
    return;
  }

  const now = Date.now();
  const lastTime = lastRequestTimestamps.get(key) || 0;
  const elapsed = now - lastTime;

  if (elapsed < cooldownMs) {
    const waitTime = cooldownMs - elapsed;
    logger.debug(`[Cooldown] Waiting ${waitTime}ms for key=${key}`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  // Cập nhật lại thời điểm request hiện tại vừa bắt đầu/chờ xong
  lastRequestTimestamps.set(key, Date.now());
}

