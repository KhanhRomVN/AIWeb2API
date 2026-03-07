import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const useWatcher = (onFileChange?: (event: any) => void) => {
  const watchDir = (folderPath: string) => invoke('watch_dir', { path: folderPath });
  const unwatchDir = () => invoke('unwatch_dir');

  useEffect(() => {
    if (!onFileChange) return;

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const u = await listen('file-changed', (event) => {
        onFileChange(event.payload);
      });
      unlisten = u;
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [onFileChange]);

  return {
    watchDir,
    unwatchDir,
  };
};
