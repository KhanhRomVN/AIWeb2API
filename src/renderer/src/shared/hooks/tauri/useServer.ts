import { invoke } from '@tauri-apps/api/core';
import { callBackend } from '../../utils/backend';

export const useServer = () => {
  const startServer = async () => {
    const port = localStorage.getItem('ELARA_SERVER_PORT') || '8888';
    try {
      const res = await fetch(`http://localhost:${port}/v1/health`);
      if (res.ok) {
        return { success: true, port: parseInt(port) };
      }
    } catch (e) {
      // ignore
    }
    return {
      success: false,
      port: parseInt(port),
      message: 'Elara-server is not running. Please start it manually via "elara-server".',
    };
  };

  const stopServer = async () => {
    return { success: false, message: 'Server management is disabled in remote-only mode.' };
  };

  const getStatus = () => Promise.resolve(false);
  const getPlatformInfo = () => invoke('get_platform_info');
  const saveEnvToSystem = (envVars: Record<string, string>) =>
    invoke('save_env_to_system', { envVars });

  const getEnv = (key: string) => callBackend(`/v1/server/env?key=${key}`);
  const checkSystemEnv = () => invoke('check_system_env');
  const restoreEnvDefaults = () => invoke('restore_env_defaults');

  const getConfigValues = (keys: string) => callBackend(`/v1/config/values?keys=${keys}`);
  const saveConfigValues = (values: Record<string, string>) =>
    callBackend('/v1/config/values', 'PUT', values);

  const getClaudeCodeSyncStatus = (url: string) =>
    callBackend(`/v1/server/claudecode-sync-status?url=${encodeURIComponent(url)}`);
  const executeClaudeCodeSync = (options: any) =>
    callBackend('/v1/server/claudecode-sync', 'POST', options);
  const executeClaudeCodeRestore = () => callBackend('/v1/server/claudecode-restore', 'POST');

  return {
    startServer,
    stopServer,
    getStatus,
    getPlatformInfo,
    saveEnvToSystem,
    getEnv,
    checkSystemEnv,
    restoreEnvDefaults,
    getConfigValues,
    saveConfigValues,
    getClaudeCodeSyncStatus,
    executeClaudeCodeSync,
    executeClaudeCodeRestore,
  };
};
