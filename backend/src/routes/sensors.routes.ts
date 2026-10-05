import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import {
  SensorEventHeadersSchema,
  SensorEventRequestSchema,
  SensorEventResponseData,
  ErrorCode,
} from '@smart-parking/shared';
import { prisma } from '../lib/prisma.js';
import { hashToken } from '../lib/crypto.js';
import { UnauthorizedError } from '../lib/errors.js';
import { ingestSensorEvent } from '../services/ingestion.service.js';
import { sensorsRateLimiter } from '../middleware/rateLimiter.js';

export const sensorsRouter = Router();

// POST /api/v1/sensors/events
// Per Frozen Contract C5, C7, C9 & Security Rule 10
sensorsRouter.post(
  '/events',
  sensorsRateLimiter,
  validate({
    headers: SensorEventHeadersSchema,
    body: SensorEventRequestSchema,
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawKey = req.headers['x-device-key'] as string;
      const keyHash = hashToken(rawKey);

      const device = await prisma.device.findUnique({
        where: { keyHash },
      });

      if (!device || !device.isActive || device.revokedAt !== null) {
        throw new UnauthorizedError(
          ErrorCode.UNAUTHORIZED,
          'Invalid or revoked device key'
        );
      }

      const timestamp = new Date(req.body.timestamp);
      const result = await ingestSensorEvent(
        device.id,
        req.body.slotId,
        req.body.status,
        timestamp
      );

      const data: SensorEventResponseData = {
        applied: result.applied,
      };
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);
