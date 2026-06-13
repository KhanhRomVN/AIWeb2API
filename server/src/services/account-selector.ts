import { findAccountById, listAccounts } from '../repositories/account.repository';

export interface Account {
  id: string;
  email: string;
  provider_id: string;
  credential: string;
}

export type SelectionStrategy = 'round-robin' | 'priority' | 'least-used';

export class AccountSelector {
  private roundRobinIndex: Map<string, number> = new Map();
  private requestCounts: Map<string, number> = new Map();

  selectAccount(
    provider?: string,
    strategy: SelectionStrategy = 'round-robin',
    email?: string,
  ): Account | null {
    const accounts = this.getActiveAccounts(provider);
    if (accounts.length === 0) return null;

    if (email) {
      const account = accounts.find(
        (a) => a.email.toLowerCase() === email.toLowerCase(),
      );
      if (account) return account;
    }

    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(provider || 'default', accounts);
      case 'priority':
        return this.priority(accounts);
      case 'least-used':
        return this.leastUsed(accounts);
      default:
        return accounts[0];
    }
  }

  getActiveAccounts(provider_id?: string): Account[] {
    try {
      const { rows } = listAccounts({
        page: 1,
        limit: 10000,
        provider_id,
      });
      return rows;
    } catch {
      return [];
    }
  }

  getAccountById(id: string): Account | null {
    return findAccountById(id);
  }

  private roundRobin(key: string, accounts: Account[]): Account {
    const index = this.roundRobinIndex.get(key) || 0;
    const account = accounts[index % accounts.length];
    this.roundRobinIndex.set(key, index + 1);
    return account;
  }

  private priority(accounts: Account[]): Account {
    return accounts[0];
  }

  private leastUsed(accounts: Account[]): Account {
    let minCount = Infinity;
    let selectedAccount = accounts[0];
    for (const account of accounts) {
      const count = this.requestCounts.get(account.id) || 0;
      if (count < minCount) {
        minCount = count;
        selectedAccount = account;
      }
    }
    return selectedAccount;
  }

  trackRequest(accountId: string): void {
    const count = this.requestCounts.get(accountId) || 0;
    this.requestCounts.set(accountId, count + 1);
  }

  resetCounts(): void {
    this.requestCounts.clear();
  }

  getRequestCount(accountId: string): number {
    return this.requestCounts.get(accountId) || 0;
  }
}

let accountSelector: AccountSelector | null = null;

export const getAccountSelector = (): AccountSelector => {
  if (!accountSelector) {
    accountSelector = new AccountSelector();
  }
  return accountSelector;
};

export const findAccount = (
  req: { headers: { authorization?: string }; query: { email?: string } },
  provider: string,
  email?: string,
): Account | null => {
  const selector = getAccountSelector();
  const accounts = selector.getActiveAccounts(provider);
  const authHeader = req.headers.authorization;
  const emailQuery = email || (req.query.email as string);

  let account: Account | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    account = accounts.find((a) => a.id === token) || null;
  }

  if (!account && emailQuery) {
    account =
      accounts.find((a) => a.email.toLowerCase() === emailQuery.toLowerCase()) || null;
  }

  if (!account && accounts.length > 0) {
    account = accounts[0];
  }

  return account;
};
