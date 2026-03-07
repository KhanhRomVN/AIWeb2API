import { callBackend } from '../../utils/backend';

export const useStats = () => {
  const getStats = (period?: string, page: number = 0, type?: string) => {
    let url = `/v1/stats?page=${page}`;
    if (period) url += `&period=${period}`;
    if (type) url += `&type=${type}`;
    return callBackend(url);
  };

  return {
    getStats,
  };
};
