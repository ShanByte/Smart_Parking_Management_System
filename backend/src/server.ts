import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { initSocket, closeSocket } from './sockets/index.js';

const app = createApp();
const server = http.createServer(app);

// Attach Socket.IO to HTTP server per contract C9 & Amendment F4
const io = initSocket(server);

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received termination signal, shutting down gracefully');

  try {
    await closeSocket();
    logger.info('Socket.IO connections closed cleanly');
  } catch (err) {
    logger.error({ err }, 'Error closing Socket.IO connections during shutdown');
  }

  server.close(() => {
    logger.info('HTTP server closed cleanly');
    process.exit(0);
  });

  // Force exit if not closed within 10 seconds
  setTimeout(() => {
    logger.error('Forcefully terminating process after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(env.PORT, '127.0.0.1', () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `Smart Parking API server running at http://127.0.0.1:${env.PORT}`
  );
});

export { server, io };
