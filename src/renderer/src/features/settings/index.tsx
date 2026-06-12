import { useState, useEffect } from 'react';
import { Save, RefreshCw, Settings, Globe, PowerOff, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../shared/lib/utils';
import { useBackendConnection } from '../../core/contexts/BackendConnectionContext';

const SettingsPage = () => {
  const { isConnected, currentUrl } = useBackendConnection();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [initialUrl, setInitialUrl] = useState('');
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('ELARA_API_URL') || '');

  useEffect(() => {
    const url = localStorage.getItem('ELARA_API_URL') || '';
    setInitialUrl(url);
    setLoading(false);
  }, []);

  const hasChanges = apiUrl !== initialUrl;

  const saveGeneralConfig = async () => {
    try {
      setSaving(true);
      const trimmedUrl = apiUrl.trim();
      console.log('[Settings] ========== SAVE SETTINGS START ==========');
      console.log('[Settings] Raw input URL:', apiUrl);
      console.log('[Settings] Trimmed URL:', trimmedUrl);
      
      if (trimmedUrl) {
        // Save the full API URL
        localStorage.setItem('ELARA_API_URL', trimmedUrl);
        console.log('[Settings] Saved ELARA_API_URL:', trimmedUrl);
        
        // Extract port from URL using multiple methods
        let port = null;
        
        // Method 1: Match :port pattern
        const portMatch = trimmedUrl.match(/:(\d+)(?:\/|$)/);
        if (portMatch && portMatch[1]) {
          port = portMatch[1];
          console.log('[Settings] Method 1 (regex) found port:', port);
        }
        
        // Method 2: Parse URL object (more reliable)
        try {
          const urlObj = new URL(trimmedUrl);
          if (urlObj.port) {
            port = urlObj.port;
            console.log('[Settings] Method 2 (URL API) found port:', port);
          } else if (urlObj.protocol === 'http:' && !urlObj.port) {
            port = '80';
            console.log('[Settings] Method 2: default HTTP port 80');
          } else if (urlObj.protocol === 'https:' && !urlObj.port) {
            port = '443';
            console.log('[Settings] Method 2: default HTTPS port 443');
          }
        } catch (urlError) {
          console.error('[Settings] Failed to parse URL:', urlError);
        }
        
        if (port) {
          localStorage.setItem('ELARA_SERVER_PORT', port);
          console.log('[Settings] ✓ Synced ELARA_SERVER_PORT to:', port);
          console.log('[Settings] ✓ Final ELARA_SERVER_PORT:', localStorage.getItem('ELARA_SERVER_PORT'));
        } else {
          // URL doesn't contain a port? Use default 8888
          console.warn('[Settings] ✗ Could not extract port from URL:', trimmedUrl);
          localStorage.setItem('ELARA_SERVER_PORT', '8888');
          console.log('[Settings] Set default ELARA_SERVER_PORT to 8888');
        }
        
        // Verify both keys are set correctly
        console.log('[Settings] Verification - ELARA_API_URL:', localStorage.getItem('ELARA_API_URL'));
        console.log('[Settings] Verification - ELARA_SERVER_PORT:', localStorage.getItem('ELARA_SERVER_PORT'));
      } else {
        // Empty URL - remove both keys
        localStorage.removeItem('ELARA_API_URL');
        localStorage.removeItem('ELARA_SERVER_PORT');
        console.log('[Settings] Removed both ELARA_API_URL and ELARA_SERVER_PORT');
      }

      setInitialUrl(apiUrl);
      window.dispatchEvent(new Event('storage')); // Notify other components
      window.dispatchEvent(new Event('elara-api-url-changed'));
      toast.success('Settings updated successfully');
      console.log('[Settings] ========== SAVE SETTINGS END ==========');
    } catch (error) {
      console.error('[Settings] Failed to save general config:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!apiUrl.trim()) {
      toast.error('Please enter an API URL first');
      return;
    }

    setTesting(true);
    const testUrl = apiUrl.trim().replace(/\/$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${testUrl}/v1/health`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const isOfficial = data.elara === 'khanhromvn/elara';
        
        if (data.status === 'ok' && isOfficial) {
          toast.success(
            <div>
              <div className="font-bold">✓ Connection successful!</div>
              <div className="text-xs opacity-80 mt-1">
                Server: {data.elara || 'Unknown'}<br />
                Status: {data.status}<br />
                Version: {data.version || 'N/A'}
              </div>
            </div>,
            { duration: 5000 }
          );
        } else {
          toast.error('Connected but server is not elara-server');
        }
      } else {
        toast.error(`Connection failed: HTTP ${response.status}`);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        toast.error('Connection timeout (5s) - Server not responding');
      } else if (error.message === 'Failed to fetch') {
        toast.error('Cannot connect to server - Make sure server is running');
      } else {
        toast.error(`Connection error: ${error.message}`);
      }
    } finally {
      setTesting(false);
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
          <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              {/* Backend URL Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Remote Backend API
                  </label>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="e.g. http://127.0.0.1:8888"
                      className="w-full px-11 py-2.5 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono transition-all shadow-sm"
                    />
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  <button
                    onClick={testConnection}
                    disabled={testing}
                    className={cn(
                      'px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm',
                      testing
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground active:scale-95'
                    )}
                  >
                    {testing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                    {testing ? 'Testing...' : 'Test'}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                  Current connection:{' '}
                  <span
                    className={cn('font-bold', isConnected ? 'text-emerald-500' : 'text-red-500')}
                  >
                    {currentUrl}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
