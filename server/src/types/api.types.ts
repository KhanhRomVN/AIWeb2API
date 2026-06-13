export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiErrorBody;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  code: string;
  details?: any;
}

export interface ApiMeta {
  timestamp: string;
  total?: number;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}
