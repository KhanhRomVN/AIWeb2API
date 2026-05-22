#!/usr/bin/env node
import './env';
import * as dns from 'dns';

// Force DNS to prefer IPv4 over IPv6 to avoid ETIMEDOUT/ENETUNREACH issues in some networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { updateServerConfig } from './config/server';
import { startServer } from './server';
import { createLogger } from './utils/logger';
import { initDatabase } from './services/db';
import { killPort } from './utils/port';

const logger = createLogger('Startup');

const main = async (options?: { dbPath?: string }) => {
  logger.info('Starting backend service...');

  // Initialize database (synchronous)
  try {
    initDatabase(options?.dbPath);
  } catch (error) {
    logger.error('Failed to initialize database', error);
    if (require.main === module) process.exit(1);
    throw error;
  }

  const result = await startServer();

  if (result.success) {
    logger.info(`Backend service started successfully on port ${result.port}`);

    // Start background services
    const {
      accountRefreshService,
    } = require('./services/account-refresh.service');
    accountRefreshService.start();
  } else {
    logger.error(`Failed to start backend service: ${result.error}`);
    if (require.main === module) process.exit(1);
    throw new Error(result.error);
  }

  // Handle graceful shutdown
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
    logger.error('Unhandled error during startup', err);
    process.exit(1);
  });
}
