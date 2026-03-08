import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
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
  serverUpdate: {
    available: boolean;
    current?: string;
    latest?: string;
    message?: string;
  } | null;
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
  const [serverUpdate, setServerUpdate] = useState<{
    available: boolean;
    current?: string;
    latest?: string;
    message?: string;
  } | null>(null);
  const isCheckingRef = useRef(isChecking);

  // Keep ref in sync
  useEffect(() => {
    isCheckingRef.current = isChecking;
  }, [isChecking]);

  const checkConnection = useCallback(async () => {
    if (isCheckingRef.current) return;

    const url = getApiBaseUrl();

    setCurrentUrl(url);
    setIsChecking(true);

    const performCheck = async (retries = 2): Promise<{ isReachable: boolean; update?: any }> => {
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
          const update = data._elara_update;
          return {
            isReachable: data.status === 'ok' && isOfficial,
            update,
          };
        }
      } catch (e) {
        // ignore
      }

      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return performCheck(retries - 1);
      }
      return { isReachable: false };
    };

    const result = await performCheck();
    setIsConnected(result.isReachable);
    setServerUpdate(result.update || null);
    setIsServerRunning(false); // Local server management is disabled

    setIsChecking(false);

    // Update from localStorage
    const port = parseInt(localStorage.getItem('ELARA_SERVER_PORT') || '8888');
    setServerPort(port);
  }, []);

  const stopServer = useCallback(async () => {
    // Disabled in remote-only mode
  }, []);

  const startServer = useCallback(async () => {
    // Disabled in remote-only mode
  }, []);

  const setBackendMode = useCallback((_mode: 'local' | 'remote') => {
    // Disabled in remote-only mode: backend is always remote
  }, []);

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
        backendMode: 'remote',
        setBackendMode,
        stopServer,
        startServer,
        serverError: null,
        serverUpdate,
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
