import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { guardCheckInRateLimiter } from '../middleware/rateLimiter.js';
import {
  GuardCheckInRequestSchema,
  GuardWalkInRequestSchema,
  Role,
  BookingStatus,
  BookingView,
  GuardWalkInResponseData,
  SlotSource,
} from '@smart-parking/shared';
import {
  getGuardBoard,
  checkInBooking,
  guardSetSlotStatus,
} from '../services/guard.service.js';

export const guardRouter = Router();

// Protect all guard routes per Contract C5 & Security Rule 14
guardRouter.use(requireAuth);
guardRouter.use(requireRole(Role.GUARD, Role.ADMIN));

// GET /api/v1/guard/lots/:lotId/board
// Per Frozen Contract C7 & C9
guardRouter.get(
  '/lots/:lotId/board',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lotId = Array.isArray(req.params.lotId)
        ? req.params.lotId[0]!
        : (req.params.lotId ?? '');
      const guardUserId = req.user!.userId;

      const board = await getGuardBoard(guardUserId, lotId);
      sendSuccess(res, board, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/guard/check-in
// Per Frozen Contract C7, C9 & Security Rule 14 (strict rate limit against code guessing)
guardRouter.post(
  '/check-in',
  guardCheckInRateLimiter,
  validate({ body: GuardCheckInRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const guardUserId = req.user!.userId;
      const { bookingCode } = req.body;

      const booking = await checkInBooking(guardUserId, bookingCode);

      // Sanitize response to omit user private data (Security Rule 14)
      const data: BookingView = {
        id: booking.id,
        slotId: booking.slotId,
        status: booking.status as BookingStatus,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        amountPaise: booking.amountPaise,
        heldUntil: booking.heldUntil ? booking.heldUntil.toISOString() : null,
        bookingCode: booking.bookingCode,
        vehicleNumber: booking.vehicleNumber,
        checkedInAt: booking.checkedInAt ? booking.checkedInAt.toISOString() : null,
      };

      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/guard/slots/:slotId/walk-in
// Per Frozen Contract C7 & C9
guardRouter.post(
  '/slots/:slotId/walk-in',
  validate({ body: GuardWalkInRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slotId = Array.isArray(req.params.slotId)
        ? req.params.slotId[0]!
        : (req.params.slotId ?? '');
      const guardUserId = req.user!.userId;
      const { status } = req.body;

      const result = await guardSetSlotStatus(guardUserId, slotId, status);

      const data: GuardWalkInResponseData = {
        slotId: result.slotId,
        status: result.status,
        source: SlotSource.GUARD,
      };

      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);
