import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { sendFailure } from '../lib/respond.js';
import { ErrorCode } from '@smart-parking/shared';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || undefined;

  if (err instanceof AppError) {
    logger.warn({ err, requestId, path: req.path }, err.message);
    sendFailure(res, err.message, err.code, err.statusCode, requestId);
    return;
  }

  // Handle express-rate-limit or unexpected errors
  logger.error({ err, requestId, path: req.path }, 'Unhandled server error');

  // Security Rule 8: Never send stack traces; unknown errors return 500 INTERNAL_ERROR with the requestId
  sendFailure(
    res,
    'Internal server error',
    ErrorCode.INTERNAL_ERROR,
    500,
    requestId
  );
}
