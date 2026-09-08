import { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

import config from '../config/env.js';
import { isTrustedExtensionOrigin, isTrustedOrigin } from '../config/origins.js';
import { CsrfError } from '../shared/types.js';

/**
 * Anti-CSRF gate for the cookie-authenticated API.
 *
 * Two layers, in this order:
 *
 *  1. Origin allowlist. This is the layer that actually stops the one credible
 *     vector: `sid` is `SameSite=Lax`, so a cross-*site* POST never carries it, but
 *     SameSite is site-scoped rather than origin-scoped - a sibling subdomain is
 *     same-site and its cookie *would* be sent. Several endpoints need no request
 *     body at all, so a plain `fetch` from such a page is a CORS "simple request":
 *     no preflight, straight to the handler. The CORS layer happens to reject those
 *     already, because its origin callback throws instead of merely omitting the
 *     response headers - but that is an accident of how `cors()` is configured, not a
 *     property anyone declared. Here it is explicit and tested.
 *
 *  2. Double-submit token. Covers the case of an allowlisted-but-untrusted origin,
 *     and costs nothing on the client: Angular enables `HttpXsrfInterceptor` by
 *     default, which reads the `XSRF-TOKEN` cookie and sets `X-XSRF-TOKEN` on every
 *     unsafe request to a relative URL - and `apiBaseUrl` is `/api`.
 *
 * The cookie name is a literal on purpose, in both directions: it is Angular's
 * default, and making it configurable would put it out of reach of static analysis.
 *
 * `req.cookies` is always defined here: `cookieParser()` is mounted unconditionally,
 * before this middleware.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Constant-time comparison of the double-submit pair. */
function safeEqualToken(cookieToken: string, headerToken: string): boolean {
  const fromCookie = Buffer.from(cookieToken, 'utf8');
  const fromHeader = Buffer.from(headerToken, 'utf8');

  // timingSafeEqual throws on a length mismatch, and the length of a token is not
  // the secret - only its content is.
  if (fromCookie.length !== fromHeader.length) return false;

  return crypto.timingSafeEqual(fromCookie, fromHeader);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const hasSession = Boolean(req.cookies[config.SESSION_COOKIE_NAME]);

  // Minted on any request that carries a session but no token yet - including safe
  // ones, so that the token is in place before the first mutation. issueSession()
  // does the same at login, when the session cookie does not exist on the request
  // yet; keep the two in sync.
  //
  // Those two together are what let the double-submit be unconditional, with no
  // migration flag to turn it on later. A session opened before this middleware
  // shipped has `sid` but no token - and still cannot fail, because the SPA calls
  // GET /users/me from provideAppInitializer before it renders anything, so the
  // token lands on that response, before the user can trigger any mutation. A
  // client that would break is one authenticating by cookie whose very first
  // request is a mutation; the extension, the only cookie-bearing non-SPA client,
  // is exempt by origin below.
  if (hasSession && !req.cookies['XSRF-TOKEN']) {
    res.cookie('XSRF-TOKEN', crypto.randomBytes(32).toString('base64url'), {
      // Read by Angular through document.cookie. This token is not an authentication
      // secret: knowing it is useless without also being able to send the cookie.
      httpOnly: false,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: config.SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
  }

  if (SAFE_METHODS.has(req.method)) return next();

  // No session cookie means the request either carries its own credential (a PAT in
  // an Authorization header, which a browser will not attach on its own) or none at
  // all. Neither is forgeable through a victim's browser, and gating on this is what
  // keeps signup, login, mfa/verify, anonymous link creation and redeem untouched.
  if (!hasSession) return next();

  const origin = req.get('origin');

  // Browsers always send Origin on an unsafe method, so a request without one did
  // not come from a browser: curl, supertest, Playwright's APIRequestContext, CI.
  // This exemption therefore lets through no case a browser can produce.
  if (!origin) return next();

  if (!isTrustedOrigin(origin)) {
    return next(new CsrfError('CSRF_ORIGIN_MISMATCH', 'Request origin not allowed'));
  }

  // The extension cannot read a non-HttpOnly cookie of the API's origin without the
  // "cookies" permission, and a web page cannot forge a chrome-extension:// origin.
  if (isTrustedExtensionOrigin(origin)) return next();

  const cookieToken = req.cookies['XSRF-TOKEN'];
  const headerToken = req.get('x-xsrf-token');
  if (!cookieToken || !headerToken || !safeEqualToken(cookieToken, headerToken)) {
    return next(new CsrfError('CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token'));
  }

  next();
}
