import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { createLogger } from './utils/logger';
import { providerRegistry } from './provider/registry';
import { versionService } from './services/version.service';
import { versionMiddleware } from './middleware/version.middleware';

// Import routes
import v1Router from './routes/v1/index';
import { login } from './controllers/account.controller';

const logger = createLogger('App');

export const createApp = async () => {
  const app = express();

  // Load all providers before handling any requests
  logger.info('Loading providers...');
  await providerRegistry.loadProviders();
  // Initialize version service
  versionService.startChecking().catch((err) => {
    logger.error('Failed to start version checking service:', err);
  });

  logger.info('Providers loaded successfully');

  // Middleware
  app.use(cors());
  app.use(versionMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(requestLogger);

  // Routes
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      elara: 'khanhromvn/elara',
      timestamp: new Date().toISOString(),
      note: 'Legacy health check endpoint',
    });
  });
  app.use('/v1', v1Router);

  // Fallback root login route for dynamic provider login
  app.post('/login/:provider', login);

  // Claude Code CLI Telemetry dummy endpoint
  app.post('/api/event_logging/batch', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // 404 handler - must be after all routes
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      message: `Cannot ${req.method} ${req.path}`,
      error: {
        code: 'NOT_FOUND',
        details: {
          method: req.method,
          path: req.path,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  logger.info('Express app initialized');

  return app;
};
