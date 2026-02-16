import http from 'node:http';
import { createApp } from './app.js';
import config from './config/env.js';
import { getLogger, getLogger as logger } from './shared/logger.js';

const log = getLogger('main');

const app = createApp();
const server = http.createServer(app);

async function start() {
  try {
    server.listen(config.PORT, () => {
      log.info(
        { port: config.PORT, environment: config.NODE_ENV },
        `🚀 Server listening on port ${config.PORT}`,
      );
    });
  } catch (err) {
    log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  log.info('Shutting down gracefully...');
  server.close(() => {
    log.info('Server stopped');
    process.exit(0);
  });

  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

start();
