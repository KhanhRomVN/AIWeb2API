import { useEffect, useRef } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { routes } from './core/routes/routes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './core/theme/ThemeProvider';
import { Toaster } from 'sonner';

import {
  BackendConnectionProvider,
  useBackendConnection,
} from './core/contexts/BackendConnectionContext';
import { UIProvider } from './core/contexts/UIContext';
import { useServer } from './shared/hooks/tauri/useServer';
import { toast } from 'sonner';
import { getApiBaseUrl } from './utils/apiUrl';

function AppContent() {
  const router = createHashRouter(routes);
  const initialized = useRef(false);
  const { getStatus } = useServer();
  const { checkConnection, backendMode, isServerRunning } = useBackendConnection();

  useEffect(() => {
    // Prevent double-initialization in React 18 Strict Mode and during hot reloads
    if (initialized.current) return;
    initialized.current = true;

    const initApp = async () => {
      const url = getApiBaseUrl();
      const isLocal = backendMode === 'local';

      // 1. Check if backend is Elara-compatible
      let backendInfo: any = null;
      try {
        const res = await fetch(`${url}/v1/health`);
        if (res.ok) {
          backendInfo = await res.json();
        }
      } catch (e) {
        // ignore
      }

      const isElara = backendInfo?.status === 'ok';
      const isOfficial = backendInfo?.elara === 'khanhromvn/elara';

      if (isLocal) {
        if (isElara) {
          const isManagedStatus = await getStatus();
          if (isOfficial && isManagedStatus) {
            console.log('[App] Official elara-server already running and managed.');
          } else if (isOfficial && !isManagedStatus) {
            console.warn('[App] Official elara-server detected but not managed by this session.');
          } else if (!isOfficial) {
            toast.warning(
              'Phát hiện backend Elara tùy chỉnh trên port Local. Vui lòng chuyển sang Remote Mode để hoạt động chính xác nhất.',
              { duration: 5000 },
            );
            console.warn('[App] Custom Elara backend detected in Local Mode.');
          }
        }
        await checkConnection();
      } else {
        // Remote Mode
        console.log('[App] Remote mode active, verifying connection...');
        if (!isElara) {
          toast.error('Không thể kết nối với Elara backend tại địa chỉ Remote này.');
        } else if (!isOfficial) {
          console.log('[App] Connected to custom Remote Elara backend.');
        } else {
          console.log('[App] Connected to official Remote Elara backend.');
        }
        await checkConnection();
      }
    };
    initApp();
  }, [backendMode, getStatus, checkConnection, isServerRunning]);

  return <RouterProvider router={router} />;
}

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BackendConnectionProvider>
        <UIProvider>
          <ThemeProvider defaultTheme="dark" storageKey="syfer-theme">
            <AppContent />
            <Toaster />
          </ThemeProvider>
        </UIProvider>
      </BackendConnectionProvider>
    </QueryClientProvider>
  );
}

export default App;
