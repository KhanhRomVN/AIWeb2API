/**
 * ------------------------------------------------------------------
 * Account Service
 * ------------------------------------------------------------------
 * Business logic cho tài khoản người dùng và background refresh service.
 * Layer trung gian giữa Controller và Repository.
 *
 * Main functions:
 * - getAccountById()                           : Lấy account theo ID
 * - getAccountByEmailAndProvider()             : Lấy account theo email và provider
 * - getAccountByIdOrEmailProvider()            : Lấy account theo ID hoặc email+provider
 * - getAccounts()                              : Lấy danh sách accounts với phân trang
 * - createAccount()                            : Thêm account mới
 * - updateAccount()                            : Cập nhật credential của account
 * - removeAccount()                            : Xóa account
 * - importAccounts()                           : Import hàng loạt accounts
 * - getProviderConfig()                        : Lấy provider config theo ID
 * - updateAccountCredentialAndLastRefresh()    : Cập nhật credential
 * - updateAccountUsageInfo()                   : Cập nhật usage và reset period
 * - refreshAccountToken()                      : Refresh token qua provider
 * - getAccountUsageFromProvider()              : Lấy usage từ provider
 * - AccountRefreshService                      : Background service tự động refresh tokens
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Repositories ──
import {
  findAccountById,
  findAccountByEmailAndProvider,
  findAccountByIdOrEmailProvider,
  listAccounts,
  insertAccount,
  insertAccountsBatch,
  updateAccountCredential,
  updateAccountCredentialAndRefresh,
  updateAccountFields,
  updateAccountUsage,
  updateAccountUserDataDir as updateAccountUserDataDirRepo,
  deleteAccount as deleteAccountRow,
  findAccountsNeedingRefresh,
} from '../repositories/account.repository';
import {
  ensureProviderExists,
  findProviderById,
} from '../repositories/provider.repository';

// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ── Types ──
import type { AccountRow } from '../repositories/account.repository';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('AccountService');

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface AccountInput {
  id?: string;
  provider_id: string;
  email: string;
  credential?: string;
  user_data_dir?: string | null;
  usage?: number | null;
  reset_usage_at?: string | null;
  auth_method?: string | null;
}

export interface ListAccountsOptions {
  page?: number;
  limit?: number;
  email?: string;
  provider_id?: string;
  sort_by?: string;
  order?: 'ASC' | 'DESC';
}

export interface ImportPreviewResult {
  accounts: Array<{
    email: string;
    provider_id: string;
    kind: 'new' | 'changed' | 'identical';
    incoming: AccountInput;
    existing: {
      id: string;
      email: string;
      provider_id: string;
      credential: string | null;
      usage: number | null;
      reset_usage_at: string | null;
    } | null;
  }>;
}

/**
 * Preview import — check từng account xem là new/changed/identical
 * mà KHÔNG insert gì vào DB. Dùng để hiển thị confirm UI.
 */
export async function previewImportAccounts(
  accounts: AccountInput[],
): Promise<ImportPreviewResult> {
  const result: ImportPreviewResult['accounts'] = [];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    try {
      const existing = await findAccountByEmailAndProvider(
        account.email,
        account.provider_id,
      );

      if (!existing) {
        result.push({
          email: account.email,
          provider_id: account.provider_id,
          kind: 'new',
          incoming: account,
          existing: null,
        });
      } else {
        const normalize = (v: string | null | undefined) => {
          if (!v) return null;
          try {
            return JSON.stringify(JSON.parse(v));
          } catch {
            return v;
          }
        };
        const credChanged =
          normalize(existing.credential) !== normalize(account.credential);

        result.push({
          email: account.email,
          provider_id: account.provider_id,
          kind: credChanged ? 'changed' : 'identical',
          incoming: account,
          existing: {
            id: existing.id,
            email: existing.email,
            provider_id: existing.provider_id,
            credential: existing.credential ?? null,
            usage: existing.usage ?? null,
            reset_usage_at: existing.reset_usage_at ?? null,
          },
        });
      }
    } catch (err: any) {
      logger.error(
        `[previewImportAccounts] FAILED at [${i + 1}/${accounts.length}] email=${account.email} provider=${account.provider_id}`,
      );
      logger.error(`[previewImportAccounts] error message: ${err?.message}`);
      logger.error(`[previewImportAccounts] error stack: ${err?.stack}`);
      throw err;
    }
  }

  return { accounts: result };
}

