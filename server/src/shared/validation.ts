import type { ZodError } from 'zod';

/**
 * Flatten a ZodError into a single human-readable string,
 * used as the message of the resulting ValidationError.
 */
export function formatZodErrors(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('; ');
}
