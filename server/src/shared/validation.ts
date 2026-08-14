/**
 * Flatten a ZodError into a single human-readable string,
 * used as the message of the resulting ValidationError.
 */
export function formatZodErrors(error: any): string {
  if (error.issues) {
    return error.issues
      .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
  }
  return 'Invalid request';
}
