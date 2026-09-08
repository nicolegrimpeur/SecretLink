import config from './env.js';

/**
 * Single source of truth for "which origins may talk to this API" - shared by the
 * CORS layer and the anti-CSRF gate, which must never disagree.
 *
 * Read from `config` on each call rather than memoised, so a test can flip
 * `config.ALLOWED_EXTENSION_IDS` the way it already does for `MAINTENANCE_MODE`.
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
 * ALLOWED_ORIGINS (comma-separated) or the built-in defaults; FRONT_BASE_URL is
 * always allowed. The web front-end is same-origin and needs none of this - only the
 * extension and absolute-URL clients are genuinely cross-origin.
 */
export function resolveAllowedOrigins(): string[] {
  const fromEnv = parseList(config.ALLOWED_ORIGINS).map(stripTrailingSlash);
  const origins = fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;

  return [...new Set([...origins, stripTrailingSlash(config.FRONT_BASE_URL)])];
}

/**
 * ALLOWED_EXTENSION_IDS pins the published extension; unset accepts any
 * `chrome-extension://` origin, the behaviour that predates the variable.
 *
 * Pinning narrows the declared trust surface, and no more than that: an extension
 * holding host_permissions on the API bypasses CORS anyway and can read responses.
 */
export function isTrustedExtensionOrigin(origin: string): boolean {
  if (!origin.startsWith(EXTENSION_SCHEME)) return false;

  const pinned = parseList(config.ALLOWED_EXTENSION_IDS);
  if (!pinned.length) return true;

  return pinned.includes(origin.slice(EXTENSION_SCHEME.length));
}

/** Whether `origin` may send credentialed requests to this API. */
export function isTrustedOrigin(origin: string): boolean {
  return resolveAllowedOrigins().includes(origin) || isTrustedExtensionOrigin(origin);
}
