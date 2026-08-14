import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

/**
 * Per-request correlation id.
 *
 * The id is kept in an AsyncLocalStorage rather than threaded through service and
 * store signatures: the pino `mixin` in shared/logger.ts reads it on every log line,
 * so application logs carry it without a single service having to know about it.
 */

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Short random id - 16 hex characters, readable enough to copy into a log search.
 * Deliberately not a counter: those restart at 1 with the process, and the same value
 * would then point at several unrelated requests over a window spanning a redeploy.
 */
export function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/** Runs `fn` with `requestId` attached to the current async context. */
export function runWithRequestId(requestId: string, fn: () => void): void {
  storage.run({ requestId }, fn);
}

/** Current request id, or undefined outside a request (jobs, startup). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
