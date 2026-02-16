import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, UnauthorizedError } from '../shared/types.js';
import { getLogger } from '../shared/logger.js';

const logger = getLogger('ErrorHandler');

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
