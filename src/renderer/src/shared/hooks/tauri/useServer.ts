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
    console.log(`[useServer] Starting server on port ${port}...`);
    try {
      const res = await invoke<string>('server_start', { port: parseInt(port) });
      console.log('[useServer] Server start command executed successfully:', res);
      return { success: true, port: parseInt(port), message: res };
    } catch (e) {
      console.error('[useServer] Failed to start server via Tauri invoke:', e);
      return {
        success: false,
        port: parseInt(port),
        message:
          typeof e === 'string'
            ? e
            : 'Failed to start elara-server. Ensure it is installed globally via npm.',
      };
    }
  };

  const stopServer = () => invoke('server_stop');
  const getStatus = () => invoke('server_get_status');
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

  const checkServerVersion = async () => {
    try {
      // 1. Get installed version
      const listCmd = 'npm list -g @khanhromvn/elara-server --json';
      const listOutput = await invoke<string>('shell_execute', { command: listCmd });
      let installedVersion = '0.0.0';
      try {
        const listData = JSON.parse(listOutput);
        installedVersion =
          listData.dependencies?.['@khanhromvn/elara-server']?.version ||
          listData.dependencies?.['elara-server']?.version ||
          '0.0.0';
      } catch (e) {
        // Fallback to regex if JSON parse fails
        const match = listOutput.match(/@(?:khanhromvn\/)?elara-server@([\d\.]+)/);
        if (match) installedVersion = match[1];
      }

      // 2. Get latest version
      const viewCmd = 'npm view @khanhromvn/elara-server version';
      const latestVersion = (await invoke<string>('shell_execute', { command: viewCmd })).trim();

      return {
        isMatch: installedVersion === latestVersion,
        installedVersion,
        latestVersion,
      };
    } catch (error) {
      console.error('Failed to check server version:', error);
      return {
        isMatch: true, // Fail-safe: don't block if we can't check
        installedVersion: 'unknown',
        latestVersion: 'unknown',
        error: String(error),
      };
    }
  };

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
    checkServerVersion,
  };
};
