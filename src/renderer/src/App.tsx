import { useEffect, useRef } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { routes } from './core/routes/routes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './core/theme/ThemeProvider';
import { Toaster } from 'sonner';
import { GlobalPackageCheck } from './core/components/GlobalPackageCheck';

import {
  BackendConnectionProvider,
  useBackendConnection,
} from './core/contexts/BackendConnectionContext';
import { UIProvider } from './core/contexts/UIContext';
import { toast } from 'sonner';
import { getApiBaseUrl } from './utils/apiUrl';

function AppContent() {
  const router = createHashRouter(routes);
  const initialized = useRef(false);
  const { checkConnection } = useBackendConnection();

  useEffect(() => {
    // Prevent double-initialization in React 18 Strict Mode and during hot reloads
    if (initialized.current) return;
    initialized.current = true;

    const initApp = async () => {
      const url = getApiBaseUrl();

      // Verify connection to the remote backend
      try {
        const res = await fetch(`${url}/v1/health`);
        if (res.ok) {
          const backendInfo = await res.json();
          if (backendInfo?.elara === 'khanhromvn/elara') {
          }
        } else {
          toast.error('Không thể kết nối với Elara backend tại địa chỉ này.');
        }
      } catch (e) {
        toast.error('Lỗi kết nối server backend.');
        console.error('[App] Connection error:', e);
      }

      await checkConnection();
    };
    initApp();
  }, [checkConnection]);

  return <RouterProvider router={router} />;
}

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BackendConnectionProvider>
        <UIProvider>
          <ThemeProvider defaultTheme="dark" storageKey="syfer-theme">
            <GlobalPackageCheck />
            <AppContent />
            <Toaster />
          </ThemeProvider>
        </UIProvider>
      </BackendConnectionProvider>
    </QueryClientProvider>
  );
}

export default App;
