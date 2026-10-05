import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import { env } from '../config/env.js';
import {
  CreatePaymentOrderRequestSchema,
  VerifyPaymentRequestSchema,
  RefundPaymentRequestSchema,
  DemoConfirmPaymentRequestSchema,
  BookingStatus,
  BookingView,
  CreatePaymentOrderResponseData,
  VerifyPaymentResponseData,
  RefundPaymentResponseData,
  DemoConfirmPaymentResponseData,
} from '@smart-parking/shared';

export const paymentsRouter = Router();

const mockBooking: BookingView = {
  id: 'bk_stub_001',
  slotId: 'slot_stub_001',
  status: BookingStatus.CONFIRMED,
  startTime: '2026-10-05T12:00:00.000Z',
  endTime: '2026-10-05T13:00:00.000Z',
  amountPaise: 4000,
  heldUntil: null,
  bookingCode: 'ABC234',
  vehicleNumber: 'MH12AB1234',
  checkedInAt: null,
};

// POST /api/v1/payments/create-order
// STUB: replace in Stage 4
paymentsRouter.post(
  '/create-order',
  validate({ body: CreatePaymentOrderRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 4
    const data: CreatePaymentOrderResponseData = {
      orderId: 'order_stub_001',
      amountPaise: 4000,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID ?? 'rzp_test_stub',
    };
    sendSuccess(res, data, 200);
  }
);

// POST /api/v1/payments/verify
// STUB: replace in Stage 4
paymentsRouter.post(
  '/verify',
  validate({ body: VerifyPaymentRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 4
    const data: VerifyPaymentResponseData = {
      ...mockBooking,
      id: req.body.bookingId,
      status: BookingStatus.CONFIRMED,
    };
    sendSuccess(res, data, 200);
  }
);

// POST /api/v1/payments/webhook
// STUB: replace in Stage 4
paymentsRouter.post('/webhook', (req: Request, res: Response) => {
  // STUB: replace in Stage 4
  sendSuccess(res, { received: true }, 200);
});

// POST /api/v1/payments/refund
// STUB: replace in Stage 4
paymentsRouter.post(
  '/refund',
  validate({ body: RefundPaymentRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 4
    const data: RefundPaymentResponseData = {
      status: 'REFUNDED',
      bookingId: req.body.bookingId,
      amountPaise: 4000,
    };
    sendSuccess(res, data, 200);
  }
);

// POST /api/v1/payments/demo-confirm (exists only when DEMO_PAY_ENABLED=true)
// STUB: replace in Stage 4
if (env.DEMO_PAY_ENABLED) {
  paymentsRouter.post(
    '/demo-confirm',
    validate({ body: DemoConfirmPaymentRequestSchema }),
    (req: Request, res: Response) => {
      // STUB: replace in Stage 4
      const data: DemoConfirmPaymentResponseData = {
        ...mockBooking,
        id: req.body.bookingId,
        status: BookingStatus.CONFIRMED,
      };
      sendSuccess(res, data, 200);
    }
  );
}
