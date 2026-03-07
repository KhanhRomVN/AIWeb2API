import { invoke } from '@tauri-apps/api/core';

const getBackendPort = () => localStorage.getItem('ELARA_SERVER_PORT') || '8888';
export const getBackendPortNumber = () => parseInt(getBackendPort());
export const getBackendUrl = () => `http://localhost:${getBackendPort()}`;

// Legacy support for existing calls
export const BACKEND_PORT = 8888;
export const BACKEND_URL = `http://localhost:8888`;

export const callBackend = async (url: string, method: string = 'GET', body?: any) => {
  const mode = localStorage.getItem('ELARA_BACKEND_MODE') || 'local';

  // 1. Strict check for Local Mode: server MUST be managed by Tauri
  if (mode === 'local') {
    try {
      const isManagedRunning = await invoke<boolean>('server_get_status');
      if (!isManagedRunning) {
        console.warn(`[Backend] Call to ${url} blocked: Local server not managed/running.`);
        return { success: false, error: 'Local server not started' };
      }
    } catch (e) {
      console.error('[Backend] Failed to verify managed server status:', e);
      return { success: false, error: 'Security check failed' };
    }
  }

  try {
    const options: any = { method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${getBackendUrl()}${url}`, options);
    if (!response.ok) {
      throw new Error(`Backend request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error(`Backend call failed (${url}):`, error);
    return { success: false, error: error.message || String(error) };
  }
};
