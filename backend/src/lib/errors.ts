import { ErrorCode } from '@smart-parking/shared';

export const ERROR_CODE_TO_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.SLOT_UNAVAILABLE]: 409,
  [ErrorCode.BOOKING_NOT_ELIGIBLE]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.NOT_READY]: 503,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode ?? ERROR_CODE_TO_STATUS[code] ?? 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(code: ErrorCode = ErrorCode.VALIDATION_ERROR, message: string = 'Validation failed') {
    super(code, message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: ErrorCode = ErrorCode.UNAUTHORIZED, message: string = 'Unauthorized') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: ErrorCode = ErrorCode.FORBIDDEN, message: string = 'Forbidden') {
    super(code, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(code: ErrorCode = ErrorCode.NOT_FOUND, message: string = 'Resource not found') {
    super(code, message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode = ErrorCode.CONFLICT, message: string = 'Conflict') {
    super(code, message, 409);
  }
}
