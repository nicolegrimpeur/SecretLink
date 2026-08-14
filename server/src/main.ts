import http from 'node:http';
import { createApp } from './app.js';
import config from './config/env.js';
import { startExpiredLinksCleaner } from './jobs/expiredLinksCleaner.js';
import { getLogger } from './shared/logger.js';

const log = getLogger('main');

const app = createApp();
const server = http.createServer(app);

let stopExpiredLinksCleaner: (() => void) | null = null;

function start() {
  // listen() reports failures through the 'error' event, not by throwing:
  // a try/catch here would never see EADDRINUSE.
  server.on('error', (err) => {
    log.error(err, 'Failed to start server');
    process.exit(1);
  });

  server.listen(config.PORT, () => {
    log.info(
      { port: config.PORT, environment: config.NODE_ENV },
      `Server listening on port ${config.PORT}`,
    );
    stopExpiredLinksCleaner = startExpiredLinksCleaner();
  });
}

// Graceful shutdown - SIGTERM is what Docker and orchestrators send, SIGINT is Ctrl+C
function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down gracefully...');

  stopExpiredLinksCleaner?.();

  server.close(() => {
    log.info('Server stopped');
    process.exit(0);
  });

  const forced = setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  forced.unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
