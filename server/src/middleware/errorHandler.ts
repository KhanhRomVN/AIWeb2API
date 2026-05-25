import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/apiError';
import { createLogger } from '../utils/logger';

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

const logger = createLogger('ErrorHandler');

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error('Error occurred', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code || 'APP_ERROR',
        type: err.constructor.name,
        details: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      },
    });
  }

  const errorCode = (err as any).code || 'INTERNAL_ERROR';
  const statusCode =
    errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET' || errorCode === 'ECONNREFUSED'
      ? 503
      : HTTP_STATUS.INTERNAL_SERVER_ERROR;

  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    error: {
      code: errorCode,
      type: err.constructor.name,
      details: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  });
};
