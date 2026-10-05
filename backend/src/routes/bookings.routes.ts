import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import { requireAuth } from '../middleware/auth.js';
import {
  CreateBookingRequestSchema,
  CreateBookingHeadersSchema,
  BookingStatus,
  BookingView,
  GetMyBookingsResponseData,
} from '@smart-parking/shared';
import { holdSlot, cancelBooking } from '../services/reservations.service.js';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { ErrorCode } from '@smart-parking/shared';
import type { Booking } from '@prisma/client';

export const bookingsRouter = Router();

function formatBookingView(booking: Booking): BookingView {
  return {
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
}

// POST /api/v1/bookings
bookingsRouter.post(
  '/',
  requireAuth,
  validate({
    headers: CreateBookingHeadersSchema,
    body: CreateBookingRequestSchema,
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { slotId, startTime, endTime, vehicleNumber } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] as string) || '';
      const userId = req.user!.userId;

      const booking = await holdSlot(
        userId,
        slotId,
        new Date(startTime),
        new Date(endTime),
        idempotencyKey,
        vehicleNumber
      );

      sendSuccess(res, formatBookingView(booking), 201);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/bookings/my
bookingsRouter.get(
  '/my',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const bookings = await prisma.booking.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const data: GetMyBookingsResponseData = bookings.map(formatBookingView);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/bookings/:id
bookingsRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const userId = req.user!.userId;

      const booking = await cancelBooking(userId, id);
      sendSuccess(res, formatBookingView(booking), 200);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        // Security Rule 6: someone else's booking returns 404 NOT_FOUND, not 403
        next(new NotFoundError(ErrorCode.NOT_FOUND, 'Booking not found'));
        return;
      }
      next(err);
    }
  }
);
