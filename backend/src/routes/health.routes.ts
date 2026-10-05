import { Router, Request, Response } from 'express';
import { sendSuccess, sendFailure } from '../lib/respond.js';
import { ErrorCode } from '@smart-parking/shared';

export const healthRouter = Router();

// C4: Unversioned, no auth: GET /health -> 200 { success: true, data: { status: "ok" } }
healthRouter.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, { status: 'ok' });
});

// C4: GET /ready -> 200 { success: true, data: { db: "ok", redis: "ok" } } or 503 NOT_READY
// BLOCKED until Member 2 delivers prisma and redis clients
healthRouter.get('/ready', (_req: Request, res: Response) => {
  // STUB: replace in Stage 2/3 when Member 2 delivers prisma and redis clients
  const isDbReady = false;
  const isRedisReady = false;

  if (isDbReady && isRedisReady) {
    sendSuccess(res, { db: 'ok', redis: 'ok' });
  } else {
    sendFailure(
      res,
      'Database and Redis dependencies not connected yet',
      ErrorCode.NOT_READY,
      503
    );
  }
});
