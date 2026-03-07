import { useState, useEffect, useMemo } from 'react';
import {
  Terminal,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Save,
  Activity,
  ArrowBigRightDash,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { Favicon } from '../../shared/utils/faviconUtils';
import { toast } from 'sonner';
import { fetchProviders, ProviderConfig } from '../../config/providers';
import { CustomSelect } from '../playground/components/CustomSelect';
import { callBackend } from '../../shared/utils/backend';

const MappingPage = () => {
  const [isCliInstalled, setIsCliInstalled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [baseUrlHistory, setBaseUrlHistory] = useState<string[]>([]);

  const [config, setConfig] = useState({
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    opus: 'claude-opus-4-5-20251101',
    sonnet: 'claude-sonnet-4-5-20250929',
    haiku: 'claude-haiku-4-5-20251001',
  });

  useEffect(() => {
    loadProviders();
    loadClaudeSettings();
  }, []);

  const loadClaudeSettings = async () => {
    try {
      const response = await callBackend('/v1/claudecode/settings');
      if (response.success && response.data) {
        setIsCliInstalled(response.data.installed);
        if (response.data.history) {
          setBaseUrlHistory(response.data.history);
        }
        if (response.data.settings?.env) {
          const env = response.data.settings.env;

          // Helper to find full ID (provider_id/model_id) from plain model_id
          const resolveFullId = (modelId: string, currentVal: string) => {
            if (!modelId) return currentVal;
            if (modelId.includes('/')) return modelId;
            // Try to find a match in the yet-to-be-loaded or loaded providers
            // If we can't find it now, we'll keep it as is
            return modelId;
          };

          setConfig((prev) => ({
            ...prev,
            baseUrl: env.ANTHROPIC_BASE_URL?.replace(/\/v1$/, '') || prev.baseUrl,
            apiKey: env.ANTHROPIC_AUTH_TOKEN || prev.apiKey,
            opus: resolveFullId(env.ANTHROPIC_DEFAULT_OPUS_MODEL, prev.opus),
            sonnet: resolveFullId(env.ANTHROPIC_DEFAULT_SONNET_MODEL, prev.sonnet),
            haiku: resolveFullId(env.ANTHROPIC_DEFAULT_HAIKU_MODEL, prev.haiku),
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load claude settings:', error);
    }
  };

  const loadProviders = async () => {
    try {
      const data = await fetchProviders();
      setProviders(data);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  const concurrentModels = useMemo(() => {
    const models: any[] = [];
    providers
      .filter((p) => p.concurrency_mode === 'concurrent')
      .forEach((p) => {
        if (p.models && Array.isArray(p.models)) {
          p.models.forEach((m) => {
            models.push({
              value: `${p.provider_id}/${m.id}`,
              label: `${p.provider_name} | ${m.name}`,
              icon: p.icon,
            });
          });
        }
      });
    return models;
  }, [providers]);

  const handleSave = async () => {
    try {
      setSaving(true);

      // 1. Save to Elara Config DB (for proxy logic)
      const configItems = {
        claudecode_main_model: config.sonnet, // Use Sonnet as main
        claudecode_opus_model: config.opus,
        claudecode_sonnet_model: config.sonnet,
        claudecode_haiku_model: config.haiku,
      };

      const dbResponse = await callBackend('/v1/config/values', 'PUT', configItems);

      if (!dbResponse.success) {
        throw new Error(dbResponse.error || 'Failed to save to database');
      }

      // 2. Save to ~/.claude/settings.json (for CLI tool)
      const cliEnv = {
        ANTHROPIC_BASE_URL: config.baseUrl,
        ANTHROPIC_AUTH_TOKEN: config.apiKey,
        ANTHROPIC_DEFAULT_OPUS_MODEL: config.opus,
        ANTHROPIC_DEFAULT_SONNET_MODEL: config.sonnet,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: config.haiku,
      };

      const cliResponse = await callBackend('/v1/claudecode/settings', 'POST', { env: cliEnv });

      if (!cliResponse.success) {
        throw new Error(cliResponse.error || 'Failed to update CLI settings');
      }

      // 3. Save History to DB
      await callBackend('/v1/config/values', 'PUT', {
        claudecode_base_url_history: JSON.stringify(baseUrlHistory),
      });

      toast.success('Configuration saved successfully');
    } catch (error: any) {
      console.error('Save failed:', error);
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset Claude Code settings to defaults? This will delete your current configuration file.',
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      const response = await callBackend('/v1/claudecode/settings', 'DELETE');
      if (response.success) {
        toast.success('Configuration reset successfully');
        // Reload default settings
        setConfig({
          baseUrl: 'https://api.anthropic.com',
          apiKey: '',
          opus: 'claude-opus-4-5-20251101',
          sonnet: 'claude-sonnet-4-5-20250929',
          haiku: 'claude-haiku-4-5-20251001',
        });
        await loadClaudeSettings();
      } else {
        throw new Error(response.message || 'Failed to reset configuration');
      }
    } catch (error: any) {
      console.error('Reset failed:', error);
      toast.error(error.message || 'Failed to reset configuration');
    } finally {
      setSaving(false);
    }
  };

  const renderModelMappingRow = (
    label: string,
    icon: React.ReactNode,
    defaultValue: string,
    currentValue: string,
    key: keyof typeof config,
    colorClass: string,
  ) => (
    <div className="space-y-4">
      <div className={cn('flex items-center gap-2', colorClass)}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <input
          readOnly
          value={defaultValue}
          className="flex-[1.2] bg-card border border-border/50 rounded-xl px-4 py-2.5 text-xs font-mono opacity-60 outline-none cursor-default"
        />
        <ArrowBigRightDash className="w-5 h-5 text-muted-foreground/40 shrink-0" />
        <div className="flex-1">
          <CustomSelect
            value={currentValue}
            onChange={(val) => setConfig({ ...config, [key]: val })}
            options={concurrentModels}
            placeholder="Select a model..."
            className="h-10 border-border bg-card rounded-xl px-4 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Split Header */}
      <div className="h-12 flex border-b border-border bg-card/50 backdrop-blur-xl shrink-0">
        {/* Left Side Header - Matches Sidebar Width */}
        <div className="w-72 border-r border-border flex items-center px-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">Mapping</h2>
        </div>

        {/* Right Side Header - Matches Content Width */}
        <div className="flex-1 flex items-center justify-between pl-4 pr-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-pink-500/10 flex items-center justify-center">
              <Favicon url="https://anthropic.com" size={14} />
            </div>
            <h2 className="text-sm font-bold tracking-tight">Claude Code Configuration</h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className={cn(
                'px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all border border-border bg-card/50 hover:bg-card hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all shadow-sm',
                saving
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]',
              )}
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tools List (Sidebar Style) */}
        <div className="w-72 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col shrink-0 h-full">
          <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {/* Claude Code Item */}
            <div
              className={cn(
                'flex items-center gap-3 py-3 px-4 mb-1 text-sm font-medium rounded-none transition-all relative group cursor-pointer',
                'text-foreground',
              )}
              style={{
                background: 'linear-gradient(to right, #ec489915, transparent)',
              }}
            >
              {/* Active Indicator Bar */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-lg"
                style={{ backgroundColor: '#ec4899' }}
              />

              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 overflow-hidden">
                <Favicon url="https://anthropic.com" size={18} className="rounded-sm" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold text-xs uppercase tracking-tight">
                    Claude Code
                  </span>
                  {isCliInstalled && (
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black uppercase text-emerald-500">LIVE</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/60 truncate leading-none mt-0.5">
                  Agentic coding tool for your terminal
                </p>
              </div>
            </div>
          </nav>
        </div>

        {/* Right Panel - Configuration (Full Width Grid) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
          <div className="p-8 pb-12">
            <div className="grid grid-cols-1 gap-y-10">
              {/* Row 1: Base URL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-pink-500">
                  <Terminal size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-widest">Base URL</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    readOnly
                    value="https://api.anthropic.com"
                    className="flex-[1.2] bg-card border border-border/50 rounded-xl px-4 py-2.5 text-xs font-mono opacity-60 outline-none cursor-default"
                  />
                  <ArrowBigRightDash className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1">
                    <CustomSelect
                      value={config.baseUrl}
                      onChange={(val) => setConfig({ ...config, baseUrl: val })}
                      onCreateOption={(newUrl) => {
                        if (newUrl && !baseUrlHistory.includes(newUrl)) {
                          setBaseUrlHistory((prev) => [...prev, newUrl]);
                          setConfig((prev) => ({ ...prev, baseUrl: newUrl }));
                        }
                      }}
                      options={baseUrlHistory.map((url) => ({
                        value: url,
                        label: url,
                      }))}
                      placeholder="Select or enter Base URL..."
                      className="h-10 border-border bg-card rounded-xl px-4 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: API Key */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-pink-500">
                  <ShieldCheck size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-widest">API Key</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    readOnly
                    value="sk-ant-..."
                    className="flex-[1.2] bg-card border border-border/50 rounded-xl px-4 py-2.5 text-xs font-mono opacity-60 outline-none cursor-default"
                  />
                  <ArrowBigRightDash className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-xs font-mono focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500/50 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Model Rows */}

              {renderModelMappingRow(
                'Model Alias: Opus',
                <ExternalLink size={14} />,
                'claude-3-opus-20240229',
                config.opus,
                'opus',
                'text-violet-500',
              )}

              {renderModelMappingRow(
                'Model Alias: Sonnet',
                <ExternalLink size={14} />,
                'claude-3-5-sonnet-20240620',
                config.sonnet,
                'sonnet',
                'text-violet-500',
              )}

              {renderModelMappingRow(
                'Model Alias: Haiku',
                <ExternalLink size={14} />,
                'claude-3-haiku-20240307',
                config.haiku,
                'haiku',
                'text-violet-500',
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MappingPage;
