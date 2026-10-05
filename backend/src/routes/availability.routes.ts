import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import { GetArrivalAvailabilityQuerySchema } from '@smart-parking/shared';
import { availabilityRateLimiter } from '../middleware/rateLimiter.js';
import { getArrivalAvailability } from '../services/availability.service.js';

export const availabilityRouter = Router();

// GET /api/v1/availability/arrival?arrivalTime=<UTC ISO-8601>
// Public endpoint per Feature A Contract Additions
availabilityRouter.get(
  '/arrival',
  availabilityRateLimiter,
  validate({ query: GetArrivalAvailabilityQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const arrivalTime = req.query.arrivalTime as string;
      const arrivalDate = new Date(arrivalTime);
      const data = await getArrivalAvailability(arrivalDate);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);