export interface ImportAccountsResult {
  imported: number;
  skipped: number;
  duplicates: Array<{
    email: string;
    provider_id: string;
    /** Incoming account data từ file import */
    incoming: AccountInput;
    /** Account đang tồn tại trong DB */
    existing: {
      id: string;
      email: string;
      provider_id: string;
      credential: string | null;
      usage: number | null;
      reset_usage_at: string | null;
    };
  }>;
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Lấy account theo ID
 */
export async function getAccountById(
  accountId: string,
): Promise<AccountRow | undefined> {
  return (await findAccountById(accountId)) || undefined;
}

/**
 * Lấy account theo email và provider
 */
export async function getAccountByEmailAndProvider(
  email: string,
  providerId: string,
): Promise<AccountRow | undefined> {
  return (await findAccountByEmailAndProvider(email, providerId)) || undefined;
}

/**
 * Lấy account theo ID hoặc email+provider
 */
export async function getAccountByIdOrEmailProvider(
  id: string | undefined,
  email: string,
  providerId: string,
): Promise<AccountRow | undefined> {
  if (id) {
    return (
      (await findAccountByIdOrEmailProvider(id, email, providerId)) || undefined
    );
  }
  return (await findAccountByEmailAndProvider(email, providerId)) || undefined;
}

/**
 * Lấy danh sách accounts với phân trang
 */
export function getAccounts(options: ListAccountsOptions) {
  return listAccounts({
    page: options.page || 1,
    limit: options.limit || 10,
    email: options.email,
    provider_id: options.provider_id,
    sort_by: options.sort_by || 'email',
    order: options.order || 'ASC',
  });
}

/**
 * Thêm account mới
 */
export async function createAccount(
  accountData: AccountInput,
): Promise<string> {
  const id = accountData.id || require('crypto').randomUUID();
  await insertAccount({
    id,
    provider_id: accountData.provider_id,
    email: accountData.email,
    credential: accountData.credential || null,
    user_data_dir: accountData.user_data_dir || null,
    auth_method: accountData.auth_method || null,
  });
  await ensureProviderExists(
    accountData.provider_id.toLowerCase(),
    accountData.provider_id,
  );
  return id;
}

/**
 * Cập nhật credential của account
 */
export function updateAccount(accountId: string, credential: string): void {
  updateAccountCredential(accountId, credential);
}

/**
 * Cập nhật các field có thể chỉnh sửa của account (email, credential, auth_method).
 * Trả về false nếu account không tồn tại.
 */
export async function updateAccountEditableFields(
  accountId: string,
  fields: {
    email?: string;
    credential?: string | null;
    auth_method?: string | null;
  },
): Promise<boolean> {
  const existing = await findAccountById(accountId);
  if (!existing) return false;
  await updateAccountFields(accountId, fields);
  return true;
}

export function updateAccountUserDataDir(
  accountId: string,
  userDataDir: string,
): void {
  updateAccountUserDataDirRepo(accountId, userDataDir);
}

/**
 * Xóa account
 */
export async function removeAccount(
  accountId: string,
  providerId: string,
): Promise<void> {
  await deleteAccountRow(accountId);
  await ensureProviderExists(providerId.toLowerCase(), providerId);
}

/**
 * Import hàng loạt accounts
 */
export async function importAccounts(
  accounts: AccountInput[],
): Promise<ImportAccountsResult> {
  const duplicates: ImportAccountsResult['duplicates'] = [];
  const toInsert: Array<{
    id: string;
    provider_id: string;
    email: string;
    credential: string;
  }> = [];

  for (const account of accounts) {
    const existing = await findAccountByEmailAndProvider(
      account.email,
      account.provider_id,
    );
    if (existing) {
      duplicates.push({
        email: account.email,
        provider_id: account.provider_id,
        incoming: account,
        existing: {
          id: existing.id,
          email: existing.email,
          provider_id: existing.provider_id,
          credential: existing.credential ?? null,
          usage: existing.usage ?? null,
          reset_usage_at: existing.reset_usage_at ?? null,
        },
      });
    } else {
      const id = account.id || require('crypto').randomUUID();
      toInsert.push({
        id,
        provider_id: account.provider_id,
        email: account.email,
        credential: account.credential || '',
      });
    }
  }

  if (toInsert.length > 0) {
    await insertAccountsBatch(toInsert);

    const providerIds = [...new Set(toInsert.map((a) => a.provider_id))];
    for (const pid of providerIds) {
      await ensureProviderExists(pid.toLowerCase(), pid);
    }
  }

  return {
    imported: toInsert.length,
    skipped: duplicates.length,
    duplicates,
  };
}

/**
 * Override một account đã tồn tại bằng data từ import
 * (dùng khi user confirm giữ lại account trùng lặp)
 */
export async function overrideAccount(
  existingId: string,
  incoming: AccountInput,
): Promise<void> {
  const fields: Record<string, any> = {};
  if (incoming.credential !== undefined)
    fields.credential = incoming.credential;
  if (incoming.usage !== undefined) fields.usage = incoming.usage;
  if (incoming.reset_usage_at !== undefined)
    fields.reset_usage_at = incoming.reset_usage_at;
  if (Object.keys(fields).length > 0) {
    await updateAccountFields(existingId, fields);
  }
}

/**
 * Lấy provider config theo ID
 */
export async function getProviderConfig(providerId: string) {
  return findProviderById(providerId);
}

/**
 * Cập nhật credential
 */
export function updateAccountCredentialAndLastRefresh(
  accountId: string,
  credential: string,
): void {
  updateAccountCredentialAndRefresh(accountId, credential);
}

/**
 * Cập nhật usage và reset_usage_at
 */
export function updateAccountUsageInfo(
  accountId: string,
  usage: number,
  resetUsageAt: string | null,
): void {
  updateAccountUsage(accountId, usage, resetUsageAt);
}

/**
 * Refresh token qua provider
 */
export async function refreshAccountToken(
  providerId: string,
  refreshToken: string,
): Promise<{
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresIn?: number;
  expires_in?: number;
} | null> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider?.refreshToken) {
    return null;
  }

  try {
    return await provider.refreshToken(refreshToken);
  } catch (error) {
    throw error;
  }
}

