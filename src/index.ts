#!/usr/bin/env node
import './env';
import * as dns from 'dns';

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { startServer } from './server';
import { createLogger } from './utils/logger';
import { initDatabase } from './database';

const logger = createLogger('Startup');

const main = async (options?: { dbPath?: string }) => {
  logger.info('Starting elara-server...');

  try {
    initDatabase(options?.dbPath);
  } catch (error) {
    logger.error('Failed to initialize database', error);
    if (require.main === module) process.exit(1);
    throw error;
  }

  const result = await startServer();

  if (result.success) {
    logger.info(`Server started on port ${result.port}${result.https ? ' (HTTPS)' : ''}`);
    const { accountRefreshService } = require('./services/account-refresh.service');
    accountRefreshService.start();
  } else {
    logger.error(`Failed to start server: ${result.error}`);
    if (require.main === module) process.exit(1);
    throw new Error(result.error);
  }

  const shutdown = () => {
    logger.info('Shutting down...');
    if (require.main === module) process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

export const startBackend = main;

if (require.main === module) {
  const args = process.argv.slice(2);
  let dbPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--db-path=')) {
      dbPath = arg.split('=')[1];
    } else if (arg === '--db-path' && i + 1 < args.length) {
      dbPath = args[++i];
    }
  }

  main({ dbPath }).catch((err) => {
    logger.error('Unhandled startup error', err);
    process.exit(1);
  });
}
