#!/usr/bin/env node

import { ExpressServer } from './ExpressServer.js';
import { logger } from '@core/utils';

async function main() {
  const server = new ExpressServer();
  
  try {
    await server.start();
  } catch (error) {
    logger.error('Failed to start REST server', { error });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main', { error });
    process.exit(1);
  });
}

export { ExpressServer };