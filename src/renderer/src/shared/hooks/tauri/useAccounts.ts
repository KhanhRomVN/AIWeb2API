import { invoke } from '@tauri-apps/api/core';
import { callBackend } from '../../utils/backend';

export const useAccounts = () => {
  const createAccount = (data: any) => callBackend('/v1/accounts', 'POST', data);

  const login = (provider: string, options: any) =>
    callBackend(`/v1/accounts/login/${provider}`, 'POST', options);

  const listAccounts = () => callBackend('/v1/accounts');
  const deleteAccount = (id: string) => callBackend(`/v1/accounts/${id}`, 'DELETE');
  const updateAccount = (id: string, updates: any) =>
    callBackend(`/v1/accounts/${id}`, 'PUT', { updates });

  return {
    createAccount,
    login,
    listAccounts,
    deleteAccount,
    updateAccount,
  };
};
