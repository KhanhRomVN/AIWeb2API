import { invoke } from '@tauri-apps/api/core';

export const useCommands = () => {
  const readFile = (filePath: string) => invoke<string>('read_file', { filePath });

  const writeFile = (filePath: string, content: string) =>
    invoke('write_file', { filePath, content });

  const searchFiles = (path: string, regex: string, pattern?: string) =>
    invoke<string>('search_files', { path, regex, pattern });

  const listFiles = (path: string, recursive: boolean = false) =>
    invoke<string[]>('list_files', { path, recursive });

  const openDirectory = () => invoke<string | null>('open_directory');

  const executeShell = (command: string, cwd?: string) =>
    invoke<string>('shell_execute', { command, cwd });

  return {
    readFile,
    writeFile,
    searchFiles,
    listFiles,
    openDirectory,
    executeShell,
  };
};
