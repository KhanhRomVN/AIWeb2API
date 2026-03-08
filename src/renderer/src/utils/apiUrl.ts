export const getApiBaseUrl = (forcedPort?: number | string): string => {
  // 1. Check for custom API URL (e.g., if set in remote mode settings)
  const customUrl = localStorage.getItem('ELARA_API_URL');
  if (customUrl) return customUrl;

  // 2. Fallback to localhost with configured or default port
  const configuredPort = localStorage.getItem('ELARA_SERVER_PORT');
  const port = forcedPort || configuredPort || import.meta.env.VITE_BACKEND_PORT || 8888;

  return `http://localhost:${port}`;
};