/**
 * Lấy usage từ provider
 */
export async function getAccountUsageFromProvider(
  providerId: string,
  credential: string,
): Promise<{ usage: number; resetUsageAt: string | null } | null> {
  const provider = providerRegistry.getProvider(providerId);
  if (!provider?.getUsage) {
    return null;
  }

  try {
    const result = await provider.getUsage(credential);
    return result;
  } catch (error: any) {
    throw error;
  }
}

// ─── Account Refresh Background Service ────────────────────────────────

/**
 * Account Refresh Service Class
 * Tự động refresh token và cập nhật usage cho các tài khoản
 */
export class AccountRefreshService {
  private interval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour
  private readonly AUTO_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Khởi động background service
   */
  start() {
    if (this.interval) return;
    setTimeout(() => this.checkAndRefresh(), 30000);
    this.interval = setInterval(
      () => this.checkAndRefresh(),
      this.REFRESH_INTERVAL,
    );
  }

  /**
   * Dừng background service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Kiểm tra và refresh token cho tất cả accounts
   */
  async checkAndRefresh() {
    const accounts = await findAccountsNeedingRefresh(
      this.AUTO_REFRESH_THRESHOLD,
    );
    for (const account of accounts) {
      try {
        let credential: any;
        try {
          credential = JSON.parse(account.credential || '{}');
        } catch (e) {
          credential = { accessToken: account.credential };
        }

        if (!credential) {
          continue;
        }

        const refreshToken =
          credential.refreshToken || credential.refresh_token;
        const now = Date.now();

        // Check if token needs refresh
        if (refreshToken) {
          try {
            const newTokens = await refreshAccountToken(
              account.provider_id,
              refreshToken,
            );

            if (newTokens) {
              const updatedCredential = {
                ...credential,
                accessToken:
                  newTokens.accessToken ||
                  newTokens.access_token ||
                  credential.accessToken,
                refreshToken:
                  newTokens.refreshToken ||
                  newTokens.refresh_token ||
                  refreshToken,
                expiresIn:
                  newTokens.expiresIn ||
                  newTokens.expires_in ||
                  credential.expiresIn,
              };

              updateAccountCredentialAndLastRefresh(
                account.id,
                JSON.stringify(updatedCredential),
              );
              credential = updatedCredential;
            }
          } catch (err: any) {
            logger.error(
              `Token refresh failed — ${account.email}: ${err.message}`,
            );
          }
        }

        // Refresh usage only when reset period has elapsed AND provider supports getUsage
        const provider = providerRegistry.getProvider(account.provider_id);
        if (provider?.getUsage && this.shouldRefreshUsage(account)) {
          await this.refreshUsage(account.id);
        }
      } catch (e: any) {
        logger.error(`Error processing account ${account.id}: ${e.message}`);
      }
    }
  }

