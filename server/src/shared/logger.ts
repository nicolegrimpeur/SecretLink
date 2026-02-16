import pino from 'pino';
import pinoHttp from 'pino-http';
import config from '../config/env.js';

const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
});

/**
 * HTTP request/response logger middleware
 */
export const httpLogger = pinoHttp(
  {
    logger,
  },
  process.stdout,
);

/**
 * Get logger instance for non-HTTP contexts
 */
export function getLogger(context?: string) {
  return context ? logger.child({ context }) : logger;
}

export default logger;
