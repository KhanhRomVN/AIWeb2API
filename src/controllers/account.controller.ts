/**
 * ------------------------------------------------------------------
 * Account Controller
 * ------------------------------------------------------------------
 * Xử lý các request liên quan đến tài khoản: import, thêm mới, xóa,
 * cập nhật trạng thái memory, đăng nhập qua browser,
 * và quản lý browser instance cho tài khoản.
 *
 * Main functions:
 * - importAccounts()           : Import danh sách tài khoản từ file/bulk
 * - addAccount()               : Thêm một tài khoản mới hoặc cập nhật credential
 * - updateAccountHandler()     : Cập nhật email/credential của tài khoản theo id
 * - getAccounts()              : Lấy danh sách tài khoản với phân trang và filter
 * - deleteAccount()            : Xóa tài khoản theo id
 * - getAccountBrowserStatus()  : Kiểm tra trạng thái browser của tài khoản
 * - startAccountBrowser()      : Khởi động browser cho tài khoản
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';
import * as path from 'path';

// ── Services ──
import {
  getBrowserStatus,
  startBrowserForAccount,
} from '../services/browser-instance-manager';
import {
  getAccountById,
  getAccountByIdOrEmailProvider,
  getAccounts as getAccountsService,
  createAccount,
  updateAccount,
  updateAccountEditableFields,
  updateAccountUserDataDir,
  removeAccount,
  importAccounts as importAccountsService,
  previewImportAccounts as previewImportAccountsService,
  overrideAccount as overrideAccountService,
  getProviderConfig,
  accountRefreshService,
  type AccountInput,
} from '../services/account.service';
import { updateAccountCredential } from '../repositories/account.repository';
import { providerRegistry } from '../provider/registry';
import { invalidateProviderCache } from '../services/provider.service';
import { queryAccountStatsByPeriod } from '../repositories/metrics.repository';
import {
  heartbeatPresence,
  releasePresence,
  countOtherWindows,
} from '../services/presence.service';
import { computeLiveUsageFields } from '../middleware/request-limit.middleware';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('AccountController');

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Merge refreshResult vào credential JSON hiện tại của account.
 * Giữ nguyên các field cũ (clientId, region, authMethod...) và chỉ
 * overwrite accessToken, refreshToken, và optional client mới nếu có.
 */
function buildUpdatedCredential(
  currentCredential: string,
  refreshResult: any,
): string {
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(currentCredential) as Record<string, unknown>;
  } catch {
    // credential là plain string (access token cũ) - wrap lại
    base = { accessToken: currentCredential };
  }

  base.accessToken = refreshResult.accessToken;
  base.refreshToken = refreshResult.refreshToken || base.refreshToken;

  if (refreshResult.expiresIn !== undefined) {
    base.expiresIn = refreshResult.expiresIn;
  }

  // Nếu provider re-register client mới (OIDC path)
  if (refreshResult._newClientId) {
    base.clientId = refreshResult._newClientId;
    base.clientSecret = refreshResult._newClientSecret;
    base.clientSecretExpiresAt = refreshResult._newClientSecretExpiresAt;
  }

  return JSON.stringify(base);
}

// ─── Controller ─────────────────────────────────────────────────────────

// ─── POST /v1/accounts/import/preview ──────────────────────────────
export const previewImport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const managerId = req.headers['x-database-manager-id'] ?? '(none)';
    const accounts: AccountInput[] = req.body;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Request body must be a non-empty array of accounts',
      });
      return;
    }

    const result = await previewImportAccountsService(accounts);

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[previewImport] FAILED — message:', error?.message);
    logger.error('[previewImport] FAILED — stack:', error?.stack);
    logger.error('[previewImport] FAILED — full error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: error?.message,
    });
  }
};

