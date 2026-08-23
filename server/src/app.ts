import express, { Express, Request } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

import config from './config/env.js';
import { httpLogger } from './shared/logger.js';
import { generateRequestId, runWithRequestId } from './shared/requestContext.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError, NotFoundError } from './shared/types.js';
import { resolveClientIp } from './middleware/clientIp.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { userRouter } from './modules/users/user.routes.js';
import { linkRouter } from './modules/links/link.routes.js';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:8100', 'https://secret.nicob.ovh'];

/**
 * CORS allowlist - driven by ALLOWED_ORIGINS (comma-separated), falling back to the
 * built-in defaults. FRONT_BASE_URL is always allowed, whichever source is used.
 *
 * The web front-end is served from the same origin and needs none of this; what is
 * genuinely cross-origin is the browser extension and any client using an absolute
 * API URL.
 */
function resolveAllowedOrigins(): string[] {
  const stripTrailingSlash = (origin: string) => origin.replace(/\/$/, '');
  const fromEnv = (config.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => stripTrailingSlash(origin.trim()))
    .filter(Boolean);
  const origins = fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;

  return [...new Set([...origins, stripTrailingSlash(config.FRONT_BASE_URL)])];
}

export function createApp(): Express {
  const app = express();

  // Trust proxy - nombre de proxys de confiance devant l'application (TRUST_PROXY).
  app.set('trust proxy', config.TRUST_PROXY);

  // helmet le ferait, mais /health est monté avant lui pour rester joignable en
  // maintenance : sans ça, cette route seule annonce encore "Express".
  app.disable('x-powered-by');

  // Health check - deliberately registered before every other layer so the liveness
  // probe stays reachable during maintenance and is never rate limited
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Request correlation - registered before body parsing and logging so that every
  // log line of a request, including parsing failures, carries the same request_id.
  app.use((req, _res, next) => {
    const requestId = generateRequestId();
    (req as Request & { id?: string }).id = requestId;
    runWithRequestId(requestId, next);
  });

  // Real client IP behind Cloudflare - must run before the logger and the rate
  // limiters, which all read req.ip.
  app.use(resolveClientIp);

  // HTTP logging
  app.use(httpLogger);

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Body parsing
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(cookieParser());

  // CORS
  const ALLOWED_ORIGINS = resolveAllowedOrigins();
  const corsOptions = {
    origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return cb(null, true); // postman, curl, etc.
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      if (origin.startsWith('chrome-extension://')) return cb(null, true); // extension SecretLink
      return cb(new AppError(403, 'CORS_ORIGIN_NOT_ALLOWED', 'Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'idempotency-key'],
  };

  app.use(cors(corsOptions));
  app.options('/*path', cors(corsOptions));

  // Maintenance mode middleware
  app.use((req, res, next): void => {
    const maintenance = String(config.MAINTENANCE_MODE) === '1';
    if (maintenance && req.path !== '/health') {
      res.status(503).json({
        error: {
          code: 'MAINTENANCE_MODE',
          message: 'Maintenance in progress',
        },
      });
      return;
    }
    next();
  });

  // Rate limiting
  app.use(globalLimiter);

  // Mount routes
  app.use('/users', userRouter);
  app.use('/links', linkRouter);

  // JSON 404 for every unmatched route, whatever the method.
  app.use((_req, _res, next) => {
    next(new NotFoundError('Route not found'));
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
