import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Filter,
} from 'lucide-react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from '../../shared/components/ui/dropdown';
import { useAccounts } from './hooks/useAccounts';
import { AccountsTable } from './components/AccountsTable';
import { AddAccountDialog } from './components/AddAccountDialog';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { CustomSelect } from '../playground/components/CustomSelect';
import { MultiSelectCombobox } from '../../shared/components/ui/MultiSelectCombobox';

import { cn } from '../../shared/lib/utils';
import { toast } from 'sonner';
import { Favicon } from '../../shared/utils/faviconUtils';

export const Accounts = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    accounts,
    allAccounts,
    loading,
    serverPort,
    providerConfigs,
    searchQuery,
    setSearchQuery,
    pagination,
    selectedAccounts,
    confirmOpen,
    setConfirmOpen,
    deleteItem,
    deleteLoading,
    executeDelete,
    fetchAccounts,
    handleDelete,
    handleBulkDelete,
    toggleSelection,
    toggleAll,

    // Filters
    providerFilter,
    setProviderFilter,
    emailFilter,
    setEmailFilter,
    period,
    setPeriod,
    offset,
    setOffset,
    switchKiroAccount,
  } = useAccounts();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrev = useCallback(() => setOffset((prev) => prev + 1), [setOffset]);
  const handleNext = useCallback(() => setOffset((prev) => Math.max(0, prev - 1)), [setOffset]);

  const handleImport = async () => {
    try {
      const result = await (window as any).api.accounts.import();
      if (result.success) {
        fetchAccounts(pagination.page, pagination.limit, true);
        toast.success(`Successfully imported: ${result.added} added, ${result.updated} updated.`);
      } else if (!result.canceled) {
        toast.error('Import failed: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to import:', error);
      toast.error('Failed to import accounts');
    }
  };

  const handleExport = async () => {
    try {
      await (window as any).api.accounts.export();
      toast.success('Accounts exported successfully');
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export accounts');
    }
  };

  const allVisibleSelected =
    accounts.length > 0 && accounts.every((acc) => selectedAccounts.has(acc.id));
  const someVisibleSelected = accounts.some((acc) => selectedAccounts.has(acc.id));

  // Extract unique emails from allAccounts for combobox options
  const emailOptions = useMemo(() => {
    if (!allAccounts || allAccounts.length === 0) return [];
    return Array.from(new Set(allAccounts.map((acc) => acc.email).filter(Boolean)));
  }, [allAccounts]);

  const renderTableFilter = (current: any, setter: any) => (
    <Dropdown size="sm">
      <DropdownTrigger className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors bg-secondary/30 px-2.5 py-1.5 rounded-md">
        {current === 'day'
          ? 'Today'
          : current === 'week'
            ? 'Weekly'
            : current === 'month'
              ? 'Monthly'
              : 'Yearly'}
        <ChevronDown size={12} />
      </DropdownTrigger>
      <DropdownContent
        minWidth="120px"
        className="bg-dropdown-background border border-dropdown-border shadow-xl"
      >
        {['day', 'week', 'month', 'year'].map((p) => (
          <DropdownItem
            key={p}
            onClick={() => {
              setter(p);
              setOffset(0);
            }}
            className="text-xs hover:bg-dropdown-itemHover transition-colors"
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );

  const providerOptions = useMemo(
    () => [
      { value: 'all', label: 'All Providers', icon: <Filter className="w-4 h-4" /> },
      ...providerConfigs.map((p) => ({
        value: p.provider_id,
        label: p.provider_name,
        icon: (
          <Favicon
            url={p.website}
            size={18}
            className="rounded-full overflow-hidden"
            fallbackIcon={
              <div className="w-[18px] h-[18px] rounded-full bg-secondary/30 flex items-center justify-center text-[7px] font-bold uppercase">
                {p.provider_id.slice(0, 2)}
              </div>
            }
          />
        ),
      })),
    ],
    [providerConfigs],
  );

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-row bg-background">
      {/* 1. Sidebar */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col shrink-0 h-full transition-all">
        <div className="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
              {pagination.total}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Filter className="w-3 h-3" /> Filters
            </h3>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Provider
              </label>
              <CustomSelect
                value={providerFilter || 'all'}
                onChange={(val) => setProviderFilter(val === 'all' ? '' : val)}
                options={providerOptions}
                placeholder="Select Provider"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Email / Name
              </label>
              <MultiSelectCombobox
                value={emailFilter}
                onChange={setEmailFilter}
                options={emailOptions}
                placeholder="Filter by email..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full">
        {/* HeaderBar */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0 relative z-20">
          <div className="relative w-80">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border-none bg-transparent pl-8 pr-3 text-sm shadow-none transition-colors focus-visible:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {renderTableFilter(period, setPeriod)}
            <div className="flex items-center gap-1 bg-secondary/30 rounded-md p-1">
              <button
                onClick={handlePrev}
                className="p-1 hover:bg-dropdown-itemHover rounded transition-colors text-muted-foreground hover:text-primary"
                title="Previous Period"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                disabled={offset === 0}
                className={cn(
                  'p-1 rounded transition-colors',
                  offset === 0
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-dropdown-itemHover text-muted-foreground hover:text-primary',
                )}
                title="Next Period"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="w-px h-4 bg-border/50 mx-1" />

            <div className="flex items-center gap-2">
              {selectedAccounts.size > 0 && (
                <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-4">
                  <span className="text-xs text-muted-foreground">
                    {selectedAccounts.size} selected
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                    title="Delete Selected"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                onClick={() => setDialogOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                title="Add Account"
              >
                <Plus className="w-5 h-5" />
              </button>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-md hover:bg-orange-400/10 text-orange-400/70 hover:text-orange-400 transition-colors',
                    showDropdown && 'bg-orange-400/10 text-orange-400',
                  )}
                  title="More Options"
                >
                  <Download className="w-4 h-4" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-200 z-50">
                    <div className="p-1">
                      <button
                        onClick={() => {
                          handleImport();
                          setShowDropdown(false);
                        }}
                        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import (JSON)
                      </button>
                      <button
                        onClick={() => {
                          handleExport();
                          setShowDropdown(false);
                        }}
                        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export (JSON)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <AccountsTable
            accounts={accounts}
            loading={loading}
            selectedAccounts={selectedAccounts}
            toggleSelection={toggleSelection}
            toggleAll={toggleAll}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            providerConfigs={providerConfigs}
            period={period}
            onDelete={handleDelete}
            onSwitchAccount={switchKiroAccount}
          />
        </div>

        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0 bg-card/30">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              <span>of</span>
              <span className="font-medium text-foreground">{pagination.total}</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 disabled:opacity-50 transition-colors"
                onClick={() => fetchAccounts(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
                title="Previous Page"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>

              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7 disabled:opacity-50 transition-colors"
                onClick={() => fetchAccounts(pagination.page + 1)}
                disabled={pagination.page === pagination.total_pages || loading}
                title="Next Page"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchAccounts(pagination.page, pagination.limit, true)}
        serverPort={serverPort}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={executeDelete}
        loading={deleteLoading}
        title={deleteItem ? `Delete account ${deleteItem.email}?` : 'Delete accounts'}
        count={deleteItem ? 1 : selectedAccounts.size}
      />
    </div>
  );
};

export default Accounts;
