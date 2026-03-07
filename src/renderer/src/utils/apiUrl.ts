export const getApiBaseUrl = (forcedPort?: number | string): string => {
  // 1. Check current backend mode
  const mode = localStorage.getItem('ELARA_BACKEND_MODE') || 'local';

  // 2. If remote, check for custom API URL
  if (mode === 'remote') {
    const customUrl = localStorage.getItem('ELARA_API_URL');
    if (customUrl) return customUrl;
  }

  // 3. For local mode (or fallback), check for configured Port or forced port
  const configuredPort = localStorage.getItem('ELARA_SERVER_PORT');
  const port = forcedPort || configuredPort || import.meta.env.VITE_BACKEND_PORT || 8888;

  // Default to localhost for local mode
  return `http://localhost:${port}`;
};
