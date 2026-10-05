import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { paymentsRateLimiter } from '../middleware/rateLimiter.js';
import { sendSuccess } from '../lib/respond.js';
import { env } from '../config/env.js';
import {
  CreatePaymentOrderRequestSchema,
  VerifyPaymentRequestSchema,
  RefundPaymentRequestSchema,
  DemoConfirmPaymentRequestSchema,
  BookingStatus,
  BookingView,
  Role,
} from '@smart-parking/shared';
import {
  createOrder,
  verifyPayment,
  processWebhook,
  refundPayment,
  demoConfirmPayment,
} from '../services/payments.service.js';
import type { Booking } from '@prisma/client';

export const paymentsRouter = Router();

// Apply payments rate limiter per Security Rule 7
paymentsRouter.use(paymentsRateLimiter);

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

// POST /api/v1/payments/create-order
paymentsRouter.post(
  '/create-order',
  requireAuth,
  validate({ body: CreatePaymentOrderRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await createOrder(
        req.body.bookingId,
        req.user!.userId,
        req.user!.role === Role.ADMIN
      );
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/payments/verify
paymentsRouter.post(
  '/verify',
  requireAuth,
  validate({ body: VerifyPaymentRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const confirmedBooking = await verifyPayment(
        req.user!.userId,
        req.body,
        req.user!.role === Role.ADMIN
      );
      sendSuccess(res, formatBookingView(confirmedBooking), 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/payments/webhook
paymentsRouter.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string | undefined;
      const eventId = req.headers['x-razorpay-event-id'] as string | undefined;

      const result = await processWebhook(req.body, signature, eventId);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/payments/refund (ADMIN only per C7 & Security Rule 6)
paymentsRouter.post(
  '/refund',
  requireAuth,
  requireRole(Role.ADMIN),
  validate({ body: RefundPaymentRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await refundPayment(req.body.bookingId);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/payments/demo-confirm (exists only when DEMO_PAY_ENABLED=true)
paymentsRouter.post(
  '/demo-confirm',
  (req: Request, _res: Response, next: NextFunction) => {
    if (!env.DEMO_PAY_ENABLED) {
      // Route is absent when disabled -> falls through to 404
      return next();
    }
    next();
  },
  requireAuth,
  validate({ body: DemoConfirmPaymentRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const confirmedBooking = await demoConfirmPayment(
        req.user!.userId,
        req.body.bookingId,
        req.user!.role === Role.ADMIN
      );
      sendSuccess(res, formatBookingView(confirmedBooking), 200);
    } catch (err) {
      next(err);
    }
  }
);
