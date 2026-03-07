import { useState, useEffect, useCallback, useMemo } from 'react';
import { Account, Pagination, FlatAccount } from '../types';
import { StatsPeriod } from '../../models/types';
import { useServer } from '../../../shared/hooks/tauri/useServer';
import { callBackend } from '../../../shared/utils/backend';
import { toast } from 'sonner';

const PROVIDER_CACHE_KEY = 'elara_provider_configs_cache';

export const useAccounts = () => {
  const { startServer } = useServer();
  const [accounts, setAccounts] = useState<FlatAccount[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(PROVIDER_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<StatsPeriod>('day');
  const [offset, setOffset] = useState(0);

  // Advanced filters
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [emailFilter, setEmailFilter] = useState<string[]>([]); // Changed to array for multi-select
  const [successRateRange, setSuccessRateRange] = useState<[number, number] | null>(null);

  // Max Load (requests, tokens)
  const [maxReqRange, setMaxReqRange] = useState<[number, number] | null>(null);
  const [maxTokenRange, setMaxTokenRange] = useState<[number, number] | null>(null);
  // Totals (requests, tokens)
  const [totalReqRange, setTotalReqRange] = useState<[number, number] | null>(null);
  const [totalTokenRange, setTotalTokenRange] = useState<[number, number] | null>(null);

  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 30,
    total_pages: 1,
  });

  const [allStats, setAllStats] = useState<any[]>([]); // Store global stats for min/max calculation
  const [allAccounts, setAllAccounts] = useState<FlatAccount[]>([]); // Store all accounts for email options

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; email?: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const initServer = async () => {
      try {
        const res = await startServer();
        if (res.success) {
          setServerPort(8888);
        }
      } catch (e) {
        console.error('Error starting server:', e);
      }
    };
    initServer();
  }, [startServer]);

  const fetchAccounts = useCallback(
    async (page = 1, limit = 30, silent = false) => {
      if (!serverPort) return;
      if (!silent) setLoading(true);
      try {
        let pConfigs = providerConfigs;

        // Fetch providers only if cache is empty
        if (pConfigs.length === 0 || silent) {
          const pConfigsData = await callBackend('/v1/providers');
          if (pConfigsData.success) {
            pConfigs = pConfigsData.data;
            setProviderConfigs(pConfigs);
            localStorage.setItem(PROVIDER_CACHE_KEY, JSON.stringify(pConfigs));
          } else if (pConfigs.length === 0) {
            // Only error if we have nothing in cache
            toast.error('Failed to load provider configurations');
          }
        }

        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          period: period,
          offset: offset.toString(),
        });

        if (searchQuery) queryParams.append('email', searchQuery);
        if (emailFilter.length === 1) {
          queryParams.append('email', emailFilter[0]);
        }
        if (providerFilter && providerFilter !== 'all')
          queryParams.append('provider_id', providerFilter);

        const [accountsResult, statsResult] = await Promise.all([
          callBackend(`/v1/accounts?${queryParams.toString()}`),
          callBackend(`/v1/stats?period=${period}&offset=${offset}`),
        ]);

        if (accountsResult.success) {
          const accountList: Account[] = accountsResult.data.accounts;
          const accountStats = statsResult.success ? statsResult.data.accounts : [];

          setAllStats(accountStats); // Store global stats

          const enrichedAccounts: FlatAccount[] = accountList.map((acc) => {
            const stats = accountStats.find((s: any) => s.id === acc.id);
            const pConfig = pConfigs.find(
              (p: { provider_id: string }) =>
                p.provider_id.toLowerCase() === acc.provider_id.toLowerCase(),
            );

            return {
              ...acc,
              total_requests: stats?.total_requests || 0,
              successful_requests: stats?.successful_requests || 0,
              total_tokens: stats?.total_tokens || 0,
              max_req_conversation: stats?.max_req_conversation || 0,
              max_token_conversation: stats?.max_token_conversation || 0,
              isActive: pConfig ? pConfig.is_enabled : true,
            };
          });

          setAccounts(enrichedAccounts);
          setAllAccounts(enrichedAccounts); // Store all accounts for email options
          setPagination(accountsResult.data.pagination);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [serverPort, searchQuery, period, offset, providerFilter, emailFilter],
  );

  useEffect(() => {
    if (serverPort) {
      fetchAccounts(1, pagination.limit);
    }
  }, [serverPort, fetchAccounts]);

  // Client-side filtering for ranges and multi-email
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Multi-email filter (client-side)
      if (emailFilter.length > 0) {
        const matchesEmail = emailFilter.some((email) =>
          acc.email?.toLowerCase().includes(email.toLowerCase()),
        );
        if (!matchesEmail) return false;
      }

      const totalReq = acc.total_requests || 0;
      const successReq = acc.successful_requests || 0;
      const totalTokens = acc.total_tokens || 0;

      // Success Rate calculation
      const successRate = totalReq > 0 ? (successReq / totalReq) * 100 : 0;

      if (successRateRange) {
        if (successRate < successRateRange[0] || successRate > successRateRange[1]) return false;
      }

      // Totals
      if (totalReqRange) {
        if (totalReq < totalReqRange[0] || totalReq > totalReqRange[1]) return false;
      }
      if (totalTokenRange) {
        if (totalTokens < totalTokenRange[0] || totalTokens > totalTokenRange[1]) return false;
      }

      return true;
    });
  }, [accounts, emailFilter, successRateRange, totalReqRange, totalTokenRange]);

  const executeDelete = async () => {
    if (!serverPort) return;
    setDeleteLoading(true);
    try {
      if (deleteItem) {
        const result = await callBackend(`/v1/accounts/${deleteItem.id}`, 'DELETE');
        if (result.success) {
          fetchAccounts(pagination.page, pagination.limit, true);
        }
      } else if (selectedAccounts.size > 0) {
        await Promise.all(
          Array.from(selectedAccounts).map((id) => callBackend(`/v1/accounts/${id}`, 'DELETE')),
        );
        setSelectedAccounts(new Set());
        fetchAccounts(pagination.page, pagination.limit, true);
      }
      setConfirmOpen(false);
      setDeleteItem(null);
    } catch (error) {
      console.error('Failed to delete accounts:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = (id: string, email?: string) => {
    setDeleteItem({ id, email });
    setConfirmOpen(true);
  };

  const handleBulkDelete = () => {
    setDeleteItem(null);
    setConfirmOpen(true);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedAccounts(newSelected);
  };

  const toggleAll = () => {
    if (selectedAccounts.size === accounts.length && accounts.length > 0) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(accounts.map((acc) => acc.id)));
    }
  };

  return {
    accounts: filteredAccounts, // Return filtered view
    rawAccounts: accounts, // Expose raw page
    allStats, // Expose all stats for global range calculation
    allAccounts, // Expose all accounts for email options
    loading,
    serverPort,
    providerConfigs,
    searchQuery,
    setSearchQuery,
    period,
    setPeriod,
    offset,
    setOffset,
    pagination,
    selectedAccounts,
    setSelectedAccounts,
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

    // New Filter States
    providerFilter,
    setProviderFilter,
    emailFilter,
    setEmailFilter,
    successRateRange,
    setSuccessRateRange,
    totalReqRange,
    setTotalReqRange,
    totalTokenRange,
    setTotalTokenRange,
    maxReqRange,
    setMaxReqRange,
    maxTokenRange,
    setMaxTokenRange,
  };
};
