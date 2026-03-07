import { useState, useEffect } from 'react';
import { Save, RefreshCw, Settings, Globe, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../shared/lib/utils';
import { useBackendConnection } from '../../core/contexts/BackendConnectionContext';

const SettingsPage = () => {
  const { isConnected, isServerRunning, stopServer, backendMode } = useBackendConnection();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialConfig, setInitialConfig] = useState({
    serverPort: '',
    apiUrl: '',
  });
  const [generalConfig, setGeneralConfig] = useState({
    serverPort: localStorage.getItem('ELARA_SERVER_PORT') || '8888',
    apiUrl: localStorage.getItem('ELARA_API_URL') || '',
  });

  useEffect(() => {
    const port = localStorage.getItem('ELARA_SERVER_PORT') || '8888';
    const url = localStorage.getItem('ELARA_API_URL') || '';
    setInitialConfig({ serverPort: port, apiUrl: url });
    setLoading(false);
  }, []);

  const hasChanges =
    generalConfig.serverPort !== initialConfig.serverPort ||
    generalConfig.apiUrl !== initialConfig.apiUrl;

  const saveGeneralConfig = async () => {
    try {
      setSaving(true);
      // Save General Config to localStorage
      localStorage.setItem('ELARA_SERVER_PORT', generalConfig.serverPort);
      if (generalConfig.apiUrl.trim()) {
        localStorage.setItem('ELARA_API_URL', generalConfig.apiUrl.trim());
      } else {
        localStorage.removeItem('ELARA_API_URL');
      }

      setInitialConfig({ ...generalConfig });
      window.dispatchEvent(new Event('storage')); // Notify other components
      window.dispatchEvent(new Event('elara-api-url-changed'));
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Failed to save general config:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-row bg-background">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col shrink-0 h-full transition-all">
        {/* Sidebar Header */}
        <div className="h-12 flex items-center px-6 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">Settings</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          <button
            className={cn(
              'w-full flex items-center gap-3 py-3 px-6 text-sm font-medium rounded-none transition-all relative group text-left text-foreground',
            )}
            style={{
              background: `linear-gradient(to right, #94a3b815, transparent)`,
            }}
          >
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-lg"
              style={{ backgroundColor: '#94a3b8' }}
            />
            <Settings className="w-5 h-5 flex-shrink-0 transition-colors text-[#94a3b8]" />
            <span>General</span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full">
        {/* Content HeaderBar */}
        <div className="h-12 flex items-center justify-between px-8 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            General Configuration
          </h2>

          {hasChanges && (
            <button
              onClick={saveGeneralConfig}
              disabled={saving}
              className={cn(
                'px-4 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all shadow-md animate-in fade-in slide-in-from-right-2 duration-300',
                saving
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95',
              )}
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? 'Updating...' : 'Update'}
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-row items-start gap-12">
              {/* Server Port Column */}
              <div
                className={cn(
                  'flex-1 space-y-4 transition-all duration-300',
                  backendMode === 'remote'
                    ? 'opacity-40 grayscale pointer-events-none'
                    : 'opacity-100',
                )}
              >
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Local Server Configuration <span className="text-destructive">*</span>
                  </label>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      disabled={backendMode === 'remote'}
                      value={generalConfig.serverPort}
                      onChange={(e) =>
                        setGeneralConfig({ ...generalConfig, serverPort: e.target.value })
                      }
                      placeholder="8888"
                      className={cn(
                        'w-full px-4 py-2.5 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm',
                        backendMode === 'remote' && 'bg-muted/30 border-transparent',
                      )}
                    />
                  </div>
                  {backendMode === 'local' && isServerRunning && (
                    <button
                      onClick={() => stopServer()}
                      className="p-2.5 h-[42px] w-[42px] rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm shrink-0 group flex items-center justify-center"
                      title="Shutdown Elara Server"
                    >
                      <PowerOff className="w-4 h-4 transition-transform group-hover:scale-110" />
                    </button>
                  )}
                </div>
                {backendMode === 'local' && isServerRunning && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 animate-in fade-in duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] text-emerald-600 font-bold uppercase">
                      Server is running on port {generalConfig.serverPort}
                    </p>
                  </div>
                )}
              </div>

              {/* Backend URL Column */}
              <div
                className={cn(
                  'flex-1 space-y-4 transition-all duration-300',
                  backendMode === 'local'
                    ? 'opacity-40 grayscale pointer-events-none'
                    : 'opacity-100',
                )}
              >
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Remote Backend API
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    disabled={backendMode === 'local'}
                    value={generalConfig.apiUrl}
                    onChange={(e) => setGeneralConfig({ ...generalConfig, apiUrl: e.target.value })}
                    placeholder="e.g. http://127.0.0.1:8888"
                    className={cn(
                      'w-full px-11 py-2.5 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono transition-all shadow-sm',
                      backendMode === 'local' && 'bg-muted/30 border-transparent',
                    )}
                  />
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                {backendMode === 'remote' && isConnected && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 animate-in fade-in duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <p className="text-[10px] text-blue-600 font-bold uppercase text-nowrap">
                      Connected to custom backend
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
