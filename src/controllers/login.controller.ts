/**
 * ------------------------------------------------------------------
 * Login Controller
 * ------------------------------------------------------------------
 * Xử lý đăng nhập qua browser cho provider.
 *
 * Main functions:
 * - login() : Đăng nhập qua browser cho provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import { loginWithProvider } from '../services/login.service';
import { resolveProfileUserDataDir } from '../services/profile-context';

// ── Registry ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('LoginController');

// ─── Controller ─────────────────────────────────────────────────────────

// POST /v1/accounts/login/:provider
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider: providerId } = req.params;
    const { method, profile_folder } = req.body;
    // Chỉ nhận tên folder từ client; backend tự ghép với chromium_profile_dir
    const profile = await resolveProfileUserDataDir(profile_folder);
    if (profile.error) {
      res.status(400).json({ success: false, message: profile.error });
      return;
    }

    try {
      const result = await loginWithProvider(providerId, {
        method: method || 'google',
        userDataDir: profile.dir,
      });

      const accountResponse: any = {
        provider_id: providerId,
        email: result.email || '',
        credential: result.cookies,
        headers: result.headers,
      };

      if (result.user_data_dir) {
        accountResponse.user_data_dir = result.user_data_dir;
      }

      // Include pending info for browser providers
      if (result.pending) {
        accountResponse.pending = result.pending;
        accountResponse.tempSessionId = result.tempSessionId;
        // Device code flow extras (Kiro, grok-build, etc.)
        if ((result as any).user_code) {
          accountResponse.user_code = (result as any).user_code;
          accountResponse.verification_url = (result as any).verification_url;
          accountResponse.expires_in = (result as any).expires_in;
          accountResponse.poll_interval = (result as any).poll_interval;
          // Truyền lại profile dir để frontend mở browser đúng profile (plain, không CDP)
          if (profile.dir) {
            accountResponse.profile_user_data_dir = profile.dir;
          }
        }
      }

      res.status(200).json({
        success: true,
        account: accountResponse,
      });
    } catch (providerError: any) {
      const errorMessage =
        providerError?.message || String(providerError) || 'Unknown error';
      logger.warn(`[Login] Provider error: ${errorMessage}`);

      if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Provider not found',
        });
      } else if (errorMessage.includes('not support')) {
        res.status(400).json({
          success: false,
          message: errorMessage,
        });
      } else {
        throw providerError;
      }
      return;
    }
  } catch (error: any) {
    logger.error('[Login] Login failed with error:', error);
    logger.error(`[Login] Error message: ${error.message}`);
    logger.error(`[Login] Error stack: ${error.stack}`);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Login failed' });
  }
};

// POST /v1/accounts/login/:provider/poll
// Được UI gọi định kỳ sau khi nhận pending=true từ /login
export const pollLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider: providerId } = req.params;
    const { pollContext } = req.body;

    if (!pollContext) {
      res
        .status(400)
        .json({ success: false, message: 'pollContext is required' });
      return;
    }

    const p = providerRegistry.getProvider(providerId);

    if (!p) {
      res
        .status(404)
        .json({ success: false, message: `Provider ${providerId} not found` });
      return;
    }

    if (typeof (p as any).pollOnce !== 'function') {
      res
        .status(400)
        .json({
          success: false,
          message: `Provider ${providerId} does not support poll`,
        });
      return;
    }

    const result = await (p as any).pollOnce(pollContext);

    if (result.error) {
      res
        .status(200)
        .json({ success: false, done: false, error: result.error });
      return;
    }

    if (!result.done) {
      res.status(200).json({ success: true, done: false });
      return;
    }

    // Parse auth_method từ pollContext để include trong response
    let authMethodFromCtx: string | null = null;
    try {
      const ctx = JSON.parse(pollContext);
      authMethodFromCtx = ctx?.auth_method ?? null;
    } catch {
      // ignore
    }

    res.status(200).json({
      success: true,
      done: true,
      account: {
        provider_id: providerId,
        email: result.email || '',
        credential: result.cookies || '',
        auth_method: authMethodFromCtx,
      },
    });
  } catch (error: any) {
    logger.error('[PollLogin] Error:', error);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Poll failed' });
  }
};
