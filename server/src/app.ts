import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import serveIndex from 'serve-index';

import config from './config/env.js';
import { httpLogger, getLogger } from './shared/logger.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';
import { userRouter } from './modules/users/user.routes.js';
import { linkRouter } from './modules/links/link.routes.js';

const logger = getLogger('App');

export function createApp(): Express {
  const app = express();

  // Trust proxy
  app.enable('trust proxy');

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Static assets
  app.use('./.well-known', express.static('.well-known'), serveIndex('.well-known'));

  // Body parsing
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // CORS
  const ALLOWED_ORIGINS = ['http://localhost:8100', 'https://nicob.ovh', 'http://localhost'];
  const corsOptions = {
    origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return cb(null, true); // postman, curl, etc.
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'idempotency-key'],
  };

  app.use(cors(corsOptions));
  app.options('/*path', cors(corsOptions));

  // HTTP logging
  app.use(httpLogger);

  // Maintenance mode middleware
  app.get('/*path', (req, res, next): void => {
    if (config.MAINTENANCE_MODE) {
      res.send('Maintenance in progress');
      return;
    }
    next();
  });

  // Mount routes
  app.use('/secretLink/users', userRouter);
  app.use('/secretLink/links', linkRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Redirect root to base URL
  app.get(['/*path', '/'], (req, res) => {
    res.redirect(config.BASE_URL + '/cv/');
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
