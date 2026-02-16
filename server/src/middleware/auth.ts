import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { extractPatFromHeader, sessionAuth } from './session.js';
import config from '../config/env.js';
import { getPool } from '../config/database.js';
import { hashToken } from '../shared/crypto.js';
import {
  SessionPayload,
  UnauthorizedError,
  ForbiddenError,
  AuthRequest as AuthPayload,
} from '../shared/types.js';
import { getLogger } from '../shared/logger.js';

const logger = getLogger('Auth');

declare global {
  namespace Express {
    interface Request {
      session?: SessionPayload;
      auth?: AuthPayload;
    }
  }
}

/**
 * Middleware that attempts both session and PAT authentication
 * Attaches req.auth with { method, userId, scopes }
 * Does NOT require authentication (allows null auth for public endpoints)
 */
export async function authEither(
  req: Request & { auth?: AuthPayload },
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Try session auth first
    if (req.cookies?.[config.SESSION_COOKIE_NAME]) {
      try {
        const token = req.cookies[config.SESSION_COOKIE_NAME];
        const decoded = jwt.verify(token, config.SESSION_SECRET) as SessionPayload;
        req.auth = {
          method: 'session',
          userId: Number(decoded.userId),
          scopes: undefined, // Sessions have unlimited scopes
        };
        return next();
      } catch (err) {
        logger.debug('Session validation failed, trying PAT');
      }
    }

    // Try PAT next
    const token = extractPatFromHeader(req);
    if (token) {
      try {
        const tokenHash = hashToken(token);
        const pool = getPool();
        const [rows] = await pool.execute<any[]>(
          `SELECT id, user_id, scopes FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL`,
          [tokenHash],
        );

        if (rows.length === 0) {
          throw new UnauthorizedError('Invalid or revoked API token');
        }

        const tokenRecord = rows[0];
        const scopes = (tokenRecord.scopes || '').split(',').filter(Boolean);

        req.auth = {
          method: 'pat',
          userId: Number(tokenRecord.user_id),
          scopes,
        };
        return next();
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        logger.debug('PAT validation failed');
      }
    }

    // Neither auth method worked, but we allow unauthenticated access
    // Handlers can use req.auth to determine if user is authenticated
    req.auth = {
      method: null,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware that requires authentication
 * Throws if req.auth.method is null
 */
export function requireAuth(
  allowedMethods?: ('session' | 'pat')[],
  requiredScopes?: string[],
) {
  return (req: Request & { auth?: AuthPayload }, res: Response, next: NextFunction) => {
    if (!req.auth?.method) {
      throw new UnauthorizedError('Authentication required');
    }

    // Check allowed methods
    if (allowedMethods && !allowedMethods.includes(req.auth.method)) {
      throw new ForbiddenError(
        `This endpoint requires ${allowedMethods.join(
          ' or ',
        )} authentication`,
      );
    }

    // Check scopes (only for PAT, session has all scopes)
    if (
      requiredScopes &&
      req.auth.method === 'pat' &&
      req.auth.scopes
    ) {
      const hasAllScopes = requiredScopes.every((scope) =>
        req.auth!.scopes!.includes(scope),
      );

      if (!hasAllScopes) {
        throw new ForbiddenError(
          `Missing required scopes: ${requiredScopes.join(', ')}`,
        );
      }
    }

    next();
  };
}
