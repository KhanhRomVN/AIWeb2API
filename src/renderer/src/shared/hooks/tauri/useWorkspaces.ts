import { callBackend } from '../../utils/backend';

export const useWorkspaces = () => {
  const listWorkspaces = () => callBackend('/v1/workspaces/list');

  const linkWorkspace = (folderPath: string) =>
    callBackend('/v1/workspaces/link', 'POST', { folderPath });

  const unlinkWorkspace = (id: string) => callBackend(`/v1/workspaces/unlink/${id}`, 'DELETE');

  const getContext = (id: string) => callBackend(`/v1/workspaces/context/${id}`);

  const updateContext = (id: string, type: string, content: string) =>
    callBackend(`/v1/workspaces/context/${id}`, 'PUT', { type, content });

  const scanWorkspace = (folderPath: string) =>
    callBackend('/v1/workspaces/scan', 'POST', { folderPath });

  const getSummary = (workspaceId: string, conversationId: string) =>
    callBackend(`/v1/workspaces/summary/${workspaceId}/${conversationId}`);

  const updateSummary = (workspaceId: string, conversationId: string, content: string) =>
    callBackend(`/v1/workspaces/summary/${workspaceId}/${conversationId}`, 'POST', { content });

  const createSession = (workspaceId: string, conversationId: string, data: any) =>
    callBackend(`/v1/workspaces/sessions/${workspaceId}/${conversationId}`, 'POST', data);

  const getSessions = (workspaceId: string) =>
    callBackend(`/v1/workspaces/sessions/${workspaceId}`);

  const getTree = (folderPath: string) =>
    callBackend('/v1/workspaces/tree', 'POST', { folderPath });

  return {
    listWorkspaces,
    linkWorkspace,
    unlinkWorkspace,
    getContext,
    updateContext,
    scanWorkspace,
    getSummary,
    updateSummary,
    createSession,
    getSessions,
    getTree,
  };
};
