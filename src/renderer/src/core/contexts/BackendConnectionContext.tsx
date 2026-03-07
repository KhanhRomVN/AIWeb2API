import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getApiBaseUrl } from '../../utils/apiUrl';

interface BackendConnectionContextType {
  isConnected: boolean;
  isChecking: boolean;
  checkConnection: () => Promise<void>;
  currentUrl: string;
  isServerRunning: boolean;
  serverPort: number;
  backendMode: 'local' | 'remote';
  setBackendMode: (mode: 'local' | 'remote') => void;
  stopServer: () => Promise<void>;
  startServer: () => Promise<void>;
  serverError: string | null;
}

const BackendConnectionContext = createContext<BackendConnectionContextType | undefined>(undefined);

const CHECK_INTERVAL = 5000; // Check every 5 seconds
const HEALTH_ENDPOINT = '/v1/health';
export const BackendConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(getApiBaseUrl());
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState(
    parseInt(localStorage.getItem('ELARA_SERVER_PORT') || '8888'),
  );
  const [backendMode, setBackendModeState] = useState<'local' | 'remote'>(
    (localStorage.getItem('ELARA_BACKEND_MODE') as 'local' | 'remote') || 'local',
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const isCheckingRef = useRef(isChecking);

  // Keep ref in sync
  useEffect(() => {
    isCheckingRef.current = isChecking;
  }, [isChecking]);

  const checkConnection = useCallback(async () => {
    if (isCheckingRef.current) return;

    const url = getApiBaseUrl();
    const mode = (localStorage.getItem('ELARA_BACKEND_MODE') as 'local' | 'remote') || 'local';

    setCurrentUrl(url);
    setIsChecking(true);

    const performCheck = async (retries = 2): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${url}${HEALTH_ENDPOINT}`, {
          signal: controller.signal,
          method: 'GET',
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          // Verify if it's the official elara-server
          const isOfficial = data.elara === 'khanhromvn/elara';
          return data.status === 'ok' && (mode === 'remote' || isOfficial);
        }
      } catch (e) {
        // ignore
      }

      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return performCheck(retries - 1);
      }
      return false;
    };

    const isReachable = await performCheck();

    // Double check: if Local Mode, server MUST be managed by Tauri
    let managedRunning = false;
    try {
      managedRunning = await invoke<boolean>('server_get_status');
      setIsServerRunning(managedRunning);
    } catch (e) {
      console.error('Failed to get server status:', e);
    }

    if (mode === 'local') {
      setIsConnected(isReachable && managedRunning);
    } else {
      setIsConnected(isReachable);
    }

    setIsChecking(false);

    // Update from localStorage
    const port = parseInt(localStorage.getItem('ELARA_SERVER_PORT') || '8888');
    setServerPort(port);
    setBackendModeState(mode);
  }, []);

  const stopServer = useCallback(async () => {
    try {
      await invoke('server_stop');
      setIsServerRunning(false);
      localStorage.setItem('ELARA_SERVER_MANUAL_STOP', 'true');
      checkConnection();
    } catch (e) {
      console.error('Failed to stop server:', e);
      throw e;
    }
  }, [checkConnection]);

  const startServer = useCallback(async () => {
    const port = localStorage.getItem('ELARA_SERVER_PORT') || '8888';
    setServerError(null);
    try {
      localStorage.removeItem('ELARA_SERVER_MANUAL_STOP');
      const result = await invoke<string>('server_start', { port: parseInt(port) });
      setIsServerRunning(true);
      checkConnection();
    } catch (e: any) {
      setIsServerRunning(false);
      const errorMsg = e?.toString() || 'Failed to start server';
      setServerError(errorMsg.includes('Port') ? 'Port already in use' : 'Error starting server');

      // Auto-hide error after 1 second
      setTimeout(() => {
        setServerError(null);
      }, 1000);

      console.error('[Frontend] Failed to start server:', e);
      throw e;
    }
  }, [checkConnection]);

  const setBackendMode = useCallback(
    (mode: 'local' | 'remote') => {
      localStorage.setItem('ELARA_BACKEND_MODE', mode);
      setBackendModeState(mode);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('elara-backend-mode-changed'));

      // If switching to remote and server is running, stop it
      if (mode === 'remote' && isServerRunning) {
        stopServer();
      }

      // Refresh connection status immediately
      checkConnection();
    },
    [isServerRunning, stopServer, checkConnection],
  );

  useEffect(() => {
    checkConnection();
    const interval = setInterval(() => {
      checkConnection();
    }, CHECK_INTERVAL);
    return () => {
      clearInterval(interval);
    };
  }, [checkConnection]);

  // Listen for storage changes (in case settings update URL)
  useEffect(() => {
    const handleStorageChange = () => {
      checkConnection();
    };
    window.addEventListener('storage', handleStorageChange);
    // Custom event for internal updates
    window.addEventListener('elara-api-url-changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('elara-api-url-changed', handleStorageChange);
    };
  }, [checkConnection]);

  return (
    <BackendConnectionContext.Provider
      value={{
        isConnected,
        isChecking,
        checkConnection,
        currentUrl,
        isServerRunning,
        serverPort,
        backendMode,
        setBackendMode,
        stopServer,
        startServer,
        serverError,
      }}
    >
      {children}
    </BackendConnectionContext.Provider>
  );
};

export const useBackendConnection = () => {
  const context = useContext(BackendConnectionContext);
  if (context === undefined) {
    throw new Error('useBackendConnection must be used within a BackendConnectionProvider');
  }
  return context;
};
