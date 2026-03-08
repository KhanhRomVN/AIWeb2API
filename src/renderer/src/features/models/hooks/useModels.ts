import { useState, useEffect, useCallback } from 'react';
import { Provider, FlatModel, ModelSequence, SortKey, SortDirection, StatsPeriod } from '../types';
import { callBackend } from '../../../shared/utils/backend';

export const useModels = () => {
  const [flatModels, setFlatModels] = useState<FlatModel[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sequences, setSequences] = useState<ModelSequence[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('all');
  const [period, setPeriod] = useState<StatsPeriod>('day');
  const [offset, setOffset] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('none');

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [providersData, sequencesData, statsData] = await Promise.all([
          callBackend('/v1/providers'),
          callBackend('/v1/model-sequences'),
          callBackend(`/v1/stats?period=${period}&offset=${offset}`),
        ]);

        if (providersData.success) {
          const providersList: Provider[] = providersData.data;
          const modelStats = statsData.success ? statsData.data.models : [];

          setProviders(providersList);

          const models: FlatModel[] = [];
          providersList.forEach((provider) => {
            if (provider.models && provider.models.length > 0) {
              provider.models.forEach((model: any) => {
                const stats = modelStats.find(
                  (s: any) =>
                    s.model_id === (model.id || model.name) &&
                    s.provider_id === provider.provider_id,
                );

                models.push({
                  model_id: model.id || model.name,
                  model_name: model.name,
                  provider_id: provider.provider_id,
                  provider_name: provider.provider_name,
                  is_enabled: provider.is_enabled !== false,
                  is_thinking: model.is_thinking,
                  context_length: model.context_length,
                  success_rate: model.success_rate,
                  max_req_conversation: model.max_req_conversation,
                  max_token_conversation: stats?.max_token_conversation || 0, // Map from stats
                  website: provider.website,
                  usage_requests: stats?.total_requests || 0,
                  usage_tokens: stats?.total_tokens || 0,
                });
              });
            }
          });
          setFlatModels(models);
        }

        if (sequencesData.success) {
          setSequences(sequencesData.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [period, offset],
  );
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProviderId]);

  const getModelSequence = useCallback(
    (modelId: string, providerId: string): number | undefined => {
      const seq = sequences.find(
        (s: ModelSequence) =>
          s.model_id.toLowerCase() === modelId.toLowerCase() &&
          s.provider_id.toLowerCase() === providerId.toLowerCase(),
      );
      return seq?.sequence;
    },
    [sequences],
  );

  const getMaxSequence = useCallback((): number => {
    return sequences.length > 0 ? Math.max(...sequences.map((s: ModelSequence) => s.sequence)) : 0;
  }, [sequences]);

  const handleSetNextSequence = async (model: FlatModel) => {
    const nextSeq = getMaxSequence() + 1;
    try {
      const data = await callBackend('/v1/model-sequences', 'POST', {
        model_id: model.model_id,
        provider_id: model.provider_id,
        sequence: nextSeq,
      });
      if (data.success) {
        await fetchData(true);
      }
    } catch (error) {
      console.error('Failed to set sequence:', error);
    }
  };

  const handleRemoveSequence = async (model: FlatModel) => {
    try {
      const data = await callBackend(
        `/v1/model-sequences/${model.provider_id}/${model.model_id}`,
        'DELETE',
      );
      if (data.success) {
        await fetchData(true);
      }
    } catch (error) {
      console.error('Failed to remove sequence:', error);
    }
  };

  const insertSequence = async (modelId: string, providerId: string, sequence: number) => {
    try {
      const data = await callBackend('/v1/model-sequences/insert', 'POST', {
        model_id: modelId,
        provider_id: providerId,
        sequence,
      });
      if (data.success) {
        await fetchData(true);
      }
    } catch (error) {
      console.error('Failed to insert sequence:', error);
    }
  };

  // Filtering and Sorting logic
  const filteredModels = flatModels.filter((model) => {
    const matchesSearch =
      (model.model_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (model.provider_id?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesProvider =
      selectedProviderId === 'all' || model.provider_id === selectedProviderId;
    return matchesSearch && matchesProvider;
  });

  const sortedModels = [...filteredModels].sort((a, b) => {
    if (sortDirection !== 'none' && sortKey) {
      const valA = (a[sortKey as keyof FlatModel] as number) || 0;
      const valB = (b[sortKey as keyof FlatModel] as number) || 0;
      if (valA !== valB) return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
    const seqA = getModelSequence(a.model_id, a.provider_id);
    const seqB = getModelSequence(b.model_id, b.provider_id);
    if (seqA !== undefined && seqB !== undefined) return seqA - seqB;
    if (seqA !== undefined) return -1;
    if (seqB !== undefined) return 1;
    if (a.is_enabled !== b.is_enabled) return a.is_enabled ? -1 : 1;
    return a.model_id.localeCompare(b.model_id);
  });

  return {
    flatModels: sortedModels,
    providers,
    sequences,
    loading,
    searchQuery,
    setSearchQuery,
    selectedProviderId,
    setSelectedProviderId,
    period,
    setPeriod,
    offset,
    setOffset,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    fetchData,
    getModelSequence,
    getMaxSequence,
    handleSetNextSequence,
    handleRemoveSequence,
    insertSequence,
  };
};