// ─── POST /v1/accounts/import ──────────────────────────────────────
export const importAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const accounts: AccountInput[] = req.body;

    if (!Array.isArray(accounts)) {
      res.status(400).json({
        success: false,
        message: 'Request body must be an array of accounts',
        error: {
          code: 'INVALID_INPUT',
          details: { expected: 'array', received: typeof req.body },
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (accounts.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No accounts to import',
        data: { imported: 0, skipped: 0, duplicates: [] },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    try {
      const result = await importAccountsService(accounts);

      // Invalidate provider cache so model lists are refreshed for newly imported accounts
      invalidateProviderCache();

      res.status(200).json({
        success: true,
        message: `Successfully imported ${result.imported} account(s)`,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      logger.error('Error importing accounts', err);
      res.status(500).json({
        success: false,
        message: 'Failed to import accounts',
        error: { code: 'DATABASE_ERROR' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  } catch (error) {
    logger.error('Error in importAccounts', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// ─── POST /v1/accounts/override ─────────────────────────────────────
export const overrideAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { existingId, incoming } = req.body as {
      existingId: string;
      incoming: AccountInput;
    };
    if (!existingId || !incoming) {
      res.status(400).json({
        success: false,
        message: 'existingId and incoming are required',
      });
      return;
    }
    await overrideAccountService(existingId, incoming);
    invalidateProviderCache();
    res.status(200).json({ success: true, message: 'Account overridden' });
  } catch (error) {
    logger.error('Error in overrideAccount', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /v1/accounts
export const addAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const account: AccountInput = req.body;

    if (!account || typeof account !== 'object' || Array.isArray(account)) {
      res.status(400).json({
        success: false,
        message: 'Request body must be a single account object',
        error: {
          code: 'INVALID_INPUT',
          details: { expected: 'object', received: typeof req.body },
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (
      !account.provider_id ||
      !account.email ||
      (!account.credential && !account.user_data_dir)
    ) {
      res.status(400).json({
        success: false,
        message:
          'Missing required fields: provider_id, email, and either credential or user_data_dir',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const existing = await getAccountByIdOrEmailProvider(
      account.id,
      account.email,
      account.provider_id,
    );

    if (existing) {
      try {
        if (account.credential) {
          updateAccount(existing.id, account.credential);
        }
        if (account.user_data_dir) {
          updateAccountUserDataDir(existing.id, account.user_data_dir);
        }
        if (account.auth_method !== undefined) {
          await updateAccountEditableFields(existing.id, {
            auth_method: account.auth_method ?? null,
          });
        }
        // Invalidate provider cache so model list is refreshed with the updated credential
        invalidateProviderCache();
        res.status(200).json({
          success: true,
          message: 'Account credential updated successfully',
          data: {
            id: existing.id,
            email: existing.email,
            provider_id: existing.provider_id,
            action: 'updated',
          },
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (updateErr) {
        logger.error('Error updating account credential', updateErr);
        res.status(500).json({
          success: false,
          message: 'Failed to update account credential',
          error: { code: 'DATABASE_ERROR' },
        });
      }
      return;
    }

    try {
      const id = await createAccount(account);
      // Invalidate provider cache so model list is refreshed for the newly added account
      invalidateProviderCache();

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          id,
          email: account.email,
          provider_id: account.provider_id,
          action: 'created',
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (insertErr) {
      logger.error('Error inserting account', insertErr);
      res.status(500).json({
        success: false,
        message: 'Failed to create account',
        error: { code: 'DATABASE_ERROR' },
      });
    }
  } catch (error) {
    logger.error('Error in addAccount', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// PUT /v1/accounts/:id
// Cập nhật email và/hoặc credential của một account đã tồn tại.
export const updateAccountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, credential } = req.body || {};

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Account ID is required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (email === undefined && credential === undefined) {
      res.status(400).json({
        success: false,
        message: 'At least one field (email or credential) is required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (email !== undefined && (typeof email !== 'string' || !email.trim())) {
      res.status(400).json({
        success: false,
        message: 'email must be a non-empty string',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (credential !== undefined && typeof credential !== 'string') {
      res.status(400).json({
        success: false,
        message: 'credential must be a string',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const fields: { email?: string; credential?: string | null } = {};
    if (email !== undefined) fields.email = email.trim();
    if (credential !== undefined) fields.credential = credential;

    const updated = await updateAccountEditableFields(id, fields);
    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Invalidate provider cache so model list is refreshed with the updated credential
    invalidateProviderCache();

    res.status(200).json({
      success: true,
      message: 'Account updated successfully',
      data: { id },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Error in updateAccount', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// GET /v1/accounts/:id
export const getAccountByIdHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const account = await getAccountById(id);
    if (!account) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }

    // usage được ghi trực tiếp vào DB → trả thẳng, không cần compute.
    const computedUsage = account.usage ?? null;

    res.status(200).json({
      success: true,
      data: { ...account, usage: computedUsage },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Error in getAccountByIdHandler', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /v1/accounts
export const getAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const email = req.query.email as string;
    const provider_id = req.query.provider_id as string;
    const sort_by = (req.query.sort_by as string) || 'email';
    const order =
      (req.query.order as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const clientId = (req.query.clientId as string) || null;

    const { rows, total } = await getAccountsService({
      page,
      limit,
      email,
      provider_id,
      sort_by,
      order: order as 'ASC' | 'DESC',
    });

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    const periodStats = await queryAccountStatsByPeriod(startOfDay, endOfDay);
    const statsMap = new Map(
      periodStats.map((s: any) => [
        s.id,
        {
          period_requests: s.total_requests ?? 0,
          period_tokens: s.total_tokens ?? 0,
        },
      ]),
    );

    const accountsWithStatus = rows.map((row) => {
      const stats = statsMap.get(row.id) ?? {
        period_requests: 0,
        period_tokens: 0,
      };

      // Tính lại usage và reset_usage_at mới nhất từ requestLimit của provider.
      // Không cần DB write — chỉ compute từ dữ liệu đã có sẵn.
      const provider = providerRegistry.getProvider(row.provider_id);
      const requestLimit = provider?.usagePolicy?.requestLimit;
      const requestLimitPeriod: 'day' | 'week' | 'month' =
        provider?.usagePolicy?.requestLimitPeriod ?? 'day';

      let computedUsage: number | null = row.usage ?? null;
      let computedResetAt: string | null = row.reset_usage_at ?? null;

      if (requestLimit != null) {
        const live = computeLiveUsageFields(
          row.usage ?? null,
          row.reset_usage_at ?? null,
          requestLimit,
          requestLimitPeriod,
        );
        computedUsage = live.usage;
        computedResetAt = live.reset_usage_at;
      }

      return {
        ...row,
        ...stats,
        usage: computedUsage,
        reset_usage_at: computedResetAt,
        last_used_at: row.last_used_at ?? null,
        used_by_windows: countOtherWindows(row.id, clientId),
      };
    });

    res.status(200).json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: {
        accounts: accountsWithStatus,
        pagination: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      },
      meta: { timestamp: new Date().toISOString() },
    });

    // Fire-and-forget: refresh usage cho các account có provider hỗ trợ getUsage.
    // Kết quả sẽ được lưu vào DB → lần fetch tiếp theo sẽ có value sẵn.
    for (const row of rows) {
      const provider = providerRegistry.getProvider(row.provider_id);
      const hasGetUsage = !!provider?.getUsage;
      const shouldRefresh =
        hasGetUsage && accountRefreshService.shouldRefreshUsage(row);
      if (shouldRefresh) {
        accountRefreshService.refreshUsage(row.id).catch((err) => {
          logger.warn(
            `[getAccounts] fire-and-forget refreshUsage failed: account=${row.id} err=${err?.message}`,
          );
        });
      }
    }
  } catch (error) {
    logger.error('Error in getAccounts', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

export const deleteAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Account ID is required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const account = await getAccountById(id);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    await removeAccount(id, account.provider_id);
    // Invalidate provider cache so model lists reflect the removed account
    invalidateProviderCache();

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
      data: { account_id: id },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('[DeleteAccount] Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// POST /v1/accounts/:id/presence
// Webview gọi định kỳ để báo "cửa sổ này đang active account X".
// Body: { clientId: string }. Trả về số cửa sổ KHÁC đang active account đó.
export const heartbeatAccountPresence = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { clientId } = req.body || {};

    if (!id || typeof clientId !== 'string' || !clientId) {
      res.status(400).json({
        success: false,
        message: 'account id and clientId are required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const others = heartbeatPresence(id, clientId);
    res.status(200).json({
      success: true,
      data: { account_id: id, used_by_windows: others },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Error in heartbeatAccountPresence', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// DELETE /v1/accounts/:id/presence?clientId=...
export const releaseAccountPresence = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const clientId = (req.query.clientId as string) || null;

    if (!id || !clientId) {
      res.status(400).json({
        success: false,
        message: 'account id and clientId are required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    releasePresence(id, clientId);
    res.status(200).json({
      success: true,
      data: { account_id: id },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Error in releaseAccountPresence', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// ─── POST /v1/accounts/:id/session-cleanup ──────────────────────────
/**
 * Xóa toàn bộ conversation (chat session) của account phía provider.
 * Được gọi bởi Zen webview khi phát hiện account không còn ở chat view
 * (health-check interval) để dọn sạch lịch sử phía server.
 *
 * Chỉ hoạt động với provider có implement deleteAllSessions().
 * Provider hỗ trợ được đánh dấu bằng field `supports_session_cleanup: true`
 * trong response của GET /v1/providers.
 */
export const deleteAllAccountSessions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Account ID is required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const account = await getAccountById(id);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (!account.credential) {
      res.status(400).json({
        success: false,
        message: 'Account has no credential',
        error: { code: 'NO_CREDENTIAL' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const provider = providerRegistry.getProvider(account.provider_id);
    if (!provider?.deleteAllSessions) {
      res.status(400).json({
        success: false,
        message: 'Provider does not support session cleanup',
        error: { code: 'UNSUPPORTED_PROVIDER' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const success = await provider.deleteAllSessions(account.credential);

    if (!success) {
      res.status(500).json({
        success: false,
        message: 'Session cleanup failed',
        error: { code: 'CLEANUP_FAILED' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'All sessions deleted successfully',
      data: { account_id: id },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('[SessionCleanup] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// ─── POST /v1/accounts/:id/refresh-token ────────────────────────────

export const refreshAccountToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { provider_id } = req.body;

    if (!id || !provider_id) {
      res.status(400).json({
        success: false,
        message: 'Account ID and provider_id are required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const account = await getAccountById(id);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Get provider and check if it supports token refresh
    const provider = providerRegistry.getProvider(provider_id);
    if (!provider?.refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Provider does not support token refresh',
        error: { code: 'UNSUPPORTED_PROVIDER' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (!account.credential) {
      res.status(400).json({
        success: false,
        message: 'Account has no credential to refresh',
        error: { code: 'NO_CREDENTIAL' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Call provider refreshToken with current credential
    const refreshResult = await provider.refreshToken(account.credential);

    if (!refreshResult) {
      res.status(500).json({
        success: false,
        message: 'Token refresh failed (network error or unsupported)',
        error: { code: 'REFRESH_FAILED' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if ((refreshResult as any).error === 'unrecoverable_refresh_error') {
      res.status(401).json({
        success: false,
        message:
          'Refresh token has expired or been revoked. Re-authentication required.',
        error: { code: 'TOKEN_EXPIRED', details: (refreshResult as any).code },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (!(refreshResult as any).accessToken) {
      res.status(500).json({
        success: false,
        message: 'Token refresh returned no access token',
        error: { code: 'REFRESH_FAILED' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Build updated credential with new tokens
    const updatedCredential = buildUpdatedCredential(
      account.credential,
      refreshResult,
    );

    // Update account credential
    updateAccountCredential(id, updatedCredential);
    // Invalidate provider cache so model list is refreshed with the new token
    invalidateProviderCache();

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { account_id: id, email: account.email },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('[RefreshToken] Error refreshing token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// GET /v1/accounts/:id/browser/status
export const getAccountBrowserStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const account = await getAccountById(id);

    if (!account) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }

    // Check if this is a browser provider (has user_data_dir)
    if (!account.user_data_dir) {
      res.status(200).json({
        success: true,
        data: {
          has_profile: false,
          is_running: false,
          message: 'No browser profile associated with this account',
        },
      });
      return;
    }

    const status = await getBrowserStatus(account.user_data_dir);
    res.status(200).json({
      success: true,
      data: {
        has_profile: true,
        is_running: status.isRunning,
        user_data_dir: account.user_data_dir,
        message: status.isRunning
          ? 'Browser is running'
          : 'Browser is not running',
      },
    });
  } catch (error: any) {
    logger.error('Error getting browser status', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get browser status',
    });
  }
};

// POST /v1/accounts/:id/browser/start
export const startAccountBrowser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const account = await getAccountById(id);

    if (!account) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }

    if (!account.user_data_dir) {
      res.status(400).json({
        success: false,
        message:
          'No browser profile associated with this account. Please complete login first.',
      });
      return;
    }

    // Get provider config to find extension folder
    const provider = await getProviderConfig(account.provider_id);
    let extensionPath: string | null = null;

    if (provider?.browser_extension_folder) {
      extensionPath = path.join(
        __dirname,
        '../../extensions',
        provider.browser_extension_folder,
      );
    }

    const result = await startBrowserForAccount(
      account.user_data_dir,
      account.provider_id,
      undefined, // loginUrl will use default
      extensionPath || undefined,
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Browser started successfully',
    });
  } catch (error: any) {
    logger.error('Error starting browser', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start browser',
    });
  }
};
