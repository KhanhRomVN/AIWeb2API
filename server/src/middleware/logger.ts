import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('HTTP');

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  const SKIP_PATHS = ['/', '/health'];

  res.on('finish', () => {
    if (SKIP_PATHS.includes(req.path)) return;
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
};
