import {
  Copy,
  MousePointer2,
  Trash2,
  Check,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  RefreshCcw,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Favicon } from '../../../shared/utils/faviconUtils';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/utils';
import { FlatAccount } from '../types';
import { getSuccessRateClass } from '../../models/utils/modelUtils';

interface AccountsTableProps {
  accounts: FlatAccount[];
  loading: boolean;
  selectedAccounts: Set<string>;
  toggleSelection: (id: string) => void;
  toggleAll: () => void;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  providerConfigs: any[];
  period: string;
  onDelete: (id: string, email?: string) => void;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

type SortState = 'default' | 'up' | 'down';

const SortIndicator = ({ state }: { state: SortState }) => {
  if (state === 'default') return null;
  return state === 'up' ? (
    <ChevronUp className="w-3.5 h-3.5 ml-1" />
  ) : (
    <ChevronDown className={cn('w-3.5 h-3.5 ml-1', state === 'down' && 'text-red-500')} />
  );
};

export const AccountsTable = ({
  accounts,
  loading,
  selectedAccounts,
  toggleSelection,
  toggleAll,
  allVisibleSelected,
  someVisibleSelected,
  providerConfigs,
  period,
  onDelete,
}: AccountsTableProps) => {
  const navigate = useNavigate();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [menuAccount, setMenuAccount] = useState<FlatAccount | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sorting UI state (Initial states as requested)
  const [sortStates, setSortStates] = useState<Record<string, SortState>>({
    maxLoad: 'down',
    totals: 'down',
  });

  const handleSortClick = (key: string) => {
    setSortStates((prev) => {
      const current = prev[key];
      let next: SortState = 'default';
      if (current === 'default') next = 'up';
      else if (current === 'up') next = 'down';
      else next = 'default';

      return {
        ...prev,
        [key]: next,
      };
    });
  };

  const handleContextMenu = (e: React.MouseEvent, account: FlatAccount) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuAccount(account);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuPosition(null);
      }
    };
    if (menuPosition) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuPosition]);

  const copyAccountJson = (account: FlatAccount) => {
    navigator.clipboard.writeText(JSON.stringify(account, null, 2));
  };

  const sortedAccounts = useMemo(() => {
    const activeSortKey = Object.keys(sortStates).find((key) => sortStates[key] !== 'default');
    if (!activeSortKey) return accounts;

    const state = sortStates[activeSortKey];
    return [...accounts].sort((a, b) => {
      if (activeSortKey === 'account') {
        const emailA = a.email?.toLowerCase() || '';
        const emailB = b.email?.toLowerCase() || '';
        return state === 'up' ? emailA.localeCompare(emailB) : emailB.localeCompare(emailA);
      }

      let valA: any, valB: any;
      if (activeSortKey === 'maxLoad') {
        valA = a.max_req_conversation || 0;
        valB = b.max_req_conversation || 0;
      } else if (activeSortKey === 'totals') {
        valA = a.total_requests || 0;
        valB = b.total_requests || 0;
      } else {
        return 0; // Should not happen if activeSortKey is always one of the defined sortable keys
      }

      if (valA < valB) return state === 'up' ? -1 : 1;
      if (valA > valB) return state === 'up' ? 1 : -1;
      return 0;
    });
  }, [accounts, sortStates]);

  return (
    <div className="w-full h-fit overflow-auto bg-background">
      <table className="w-full caption-bottom text-sm text-left border-collapse">
        <thead className="sticky top-0 bg-card z-10 border-b">
          <tr className="border-b transition-colors">
            <th className="h-9 px-4 align-middle w-[60px] text-center">
              <div
                className={cn(
                  'w-4 h-4 rounded border border-zinc-600 flex items-center justify-center cursor-pointer transition-all',
                  allVisibleSelected ? 'bg-primary border-primary' : 'bg-zinc-900/50',
                  !allVisibleSelected && someVisibleSelected && 'bg-primary/50 border-primary/50',
                )}
                onClick={toggleAll}
              >
                {allVisibleSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                {!allVisibleSelected && someVisibleSelected && (
                  <div className="w-2 h-0.5 bg-white rounded-full" />
                )}
              </div>
            </th>
            <th className="h-9 px-4 align-middle w-[50px] text-center">STT</th>
            <th className="h-9 px-4 align-middle font-medium text-muted-foreground whitespace-nowrap text-left">
              <div
                className={cn(
                  'flex items-center cursor-pointer select-none',
                  sortStates.account === 'up' && 'text-primary',
                  sortStates.account === 'down' && 'text-red-500',
                )}
                onClick={() => handleSortClick('account')}
              >
                Account
                <SortIndicator state={sortStates.account} />
              </div>
            </th>
            <th className="h-9 px-4 align-middle font-medium text-muted-foreground text-center whitespace-nowrap">
              <div
                className={cn(
                  'flex items-center justify-center cursor-pointer select-none',
                  sortStates.maxLoad === 'up' && 'text-primary',
                  sortStates.maxLoad === 'down' && 'text-red-500',
                )}
                onClick={() => handleSortClick('maxLoad')}
              >
                Max Load (Req | Token)
                <SortIndicator state={sortStates.maxLoad} />
              </div>
            </th>
            <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-center whitespace-nowrap">
              <div
                className={cn(
                  'flex items-center justify-center cursor-pointer select-none',
                  sortStates.totals === 'up' && 'text-primary',
                  sortStates.totals === 'down' && 'text-red-500',
                )}
                onClick={() => handleSortClick('totals')}
              >
                Totals (Req | Token)
                <SortIndicator state={sortStates.totals} />
              </div>
            </th>
            <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-center whitespace-nowrap w-[140px]">
              <div className="flex items-center justify-center gap-1.5 opacity-80">
                <RefreshCcw className="w-3.5 h-3.5" />
                Last Refresh
              </div>
            </th>
            <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-center whitespace-nowrap w-[180px]">
              <div className="flex items-center justify-center gap-1.5 opacity-80">
                <Zap className="w-3.5 h-3.5" />
                Usage
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {sortedAccounts.length === 0 && !loading && (
            <tr>
              <td colSpan={7} className="h-24 text-center text-muted-foreground">
                No accounts found.
              </td>
            </tr>
          )}
          {sortedAccounts.map((account, index) => {
            const isActive = account.isActive;
            const isSelected = selectedAccounts.has(account.id);

            return (
              <tr
                key={account.id}
                onContextMenu={(e) => handleContextMenu(e, account)}
                className={cn(
                  'border-b transition-colors hover:bg-muted/50 relative group cursor-default',
                  isSelected &&
                    'bg-primary/5 after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[3px] after:bg-primary',
                  !isActive && 'opacity-50 grayscale',
                )}
              >
                <td className="px-4 py-2.5 align-middle text-center">
                  <div
                    className={cn(
                      'w-4 h-4 rounded border border-zinc-600 flex items-center justify-center cursor-pointer transition-all mx-auto',
                      isSelected ? 'bg-primary border-primary' : 'bg-zinc-900/50',
                    )}
                    onClick={() => toggleSelection(account.id)}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </div>
                </td>
                <td className="px-4 py-2.5 align-middle text-muted-foreground text-center text-xs">
                  {index + 1}
                </td>
                <td className="px-4 py-2.5 align-middle text-left">
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-secondary/30 relative">
                        {(() => {
                          const pConfig = providerConfigs.find(
                            (p) =>
                              p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
                          );
                          const website = pConfig?.website;

                          if (!website) {
                            return (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                onClick={() => {
                                  if (!loading) {
                                    toast.error(
                                      `Website not found for provider: ${account.provider_id}`,
                                    );
                                  }
                                }}
                              >
                                <span className="text-[8px] uppercase font-bold">
                                  {account.provider_id.slice(0, 2)}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <Favicon
                              url={website}
                              size={20}
                              className="w-full h-full object-contain"
                              alt={account.provider_id}
                              onError={() => {
                                toast.error(
                                  `Failed to load favicon for ${account.provider_id} (${website})`,
                                );
                              }}
                              fallbackIcon={
                                <span className="text-[8px] uppercase font-bold text-muted-foreground/50">
                                  {account.provider_id.slice(0, 2)}
                                </span>
                              }
                            />
                          );
                        })()}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono lowercase opacity-70">
                        {account.provider_id}
                      </span>
                    </div>
                    <span className="text-zinc-700 font-light shrink-0">|</span>
                    <span className="text-sm truncate">{account.email}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {account.max_req_conversation?.toLocaleString() || 0}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-40">|</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatNumber(account.max_token_conversation || 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {account.total_requests?.toLocaleString() || 0}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-40">|</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatNumber(account.total_tokens || 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 align-middle text-center whitespace-nowrap">
                  <span className="text-xs text-muted-foreground opacity-80">
                    {account.last_refreshed_at
                      ? formatDistanceToNow(new Date(account.last_refreshed_at), {
                          addSuffix: true,
                        })
                      : '—'}
                  </span>
                </td>
                <td className="px-4 py-2.5 align-middle text-center">
                  {account.usage !== null && account.usage !== undefined ? (
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={cn(
                          'text-sm font-bold',
                          parseFloat(account.usage || '0') > 80
                            ? 'text-orange-500'
                            : parseFloat(account.usage || '0') > 50
                              ? 'text-yellow-500'
                              : 'text-emerald-500',
                        )}
                      >
                        {account.usage}%
                      </span>
                      <span className="text-[11px] text-muted-foreground/50 lowercase">
                        ({account.reset_period || 'month'})
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground opacity-50">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {menuPosition && menuAccount && (
        <div
          ref={menuRef}
          className="fixed z-[100] w-56 rounded-md border border-dropdown-border bg-dropdown-background p-1 shadow-md animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.min(menuPosition.y, window.innerHeight - 150),
            left: Math.min(menuPosition.x, window.innerWidth - 230),
          }}
        >
          <button
            onClick={() => {
              copyAccountJson(menuAccount);
              setMenuPosition(null);
            }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-dropdown-itemHover text-foreground"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy JSON
          </button>
          <button
            onClick={() => {
              navigate('/playground', {
                state: { providerId: menuAccount.provider_id, accountId: menuAccount.id },
              });
              setMenuPosition(null);
            }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-dropdown-itemHover text-foreground"
          >
            <MousePointer2 className="mr-2 h-4 w-4" />
            Open in Playground
          </button>
          <div className="my-1 h-px bg-dropdown-border" />
          <button
            onClick={() => {
              onDelete(menuAccount.id, menuAccount.email);
              setMenuPosition(null);
            }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-destructive/10 text-destructive font-medium"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </button>
        </div>
      )}
    </div>
  );
};
