import { invoke } from '@tauri-apps/api/core';

const getBackendPort = () => {
  const port = localStorage.getItem('ELARA_SERVER_PORT') || '8888';
  console.log('[Backend] Getting backend port:', port, '(from localStorage)');
  return port;
};

export const getBackendPortNumber = () => {
  const port = parseInt(getBackendPort());
  console.log('[Backend] Port number:', port);
  return port;
};

export const getBackendUrl = () => {
  const url = `http://localhost:${getBackendPort()}`;
  console.log('[Backend] Backend URL:', url);
  return url;
};

// Legacy support for existing calls
export const BACKEND_PORT = 8888;
export const BACKEND_URL = `http://localhost:8888`;

export const callBackend = async (url: string, method: string = 'GET', body?: any) => {
  // Always use remote mode (no check for Tauri-managed server)
  const fullUrl = `${getBackendUrl()}${url}`;
  console.log(`[Backend] Calling API: ${method} ${fullUrl}`);
  if (body) {
    console.log('[Backend] Request body:', JSON.stringify(body, null, 2));
  }
  
  try {
    const options: any = { method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    const response = await fetch(fullUrl, options);
    if (!response.ok) {
      console.error(`[Backend] Request failed: ${method} ${fullUrl} -> Status ${response.status}`);
      throw new Error(`Backend request failed with status ${response.status}`);
    }
    const data = await response.json();
    console.log(`[Backend] Response from ${fullUrl}:`, data);
    return data;
  } catch (error: any) {
    console.error(`[Backend] Call failed (${method} ${fullUrl}):`, error);
    return { success: false, error: error.message || String(error) };
  }
};
