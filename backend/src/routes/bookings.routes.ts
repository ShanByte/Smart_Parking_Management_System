import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import {
  CreateBookingRequestSchema,
  CreateBookingHeadersSchema,
  BookingStatus,
  BookingView,
  CreateBookingResponseData,
  GetMyBookingsResponseData,
  CancelBookingResponseData,
} from '@smart-parking/shared';

export const bookingsRouter = Router();

const mockBooking: BookingView = {
  id: 'bk_stub_001',
  slotId: 'slot_stub_001',
  status: BookingStatus.HELD,
  startTime: '2026-10-05T12:00:00.000Z',
  endTime: '2026-10-05T13:00:00.000Z',
  amountPaise: 4000,
  heldUntil: '2026-10-05T12:05:00.000Z',
  bookingCode: 'ABC234',
  vehicleNumber: 'MH12AB1234',
  checkedInAt: null,
};

// POST /api/v1/bookings
// STUB: replace in Stage 3
bookingsRouter.post(
  '/',
  validate({
    headers: CreateBookingHeadersSchema,
    body: CreateBookingRequestSchema,
  }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 3
    const data: CreateBookingResponseData = {
      ...mockBooking,
      slotId: req.body.slotId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      vehicleNumber: req.body.vehicleNumber ?? null,
    };
    sendSuccess(res, data, 201);
  }
);

// GET /api/v1/bookings/my
// STUB: replace in Stage 3
bookingsRouter.get('/my', (_req: Request, res: Response) => {
  // STUB: replace in Stage 3
  const data: GetMyBookingsResponseData = [mockBooking];
  sendSuccess(res, data, 200);
});

// DELETE /api/v1/bookings/:id
// STUB: replace in Stage 3
bookingsRouter.delete('/:id', (req: Request, res: Response) => {
  // STUB: replace in Stage 3
  const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? mockBooking.id);
  const data: CancelBookingResponseData = {
    ...mockBooking,
    id,
    status: BookingStatus.CANCELLED,
  };
  sendSuccess(res, data, 200);
});
