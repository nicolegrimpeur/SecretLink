import { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

import config from '../config/env.js';
import { isTrustedExtensionOrigin, isTrustedOrigin } from '../config/origins.js';
import { CsrfError } from '../shared/types.js';

/**
 * Anti-CSRF gate for the cookie-authenticated API.
 *
 *  1. Origin allowlist. `sid` is SameSite=Lax, so a cross-*site* POST never carries
 *     it; what remains is a sibling subdomain, same-site and whose cookie *would* be
 *     sent. CORS already rejects those, but only as a side effect of its origin
 *     callback throwing - here it is explicit and tested.
 *  2. Double-submit token, for an allowlisted-but-untrusted origin. Free on the
 *     client: Angular's HttpXsrfInterceptor is on by default and sends X-XSRF-TOKEN.
 *
 * The cookie name is a literal on purpose - it is Angular's default, and making it
 * configurable would put it out of reach of static analysis.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeEqualToken(cookieToken: string, headerToken: string): boolean {
  const fromCookie = Buffer.from(cookieToken, 'utf8');
  const fromHeader = Buffer.from(headerToken, 'utf8');

  // timingSafeEqual throws on a length mismatch, and the length is not the secret.
  if (fromCookie.length !== fromHeader.length) return false;

  return crypto.timingSafeEqual(fromCookie, fromHeader);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // req.cookies is always defined: cookieParser() is mounted before this.
  const hasSession = Boolean(req.cookies[config.SESSION_COOKIE_NAME]);

  // Minted on safe requests too, so the token is there before the first mutation;
  // issueSession() does the same at login. Together they are what makes the
  // double-submit unconditional: a session predating this middleware gets its token
  // on the SPA's bootstrap GET /users/me, before any mutation is possible.
  if (hasSession && !req.cookies['XSRF-TOKEN']) {
    res.cookie('XSRF-TOKEN', crypto.randomBytes(32).toString('base64url'), {
      httpOnly: false, // read by Angular via document.cookie; not an auth secret
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: config.SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
  }

  if (SAFE_METHODS.has(req.method)) return next();

  // PAT or anonymous: a browser attaches neither on its own, so there is nothing to
  // forge. Keeps signup, login, mfa/verify, public link creation and redeem intact.
  if (!hasSession) return next();

  const origin = req.get('origin');

  // Browsers always send Origin on an unsafe method, so no Origin means no browser
  // (curl, supertest, Playwright, CI) - this exempts nothing a browser can produce.
  if (!origin) return next();

  if (!isTrustedOrigin(origin)) {
    return next(new CsrfError('CSRF_ORIGIN_MISMATCH', 'Request origin not allowed'));
  }

  // The extension cannot read the cookie without the "cookies" permission, and a web
  // page cannot forge a chrome-extension:// origin.
  if (isTrustedExtensionOrigin(origin)) return next();

  const cookieToken = req.cookies['XSRF-TOKEN'];
  const headerToken = req.get('x-xsrf-token');
  if (!cookieToken || !headerToken || !safeEqualToken(cookieToken, headerToken)) {
    return next(new CsrfError('CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token'));
  }

  next();
}
