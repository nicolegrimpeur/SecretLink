import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/types.js';
import { getLogger } from '../shared/logger.js';

const logger = getLogger('ErrorHandler');

/**
 * body-parser tags its errors with a `type` - map the ones deserving a dedicated code.
 * Messages are fixed per code so the API contract stays stable: the original message
 * is kept in the logs, never in the response.
 */
const BODY_PARSER_ERRORS: Record<
  string,
  { status: number; code: string; message: string }
> = {
  'entity.parse.failed': { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON body' },
  'entity.too.large': { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' },
  'request.aborted': { status: 400, code: 'REQUEST_ABORTED', message: 'Request aborted' },
  'charset.unsupported': { status: 415, code: 'UNSUPPORTED_CHARSET', message: 'Unsupported charset' },
  'encoding.unsupported': { status: 415, code: 'UNSUPPORTED_ENCODING', message: 'Unsupported content encoding' },
};

/** Fallback per status for any other 4xx raised outside of the AppError hierarchy. */
const CLIENT_ERRORS: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: 'Malformed request' },
  401: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
  403: { code: 'FORBIDDEN', message: 'Forbidden' },
  404: { code: 'NOT_FOUND', message: 'Not found' },
  405: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
  409: { code: 'CONFLICT', message: 'Conflict' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests' },
};

/**
 * Global error handler middleware
 * Must be last middleware in the chain
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(
      {
        statusCode: err.statusCode,
        code: err.code,
        path: req.path,
        method: req.method,
      },
      err.message,
    );

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Client errors raised outside our hierarchy (body-parser, cors, express...):
  // honour the status they carry instead of flattening everything to a 500.
  const raw = err as Error & {
    status?: unknown;
    statusCode?: unknown;
    type?: unknown;
  };
  const tagged =
    typeof raw.type === 'string' ? BODY_PARSER_ERRORS[raw.type] : undefined;
  const rawStatus = Number(raw.status ?? raw.statusCode);
  const status =
    tagged?.status ??
    (Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 500
      ? rawStatus
      : undefined);

  if (status !== undefined) {
    const { code, message } =
      tagged ?? CLIENT_ERRORS[status] ?? CLIENT_ERRORS[400];

    logger.warn(
      {
        statusCode: status,
        code,
        type: raw.type,
        path: req.path,
        method: req.method,
        original: err.message,
      },
      'Client error',
    );

    res.status(status).json({
      error: {
        code,
        message,
      },
    });
    return;
  }

  // Unexpected errors
  logger.error(
    {
      path: req.path,
      method: req.method,
      stack: err.stack,
    },
    'Unexpected error',
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'An unexpected error occurred',
    },
  });
}

/**
 * Async error wrapper for route handlers
 * Catches thrown errors and passes to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