  /**
   * Kiểm tra xem account có cần refresh usage dựa trên reset_usage_at không.
   * - Nếu usage là null (chưa bao giờ fetch) → cần refresh ngay.
   * - Nếu reset_usage_at là ngày trong quá khứ → cần refresh.
   * - Nếu không có reset_usage_at và đã có usage → không refresh tự động.
   */
  shouldRefreshUsage(account: AccountRow): boolean {
    // Chưa bao giờ fetch usage → fetch ngay
    if (account.usage == null) {
      return true;
    }

    const resetAt = account.reset_usage_at;
    if (!resetAt) {
      // usage đã có nhưng không có reset_usage_at → provider chưa trả về resetAt
      // (ví dụ: code cũ chạy trước khi implement resetAt) → refresh để lấy lại
      return true;
    }
    try {
      const resetDate = new Date(resetAt);
      const shouldRefresh = resetDate.getTime() <= Date.now();
      return shouldRefresh;
    } catch {
      return false;
    }
  }

  /**
   * Cập nhật usage cho một account
   */
  async refreshUsage(accountId: string) {
    const account = await getAccountById(accountId);
    if (!account) return;
    try {
      let credential: any;
      try {
        credential = JSON.parse(account.credential || '{}');
      } catch (e) {
        credential = { accessToken: account.credential };
      }

      const usageInfo = await getAccountUsageFromProvider(
        account.provider_id,
        JSON.stringify(credential),
      );

      if (usageInfo) {
        // Sanity check trước khi ghi DB
        const safeUsage =
          typeof usageInfo.usage === 'number' && isFinite(usageInfo.usage)
            ? usageInfo.usage
            : 0;
        const safeResetAt =
          typeof usageInfo.resetUsageAt === 'string' ||
          usageInfo.resetUsageAt === null
            ? usageInfo.resetUsageAt
            : null;
        updateAccountUsageInfo(account.id, safeUsage, safeResetAt);
      } else {
        logger.warn(
          `refreshUsage: getUsage returned null/undefined — account=${accountId} provider=${account.provider_id}`,
        );
      }
    } catch (err: any) {
      logger.warn(`Usage fetch failed — ${account.email}: ${err.message}`);
    }
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────
export const accountRefreshService = new AccountRefreshService();
