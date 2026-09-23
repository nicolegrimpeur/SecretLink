import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { SessionPayload, PreAuthPayload, UnauthorizedError, PreAuthExpiredError } from '../shared/types.js';
import { userStore } from '../modules/users/user.store.js';

/**
 * Session management - using JWT in HttpOnly cookies
 */

// Session and pre-auth tokens share SESSION_SECRET: the audience is what tells them
// apart. A pre-auth token only proves the password, so it must never pass for a session.
const SESSION_AUDIENCE = 'session';
const PRE_AUTH_AUDIENCE = 'pre-auth';

export function issueSession(res: Response, payload: SessionPayload): void {
  const token = jwt.sign(payload, config.SESSION_SECRET, {
    algorithm: 'HS256',
    audience: SESSION_AUDIENCE,
    expiresIn: config.SESSION_TTL_SECONDS,
  });

  res.cookie(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: config.SESSION_TTL_SECONDS * 1000,
    path: '/',
  });

  // The anti-CSRF token rides along with the session it guards. csrfProtection mints
  // it for any request already bearing a session, but cannot see the one created
  // right here - without this, the first mutation after logging in would have none.
  // Keep in sync with middleware/csrf.ts, literal cookie name included.
  res.cookie('XSRF-TOKEN', crypto.randomBytes(32).toString('base64url'), {
    httpOnly: false, // read by Angular's HttpXsrfInterceptor through document.cookie
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: config.SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

/**
 * Valeur d'un cookie. `req.cookies` est typé `any` par cookie-parser, et un cookie
 * forgé peut prendre une autre forme (cookie-parser décode les valeurs `j:` en JSON) :
 * tout ce qui n'est pas une chaîne est traité comme absent.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' ? value : undefined;
}

export function clearSession(res: Response): void {
  res.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' });
  res.clearCookie('XSRF-TOKEN', { path: '/' });
}

/**
 * Issue a short-lived pre-authentication token (5 min) after password verification,
 * before MFA is confirmed. Returned in the response body, not a cookie.
 */
export function issuePreAuthToken(userId: number): string {
  const payload: PreAuthPayload = { userId, mfaPending: true };
  return jwt.sign(payload, config.SESSION_SECRET, {
    algorithm: 'HS256',
    audience: PRE_AUTH_AUDIENCE,
    expiresIn: 300, // 5 minutes
  });
}

/**
 * Verify a pre-auth token and return its payload.
 * Throws UnauthorizedError if invalid or not a pre-auth token.
 */
export function verifyPreAuthToken(token: string): { userId: number } {
  try {
    const decoded = jwt.verify(token, config.SESSION_SECRET, {
      algorithms: ['HS256'],
      audience: PRE_AUTH_AUDIENCE,
    }) as PreAuthPayload;
    if (!decoded.mfaPending) {
      throw new UnauthorizedError('Invalid pre-auth token');
    }
    return { userId: Number(decoded.userId) };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err instanceof jwt.TokenExpiredError) throw new PreAuthExpiredError();
    throw new UnauthorizedError('Invalid or expired pre-auth token');
  }
}

/**
 * Verify a session token and return its payload. Shared by sessionAuth and authEither
 * so the two cannot drift apart. Throws on anything that is not a session: bad
 * signature, expiry, wrong audience (a pre-auth token) or a `mfaPending` claim.
 */
export function verifySessionToken(token: string): SessionPayload {
  const decoded = jwt.verify(token, config.SESSION_SECRET, {
    algorithms: ['HS256'],
    audience: SESSION_AUDIENCE,
  }) as SessionPayload & { mfaPending?: unknown };
  // Redundant with the audience check, kept as a second lock on the MFA bypass.
  if (decoded.mfaPending) throw new UnauthorizedError('Invalid session');
  return decoded;
}

/**
 * Middleware to parse and validate session from cookie
 */
export async function sessionAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readCookie(req, config.SESSION_COOKIE_NAME);

    if (!token) {
      throw new UnauthorizedError('No session cookie found');
    }

    let decoded: SessionPayload;
    try {
      decoded = verifySessionToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired session');
    }

    const userId = Number(decoded.userId);
    if (await isSessionStale(userId, decoded.iat)) {
      throw new UnauthorizedError('Session invalidated by a password change');
    }

    req.session = { userId };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * A session minted before the last password change must no longer be honoured.
 * A session carrying no `iat` (jsonwebtoken always sets one) is treated as stale
 * rather than trusted.
 */
export async function isSessionStale(
  userId: number,
  issuedAtSeconds: number | undefined,
): Promise<boolean> {
  if (issuedAtSeconds === undefined) return true;
  return userStore.isPasswordChangedAfter(userId, issuedAtSeconds);
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
