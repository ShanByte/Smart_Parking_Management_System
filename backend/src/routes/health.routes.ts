import { Router, Request, Response } from 'express';
import { sendSuccess, sendFailure } from '../lib/respond.js';
import { ErrorCode } from '@smart-parking/shared';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

// C4: Unversioned, no auth: GET /health -> 200 { success: true, data: { status: "ok" } }
healthRouter.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, { status: 'ok' });
});

// C4: GET /ready -> 200 { success: true, data: { db: "ok", redis: "ok" } } or 503 NOT_READY
healthRouter.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  let isDbReady = false;
  let isRedisReady = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    isDbReady = true;
  } catch {
    isDbReady = false;
  }

  if (process.env.REDIS_URL) {
    try {
      const { redis } = await import('../lib/redis.js');
      const pong = await redis.ping();
      isRedisReady = pong === 'PONG';
    } catch {
      isRedisReady = false;
    }
  }

  if (isDbReady && isRedisReady) {
    sendSuccess(res, { db: 'ok', redis: 'ok' });
  } else {
    sendFailure(
      res,
      `Readiness check failed: db=${isDbReady ? 'ok' : 'unavailable'}, redis=${isRedisReady ? 'ok' : 'unavailable'}`,
      ErrorCode.NOT_READY,
      503
    );
  }
});
