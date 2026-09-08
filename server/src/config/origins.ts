import config from './env.js';

/**
 * Single source of truth for "which origins may talk to this API".
 *
 * Both the CORS layer and the anti-CSRF middleware answer that question, and they
 * must never disagree: an origin CORS lets through but CSRF rejects (or the reverse)
 * would be a bug that only shows up in production, on one client.
 *
 * Nothing is memoised here. The values are read from `config` on each call, which
 * keeps the helpers testable the same way `MAINTENANCE_MODE` already is - a test can
 * flip `config.ALLOWED_EXTENSION_IDS` and see the effect. The cost is two splits of a
 * short string per unsafe request, against an argon2 hash or a JWT verification in the
 * same flow.
 */

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:8100', 'https://secret.nicob.ovh'];

const EXTENSION_SCHEME = 'chrome-extension://';

const stripTrailingSlash = (origin: string) => origin.replace(/\/$/, '');

const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/**
 * CORS allowlist - driven by ALLOWED_ORIGINS (comma-separated), falling back to the
 * built-in defaults. FRONT_BASE_URL is always allowed, whichever source is used.
 *
 * The web front-end is served from the same origin and needs none of this; what is
 * genuinely cross-origin is the browser extension and any client using an absolute
 * API URL.
 */
export function resolveAllowedOrigins(): string[] {
  const fromEnv = parseList(config.ALLOWED_ORIGINS).map(stripTrailingSlash);
  const origins = fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;

  return [...new Set([...origins, stripTrailingSlash(config.FRONT_BASE_URL)])];
}

/**
 * A browser extension origin we accept.
 *
 * ALLOWED_EXTENSION_IDS pins the published extension; left unset, any
 * `chrome-extension://` origin is accepted, which is what every deployment did before
 * this variable existed - pinning must not lock out an instance whose .env is not yet
 * updated.
 *
 * To be clear about what this buys: an extension declaring `host_permissions` on the
 * API bypasses CORS anyway and can read responses, so pinning narrows the declared
 * trust surface rather than defending against a hostile extension.
 */
export function isTrustedExtensionOrigin(origin: string): boolean {
  if (!origin.startsWith(EXTENSION_SCHEME)) return false;

  const pinned = parseList(config.ALLOWED_EXTENSION_IDS);
  if (!pinned.length) return true;

  return pinned.includes(origin.slice(EXTENSION_SCHEME.length));
}

/** Whether `origin` is allowed to send credentialed requests to this API. */
export function isTrustedOrigin(origin: string): boolean {
  return resolveAllowedOrigins().includes(origin) || isTrustedExtensionOrigin(origin);
}
