import { callBackend } from '../../utils/backend';

export const useGit = () => {
  const getStatus = (repoPath: string) => callBackend('/v1/git/status', 'POST', { repoPath });

  const getDiffStats = (repoPath: string) =>
    callBackend('/v1/git/diff-stats', 'POST', { repoPath });

  const addFiles = (repoPath: string, files: string[]) =>
    callBackend('/v1/git/add', 'POST', { repoPath, files });

  const commit = (repoPath: string, message: string) =>
    callBackend('/v1/git/commit', 'POST', { repoPath, message });

  const diff = (repoPath: string, staged?: boolean) =>
    callBackend('/v1/git/diff', 'POST', { repoPath, staged });

  const push = (repoPath: string) => callBackend('/v1/git/push', 'POST', { repoPath });

  return {
    getStatus,
    getDiffStats,
    addFiles,
    commit,
    diff,
    push,
  };
};
