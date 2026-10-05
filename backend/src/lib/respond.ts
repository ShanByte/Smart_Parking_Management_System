import { Response } from 'express';
import { ErrorCode, SuccessEnvelope, FailureEnvelope } from '@smart-parking/shared';

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): Response {
  const envelope: SuccessEnvelope<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(envelope);
}

export function sendFailure(
  res: Response,
  message: string,
  code: ErrorCode,
  statusCode: number = 400,
  requestId?: string
): Response {
  const envelope: FailureEnvelope = {
    success: false,
    message,
    code,
    ...(requestId ? { requestId } : {}),
  };
  return res.status(statusCode).json(envelope);
}
