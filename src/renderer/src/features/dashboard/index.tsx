import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Zap,
  Database,
  Activity,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { SummaryCard } from './components/SummaryCard';
import { UsageChart } from './components/UsageChart';
import { ModelPieChart } from './components/ModelPieChart';
import { MiniTable } from './components/MiniTable';
import { Favicon } from '../../shared/utils/faviconUtils';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from '../../shared/components/ui/dropdown';
import { useStats } from '../../shared/hooks/tauri/useStats';
import { cn } from '../../shared/lib/utils';

interface StatsData {
  usage?: any[];
  accounts: any[];
  models: any[];
  providers?: any[];
  isBulk?: boolean;
}

const Dashboard = () => {
  const { getStats } = useStats();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [offset, setOffset] = useState(0);

  // Main centralized data fetch with caching
  const { data, isLoading, error } = useQuery<StatsData>({
    queryKey: ['stats', period, offset],
    queryFn: async () => {
      const res = (await getStats(period, offset)) as any;
      return res.data as StatsData;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in garbage collection for 30 minutes
  });

  const handlePeriodChange = useCallback((newPeriod: any) => setPeriod(newPeriod), []);
  const handlePrev = useCallback(() => setOffset((prev) => prev + 1), []);
  const handleNext = useCallback(() => setOffset((prev) => Math.max(0, prev - 1)), []);

  // Calculate Summary Metrics
  const { totalRequests, totalTokens, favoriteModel, favoriteTime } = useMemo(() => {
    const usage = data?.usage || [];
    const models = data?.models || [];

    // Accurate totals from global history
    const requests = usage.reduce((sum: number, h: any) => sum + (h.requests || 0), 0) || 0;
    const tokens = usage.reduce((sum: number, h: any) => sum + (h.tokens || 0), 0) || 0;

    // Handle empty state
    if (requests === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        favoriteModel: 'None',
        favoriteTime: 'None',
      };
    }

    // Find model with most requests
    const favModel =
      models.length > 0
        ? [...models].sort((a, b) => b.total_requests - a.total_requests)[0]?.model_id
        : 'None';

    // Find time period with most requests (Favorite Time)
    const favTimeEntry = [...usage].sort((a, b) => (b.requests || 0) - (a.requests || 0))[0];

    let favTime = 'None';
    if (favTimeEntry) {
      if (period === 'day') {
        favTime = favTimeEntry.date; // e.g., "14:00"
      } else if (period === 'week' || period === 'month') {
        // Format date: "YYYY-MM-DD" -> "DD/MM"
        const parts = favTimeEntry.date.split('-');
        favTime = parts.length === 3 ? `${parts[2]}/${parts[1]}` : favTimeEntry.date;
      } else {
        // Format month: "YYYY-MM" -> "Tháng MM"
        const parts = favTimeEntry.date.split('-');
        favTime = parts.length === 2 ? `Tháng ${parts[1]}` : favTimeEntry.date;
      }
    }

    return {
      totalRequests: requests,
      totalTokens: tokens,
      favoriteModel: favModel,
      favoriteTime: favTime,
    };
  }, [data?.usage, data?.models, period]);

  // Prepare Chart Data from real metrics
  const displayChartData = useMemo(() => {
    return (data?.usage || []).map((h: any) => ({
      date: h.date,
      requests: h.requests,
      tokens: h.tokens,
      providers: h.providers || [], // Backend might need to add this if tooltip breakdown is needed
    }));
  }, [data?.usage]);

  // Prepare Provider Map for easy lookup
  const providerMap = useMemo(() => {
    return (
      data?.providers?.reduce((acc: any, p: any) => {
        acc[p.provider_id] = p;
        return acc;
      }, {}) || {}
    );
  }, [data?.providers]);

  // Prepare Pie Data
  const pieData = useMemo(() => {
    const sourceData = data?.models || [];
    const providerStats =
      sourceData.reduce((acc: any, m: any) => {
        acc[m.provider_id] = (acc[m.provider_id] || 0) + m.total_requests;
        return acc;
      }, {}) || {};

    return Object.entries(providerStats)
      .map(([name, value]) => ({
        name,
        value,
        website: providerMap[name]?.website,
      }))
      .filter((d: any) => (d.value as number) > 0);
  }, [data?.models, providerMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">Error loading dashboard: {(error as Error).message}</div>
    );
  }

  const renderTableFilter = (current: any, setter: any) => (
    <Dropdown size="sm">
      <DropdownTrigger className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:text-primary transition-colors bg-input px-2.5 py-1.5 rounded-md">
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
            onClick={() => setter(p)}
            className="text-xs hover:bg-dropdown-itemHover transition-colors"
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );

  const SectionHeader = ({
    icon: Icon,
    title,
    color,
  }: {
    icon: any;
    title: string;
    color: string;
  }) => (
    <div className="flex items-center gap-2 px-6 py-4 border-b border-border/50 bg-card/30">
      <Icon size={16} className={color.replace('bg-', 'text-')} />
      <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/80">{title}</h3>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-xl shrink-0 sticky top-0 z-10 transition-all">
        <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
        <div className="flex items-center gap-2">
          {renderTableFilter(period, setPeriod)}
          <div className="flex items-center gap-1 ml-1 bg-input rounded-md p-1">
            <button
              onClick={handlePrev}
              className="p-1 hover:bg-dropdown-itemHover rounded transition-colors text-text-secondary hover:text-primary"
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
                  : 'hover:bg-dropdown-itemHover text-text-secondary hover:text-primary',
              )}
              title="Next Period"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* Summary Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard
            title="Total Requests"
            value={totalRequests.toLocaleString()}
            icon={Zap}
            color="text-violet-500"
            className="bg-card/50 border-border/50"
          />
          <SummaryCard
            title="Total Tokens"
            value={
              totalTokens > 1000000
                ? (totalTokens / 1000000).toFixed(2) + 'M'
                : totalTokens.toLocaleString()
            }
            icon={Activity}
            color="text-emerald-500"
            className="bg-card/50 border-border/50"
          />
          <SummaryCard
            title="Favorite Model"
            value={favoriteModel}
            icon={Box}
            color="text-blue-500"
            className="bg-card/50 border-border/50"
          />
          <SummaryCard
            title="Favorite Time"
            value={favoriteTime}
            icon={Clock}
            color="text-rose-500"
            className="bg-card/50 border-border/50"
          />
          <SummaryCard
            title="Active Accounts"
            value={(data?.accounts?.length || 0).toString()}
            icon={Database}
            color="text-amber-500"
            className="bg-card/50 border-border/50"
          />
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4 rounded-2xl border border-border/50 bg-card/40 shadow-sm overflow-hidden flex flex-col">
            <SectionHeader icon={Activity} title="Usage Analytics" color="bg-violet-500" />
            <div className="p-2 pt-4">
              <UsageChart
                data={displayChartData}
                title=""
                period={period}
                offset={offset}
                onPeriodChange={handlePeriodChange}
                onPrev={handlePrev}
                onNext={handleNext}
                className="border-0 shadow-none bg-transparent p-0"
              />
            </div>
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-border/50 bg-card/40 shadow-sm overflow-hidden flex flex-col relative">
            <SectionHeader icon={Box} title="Provider Distribution" color="bg-amber-500" />
            <div className="p-2 flex-1 flex items-center justify-center min-h-[300px]">
              <ModelPieChart
                data={pieData}
                title=""
                className="border-0 shadow-none bg-transparent p-0 w-full"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
          <div className="rounded-2xl border border-border/50 bg-card/40 shadow-sm overflow-hidden flex flex-col relative">
            <SectionHeader icon={Zap} title="Account Performance" color="bg-emerald-500" />
            <MiniTable
              title=""
              data={data?.accounts || []}
              className="border-0 shadow-none bg-transparent p-0"
              columns={[
                { header: 'Email', accessorKey: 'email', className: 'max-w-[150px] truncate' },
                {
                  header: 'Provider',
                  accessorKey: 'provider_id',
                  className: 'text-center',
                  cell: (item) => {
                    const provider = providerMap[item.provider_id];
                    return (
                      <div className="flex items-center gap-2 justify-center">
                        <Favicon url={provider?.website} size={14} />
                        <span className="capitalize text-[11px] font-medium">
                          {item.provider_id}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  header: 'Success | Req | Token',
                  accessorKey: 'metrics',
                  className: 'text-center',
                  cell: (item) => {
                    const rate =
                      item.total_requests > 0
                        ? (item.successful_requests / item.total_requests) * 100
                        : 0;
                    const tokens =
                      item.total_tokens > 1000
                        ? (item.total_tokens / 1000).toFixed(1) + 'k'
                        : item.total_tokens;
                    return (
                      <div className="flex items-center gap-1.5 text-[11px] justify-center">
                        <span
                          className={`font-bold ${rate > 90 ? 'text-emerald-500' : 'text-amber-500'}`}
                        >
                          {rate.toFixed(0)}%
                        </span>
                        <span className="text-muted-foreground/30">|</span>
                        <span className="font-medium text-foreground">{item.total_requests}</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span className="font-medium text-violet-400">{tokens}</span>
                      </div>
                    );
                  },
                },
              ]}
            />
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/40 shadow-sm overflow-hidden flex flex-col relative">
            <SectionHeader icon={Database} title="Model Usage" color="bg-blue-500" />
            <MiniTable
              title=""
              data={data?.models || []}
              className="border-0 shadow-none bg-transparent p-0"
              columns={[
                {
                  header: 'Model ID',
                  accessorKey: 'model_id',
                  className: 'max-w-[150px] truncate font-medium',
                },
                {
                  header: 'Provider',
                  accessorKey: 'provider_id',
                  className: 'text-center uppercase text-[10px] font-bold opacity-60',
                },
                {
                  header: 'Totals (Req|Token)',
                  accessorKey: 'totals',
                  className: 'text-center',
                  cell: (item) => (
                    <div className="flex items-center gap-1.5 text-[11px] justify-center">
                      <span className="text-foreground font-bold">{item.total_requests}</span>
                      <span className="text-muted-foreground/30">|</span>
                      <span className="text-violet-400 font-bold">
                        {(item.total_tokens / 1000).toFixed(1)}k
                      </span>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
