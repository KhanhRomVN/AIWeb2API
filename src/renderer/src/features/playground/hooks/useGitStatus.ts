import { useState, useEffect, useCallback } from 'react';
import { useGit } from '../../../shared/hooks/tauri/useGit';
import { useWatcher } from '../../../shared/hooks/tauri/useWatcher';

export interface GitStatus {
  modified: string[];
  staged: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
  isRepo: boolean;
}

export interface DiffStats {
  files: { [path: string]: { insertions: number; deletions: number; binary: boolean } };
  total: { insertions: number; deletions: number };
}

export const useGitStatus = (workspacePath: string | undefined) => {
  const [gitStatus, setGitStatus] = useState<GitStatus>({
    modified: [],
    staged: [],
    untracked: [],
    conflicted: [],
    ahead: 0,
    behind: 0,
    isRepo: false,
  });
  const [diffStats, setDiffStats] = useState<DiffStats>({
    files: {},
    total: { insertions: 0, deletions: 0 },
  });
  const [isWatching, setIsWatching] = useState(false);

  const { getStatus, getDiffStats } = useGit();

  const fetchStatus = useCallback(async () => {
    if (!workspacePath) return;
    try {
      const status = await getStatus(workspacePath);
      setGitStatus(status);

      const diff = await getDiffStats(workspacePath);
      setDiffStats(diff);
    } catch (error) {
      console.error('Failed to fetch git status:', error);
    }
  }, [workspacePath, getStatus, getDiffStats]);

  const { watchDir, unwatchDir } = useWatcher(fetchStatus);

  useEffect(() => {
    if (!workspacePath) return;

    fetchStatus();

    // Start watching
    watchDir(workspacePath).then(() => setIsWatching(true));

    return () => {
      unwatchDir();
      setIsWatching(false);
    };
  }, [workspacePath, fetchStatus, watchDir, unwatchDir]);

  return { gitStatus, diffStats, isWatching, refreshGitStatus: fetchStatus };
};
