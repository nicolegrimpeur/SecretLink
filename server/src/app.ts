import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

import config from './config/env.js';
import { httpLogger, getLogger } from './shared/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { userRouter } from './modules/users/user.routes.js';
import { linkRouter } from './modules/links/link.routes.js';

const logger = getLogger('App');

export function createApp(): Express {
  const app = express();

  // Trust proxy
  app.enable('trust proxy');

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Body parsing
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // CORS
  const ALLOWED_ORIGINS = ['http://localhost:8100', 'https://secret.nicob.ovh'];
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
  app.use((req, res, next): void => {
    const maintenance = String(config.MAINTENANCE_MODE) === '1';
    if (maintenance && req.path !== '/health') {
      res.status(503).send('Maintenance in progress');
      return;
    }
    next();
  });

  // Mount routes
  app.use('/users', userRouter);
  app.use('/links', linkRouter);

  // Redirect root to base URL
  app.get(['/*path', '/'], (req, res) => {
    res.redirect(config.BASE_URL + '/cv/');
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
