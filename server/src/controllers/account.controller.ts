import { Request, Response } from 'express';
import { getDb } from '../services/db';
import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import { kiroAccountService } from '../services/kiro-account.service';
// (Direct imports removed)

const logger = createLogger('AccountController');

interface Account {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
}

export const importAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const accounts: Account[] = req.body;

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

    const db = getDb();
    const duplicates: Account[] = [];
    const toInsert: Account[] = [];

    // Check for existing accounts (synchronous)
    for (const account of accounts) {
      const row = db
        .prepare('SELECT * FROM accounts WHERE email = ? AND provider_id = ?')
        .get(account.email, account.provider_id);

      if (row) {
        duplicates.push(account);
      } else {
        toInsert.push(account);
      }
    }

    // Insert non-duplicate accounts
    if (toInsert.length > 0) {
      try {
        // Use transaction for atomic operation
        db.prepare('BEGIN IMMEDIATE').run();

        const stmt = db.prepare(
          'INSERT INTO accounts (id, provider_id, email, credential) VALUES (?, ?, ?, ?)',
        );

        for (const account of toInsert) {
          stmt.run(
            account.id,
            account.provider_id,
            account.email,
            account.credential,
          );
        }

        db.prepare('COMMIT').run();

        // Update provider counts (case-insensitive)
        const providerIds = [...new Set(toInsert.map((a) => a.provider_id))];
        for (const pid of providerIds) {
          // Ensure provider exists in providers table first
          db.prepare(
            'INSERT OR IGNORE INTO providers (id, name, total_accounts) VALUES (?, ?, 0)',
          ).run(pid.toLowerCase(), pid);

          db.prepare(
            'UPDATE providers SET total_accounts = (SELECT COUNT(*) FROM accounts WHERE LOWER(provider_id) = LOWER(?)) WHERE LOWER(id) = LOWER(?)',
          ).run(pid, pid);
        }

        res.status(200).json({
          success: true,
          message: `Successfully imported ${toInsert.length} account(s)`,
          data: {
            imported: toInsert.length,
            skipped: duplicates.length,
            duplicates: duplicates.map((d) => ({
              email: d.email,
              provider_id: d.provider_id,
            })),
          },
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (err) {
        // Rollback on error
        try {
          db.prepare('ROLLBACK').run();
        } catch (rollbackErr) {
          logger.error('Error during rollback', rollbackErr);
        }
        logger.error('Error inserting accounts', err);
        res.status(500).json({
          success: false,
          message: 'Failed to import accounts',
          error: { code: 'DATABASE_ERROR' },
          meta: { timestamp: new Date().toISOString() },
        });
      }
    } else {
      res.status(200).json({
        success: true,
        message: 'All accounts were duplicates',
        data: {
          imported: 0,
          skipped: duplicates.length,
          duplicates: duplicates.map((d) => ({
            email: d.email,
            provider_id: d.provider_id,
          })),
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
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

export const addAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const account: Account = req.body;

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

    if (!account.provider_id || !account.email || !account.credential) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: provider_id, email, credential',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const db = getDb();

    // Check for existing account (synchronous)
    const row = db
      .prepare(
        'SELECT * FROM accounts WHERE (email = ? AND provider_id = ?) OR id = ?',
      )
      .get(account.email, account.provider_id, account.id) as any;

    if (row) {
      // Account already exists - Update credential
      try {
        db.prepare('UPDATE accounts SET credential = ? WHERE id = ?').run(
          account.credential,
          row.id,
        );
        res.status(200).json({
          success: true,
          message: 'Account credential updated successfully',
          data: {
            id: row.id,
            email: row.email,
            provider_id: row.provider_id,
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

    // Create new account
    const id = account.id || require('crypto').randomUUID();

    try {
      db.prepare(
        'INSERT INTO accounts (id, provider_id, email, credential) VALUES (?, ?, ?, ?)',
      ).run(id, account.provider_id, account.email, account.credential);

      // Increment total_accounts in providers table (case-insensitive)
      // Ensure provider exists in providers table first
      db.prepare(
        'INSERT OR IGNORE INTO providers (id, name, total_accounts) VALUES (?, ?, 0)',
      ).run(account.provider_id.toLowerCase(), account.provider_id);

      db.prepare(
        'UPDATE providers SET total_accounts = total_accounts + 1 WHERE LOWER(id) = LOWER(?)',
      ).run(account.provider_id);

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

    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (email) {
      conditions.push('email LIKE ?');
      params.push(`%${email}%`);
    }

    if (provider_id) {
      conditions.push('provider_id = ?');
      params.push(provider_id);
    }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Count query (synchronous)
    const countSql = `SELECT COUNT(*) as total FROM accounts ${whereClause}`;
    const countResult = db.prepare(countSql).get(...params) as {
      total: number;
    };
    const total = countResult.total;

    // Data query (synchronous)
    const sql = `SELECT * FROM accounts ${whereClause} ORDER BY ${sort_by} ${order} LIMIT ? OFFSET ?`;
    const queryParams = [...params, limit, offset];
    const rows = db.prepare(sql).all(...queryParams);

    // Check for active Kiro CLI account
    const localKiroSession = await kiroAccountService.getFromLocal();
    const accountsWithStatus = rows.map((row: any) => {
      let is_active_cli = false;
      if (row.provider_id === 'kiro-cli' && localKiroSession) {
        try {
          const local = JSON.parse(localKiroSession);
          const stored = JSON.parse(row.credential);
          
          // 1. If local session has an email (injected by Elara), it's the most stable way
          if (local.email && row.email && local.email.toLowerCase() === row.email.toLowerCase()) {
            is_active_cli = true;
          } else {
            // 2. Fallback to token matching (both snake_case and camelCase)
            const localAccess = local.access_token || local.accessToken;
            const localRefresh = local.refresh_token || local.refreshToken;
            const storedAccess = stored.access_token || stored.accessToken;
            const storedRefresh = stored.refresh_token || stored.refreshToken;

            if (
              (localAccess && localAccess === storedAccess) ||
              (localRefresh && localRefresh === storedRefresh)
            ) {
              is_active_cli = true;
            }
          }
        } catch (e) {}
      }
      return { ...row, is_active_cli };
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

    const db = getDb();

    // Check if account exists
    const account = db
      .prepare('SELECT id, provider_id FROM accounts WHERE id = ?')
      .get(id);

    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Delete account
    try {
      const { provider_id } = account as any;
      db.prepare('DELETE FROM accounts WHERE id = ?').run(id);

      // Decrement total_accounts in providers table (case-insensitive)
      // Ensure provider exists in providers table first (unlikely to be missing if deleting, but safer)
      db.prepare(
        'INSERT OR IGNORE INTO providers (id, name, total_accounts) VALUES (?, ?, 0)',
      ).run(provider_id.toLowerCase(), provider_id);

      db.prepare(
        'UPDATE providers SET total_accounts = MAX(0, total_accounts - 1) WHERE LOWER(id) = LOWER(?)',
      ).run(provider_id);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        data: { id, action: 'deleted' },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (dbError) {
      logger.error('Error deleting account from DB', dbError);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account',
        error: { code: 'DATABASE_ERROR' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  } catch (error) {
    logger.error('Error in deleteAccount', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

export const proxyIcon = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).send('URL is required');
      return;
    }

    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).send('Failed to fetch icon');
      return;
    }

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Cache icons for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Error in proxyIcon', error);
    res.status(500).send('Internal Server Error');
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider: providerId } = req.params;
    const { method } = req.body;

    logger.info(
      `[DEBUG] /login/:provider endpoint hit with provider: ${providerId}, method: ${method}`,
    );

    const allRegisteredProviders = providerRegistry
      .getAllProviders()
      .map((p) => p.name);
    logger.info(
      `[DEBUG] Available providers in registry: ${allRegisteredProviders.join(', ')}`,
    );

    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      res.status(404).json({
        success: false,
        message: 'Provider not found',
      });
      return;
    }

    logger.info(
      `Starting browser login for ${providerId} (method: ${method})...`,
    );

    // Use provider-specific login function
    let result;
    if (provider.login) {
      result = await provider.login({
        method: method === 'google' ? 'google' : 'basic',
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Browser login not yet implemented for ${providerId}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      account: {
        provider_id: providerId,
        email: (result as any).email || '',
        credential: (result as any).cookies,
        headers: (result as any).headers,
      },
    });
  } catch (error: any) {
    logger.error('Login failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

export const switchAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(id) as any;

    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    const provider = providerRegistry.getProvider(account.provider_id);
    if (!provider) {
      res.status(400).json({
        success: false,
        message: `Provider ${account.provider_id} not found`,
      });
      return;
    }

    if (typeof provider.switchAccount !== 'function') {
      res.status(400).json({
        success: false,
        message: `Switching accounts is not supported for provider ${account.provider_id}`,
      });
      return;
    }

    logger.info(
      `Switching to account ${account.email} (provider: ${account.provider_id})...`,
    );
    await provider.switchAccount(id);

    res.status(200).json({
      success: true,
      message: `Successfully switched to account ${account.email}`,
      data: {
        id: account.id,
        email: account.email,
        provider_id: account.provider_id,
      },
    });
  } catch (error: any) {
    logger.error('Error in switchAccount:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to switch account',
    });
  }
};
