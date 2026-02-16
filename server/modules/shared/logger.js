import pino from 'pino';
import pinoHttp from 'pino-http';
import {env} from './env.js';

export const logger = pino({
    level: env.LOG_LEVEL || 'info',
    redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        remove: true,
    },
});

export const httpLogger = pinoHttp({
    logger,
    autoLogging: true, // log des requêtes
    customLogLevel: (res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
});
