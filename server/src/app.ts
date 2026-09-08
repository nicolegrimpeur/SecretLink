import express, { Express, Request } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

import config from './config/env.js';
import { isTrustedOrigin } from './config/origins.js';
import { httpLogger } from './shared/logger.js';
import { generateRequestId, runWithRequestId } from './shared/requestContext.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError, NotFoundError } from './shared/types.js';
import { resolveClientIp } from './middleware/clientIp.js';
import { csrfProtection } from './middleware/csrf.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { userRouter } from './modules/users/user.routes.js';
import { linkRouter } from './modules/links/link.routes.js';

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

  // CORS - the allowlist lives in config/origins.ts so that this layer and the
  // anti-CSRF gate below can never disagree on what a trusted origin is.
  const corsOptions = {
    origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return cb(null, true); // postman, curl, etc.
      if (isTrustedOrigin(origin)) return cb(null, true);
      return cb(new AppError(403, 'CORS_ORIGIN_NOT_ALLOWED', 'Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'],
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

  // Anti-CSRF - after cookieParser (needs req.cookies) and after cors, so that a
  // preflight is answered and a forbidden origin keeps its CORS_ORIGIN_NOT_ALLOWED;
  // after the maintenance gate and the limiter, so a 503 or a 429 still wins; and
  // before the routers, which is what makes the gate unavoidable for /users and
  // /links. /health is mounted above all of this and stays out of the chain.
  app.use(csrfProtection);

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
