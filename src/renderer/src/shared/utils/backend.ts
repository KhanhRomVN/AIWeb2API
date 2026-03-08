import { invoke } from '@tauri-apps/api/core';

const getBackendPort = () => localStorage.getItem('ELARA_SERVER_PORT') || '8888';
export const getBackendPortNumber = () => parseInt(getBackendPort());
export const getBackendUrl = () => `http://localhost:${getBackendPort()}`;

// Legacy support for existing calls
export const BACKEND_PORT = 8888;
export const BACKEND_URL = `http://localhost:8888`;

export const callBackend = async (url: string, method: string = 'GET', body?: any) => {
  // Always use remote mode (no check for Tauri-managed server)
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
