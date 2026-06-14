import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler.middleware';
import { requestLogger } from './middleware/request-logger.middleware';
import { createLogger } from './utils/logger';
import { providerRegistry } from './provider/registry';

import v1Router from './routes/v1/index';
import { login } from './controllers/account.controller';

const logger = createLogger('App');

export const createApp = async () => {
  const app = express();

  logger.info('Loading providers...');
  await providerRegistry.loadProviders();

  logger.info('Providers loaded');

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(requestLogger);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  logger.info('Mounting routes...');
  app.use('/v1', v1Router);
  logger.info('  ✓ /v1 routes mounted');
  
  app.post('/login/:provider', (req, res, next) => {
    logger.info(`[Route Debug] POST /login/:provider matched! Path: ${req.path}, URL: ${req.originalUrl}`);
    next();
  }, login);
  logger.info('  ✓ POST /login/:provider mounted');
  
  app.post('/api/event_logging/batch', (req, res) =>
    res.status(200).json({ status: 'ok' }),
  );
  logger.info('  ✓ POST /api/event_logging/batch mounted');

  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      message: `Cannot ${req.method} ${req.path}`,
      error: { code: 'NOT_FOUND' },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.use(errorHandler);
  return app;
};
