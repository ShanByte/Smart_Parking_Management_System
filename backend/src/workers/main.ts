import { startWorkers, stopWorkers } from './index.js';
import { logger } from '../lib/logger.js';

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Termination signal received, shutting down background workers gracefully...');

  try {
    await stopWorkers();
    logger.info('Background workers shut down cleanly');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during background workers shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception in background worker process');
  void gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection in background worker process');
  void gracefulShutdown('unhandledRejection');
});

async function main() {
  try {
    logger.info('Starting Smart Parking background worker process...');
    await startWorkers();
    logger.info('Background worker process running and listening for jobs');
  } catch (err) {
    logger.fatal({ err }, 'Failed to start background worker process');
    process.exit(1);
  }
}

void main();
