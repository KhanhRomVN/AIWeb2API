import { getDb } from './db';
import { providerRegistry } from '../provider/registry';
import { createLogger } from '../utils/logger';

const logger = createLogger('AccountRefreshService');

export class AccountRefreshService {
  private interval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 1 * 60 * 60 * 1000; // Check every 1 hour
  private readonly AUTO_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // Refresh once a day

  start() {
    if (this.interval) return;

    logger.info('Starting Account Refresh Service...');

    // Initial check on startup (wait 30s to let registry load)
    setTimeout(() => this.checkAndRefresh(), 30000);

    this.interval = setInterval(() => {
      this.checkAndRefresh();
    }, this.REFRESH_INTERVAL);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkAndRefresh() {
    logger.info('Running account refresh check...');
    const db = getDb();
    const accounts = db.prepare('SELECT * FROM accounts').all() as any[];

    for (const account of accounts) {
      try {
        let credential: any;
        try {
          credential = JSON.parse(account.credential);
        } catch (e) {
          // If not JSON, it might be a raw token string (older format)
          credential = { accessToken: account.credential };
        }

        const refreshToken =
          credential.refreshToken || credential.refresh_token;
        const now = Date.now();
        const lastRefreshed = account.last_refreshed_at || 0;
        const provider = providerRegistry.getProvider(account.provider_id);

        if (!provider) continue;

        // 1. Check if we need to refresh the token (if refreshToken exists)
        if (
          refreshToken &&
          now - lastRefreshed >= this.AUTO_REFRESH_THRESHOLD
        ) {
          logger.info(
            `[AutoRefresh] Checking account ${account.email} (${account.provider_id})...`,
          );

          if (provider.refreshToken) {
            try {
              const newTokens = await provider.refreshToken(refreshToken);

              // Merge new tokens with existing credential
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

              db.prepare(
                'UPDATE accounts SET credential = ?, last_refreshed_at = ? WHERE id = ?',
              ).run(JSON.stringify(updatedCredential), now, account.id);

              logger.info(
                `[AutoRefresh] Successfully refreshed account ${account.email}`,
              );

              // Update local credential for usage check below
              credential = updatedCredential;
            } catch (err: any) {
              logger.error(
                `[AutoRefresh] Failed to refresh account ${account.email}:`,
                err.message,
              );
            }
          }
        }

        // 2. Fetch Usage (if supported by provider)
        if (provider.getUsage) {
          await this.refreshUsage(account.id);
        }
      } catch (e: any) {
        logger.error(
          `[AutoRefresh] Error processing account ${account.id}:`,
          e.message,
        );
      }
    }
  }

  async refreshUsage(accountId: string) {
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(accountId) as any;
    if (!account) return;

    const provider = providerRegistry.getProvider(account.provider_id);
    if (!provider || !provider.getUsage) return;

    try {
      let credential: any;
      try {
        credential = JSON.parse(account.credential);
      } catch (e) {
        credential = { accessToken: account.credential };
      }

      const usageInfo = await provider.getUsage(JSON.stringify(credential));
      db.prepare(
        'UPDATE accounts SET usage = ?, reset_period = ? WHERE id = ?',
      ).run(usageInfo.usage, usageInfo.resetPeriod, account.id);
      logger.info(
        `[AutoRefresh] Updated usage for ${account.email}: ${usageInfo.usage}%`,
      );
    } catch (err: any) {
      logger.warn(
        `[AutoRefresh] Failed to fetch usage for ${account.email}:`,
        err.message,
      );
    }
  }
}

export const accountRefreshService = new AccountRefreshService();
