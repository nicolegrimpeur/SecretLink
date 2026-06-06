import pino from 'pino';
import pinoHttp from 'pino-http';
import config from '../config/env.js';

// Redact token-like path segments (base64url, 20+ chars)
const TOKEN_SEGMENT_RE = /\/[A-Za-z0-9_-]{20,}/g;

function sanitizeUrl(url: string | undefined): string {
  if (!url) return '';
  // Strip query string entirely, then redact token-like path segments
  const path = url.split('?')[0];
  return path.replace(TOKEN_SEGMENT_RE, '/[redacted]');
}

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
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: sanitizeUrl(req.url),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
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
