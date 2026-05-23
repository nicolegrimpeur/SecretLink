import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { SessionPayload, PreAuthPayload, UnauthorizedError, PreAuthExpiredError } from '../shared/types.js';

/**
 * Session management - using JWT in HttpOnly cookies
 */

export function issueSession(res: Response, payload: SessionPayload): void {
  const token = jwt.sign(payload, config.SESSION_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.SESSION_TTL_SECONDS,
  });

  res.cookie(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: config.SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' });
}

/**
 * Issue a short-lived pre-authentication token (5 min) after password verification,
 * before MFA is confirmed. Returned in the response body, not a cookie.
 */
export function issuePreAuthToken(userId: number): string {
  const payload: PreAuthPayload = { userId, mfaPending: true };
  return jwt.sign(payload, config.SESSION_SECRET, {
    algorithm: 'HS256',
    expiresIn: 300, // 5 minutes
  });
}

/**
 * Verify a pre-auth token and return its payload.
 * Throws UnauthorizedError if invalid or not a pre-auth token.
 */
export function verifyPreAuthToken(token: string): { userId: number } {
  try {
    const decoded = jwt.verify(token, config.SESSION_SECRET) as PreAuthPayload;
    if (!decoded.mfaPending) {
      throw new UnauthorizedError('Invalid pre-auth token');
    }
    return { userId: Number(decoded.userId) };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if ((err as any)?.name === 'TokenExpiredError') throw new PreAuthExpiredError();
    throw new UnauthorizedError('Invalid or expired pre-auth token');
  }
}

/**
 * Middleware to parse and validate session from cookie
 */
export function sessionAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[config.SESSION_COOKIE_NAME];

  if (!token) {
    throw new UnauthorizedError('No session cookie found');
  }

  try {
    const decoded = jwt.verify(token, config.SESSION_SECRET) as SessionPayload;
    (req as any).session = { userId: Number(decoded.userId) };
    next();
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired session');
  }
}

/**
 * Parse Personal Access Token (PAT) from Authorization header
 * Format: Bearer <token>
 */
export function extractPatFromHeader(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}
