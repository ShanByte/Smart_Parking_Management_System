import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import {
  SensorEventHeadersSchema,
  SensorEventRequestSchema,
  SensorEventResponseData,
} from '@smart-parking/shared';

export const sensorsRouter = Router();

// POST /api/v1/sensors/events
// STUB: replace in Stage 5
sensorsRouter.post(
  '/events',
  validate({
    headers: SensorEventHeadersSchema,
    body: SensorEventRequestSchema,
  }),
  (_req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const data: SensorEventResponseData = {
      applied: true,
    };
    sendSuccess(res, data, 200);
  }
);
