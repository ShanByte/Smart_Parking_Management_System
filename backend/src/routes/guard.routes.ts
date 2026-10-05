import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import {
  GuardCheckInRequestSchema,
  GuardWalkInRequestSchema,
  SlotStatus,
  BookingStatus,
  SlotSource,
  GuardBoard,
  BookingView,
  GuardWalkInResponseData,
} from '@smart-parking/shared';

export const guardRouter = Router();

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

// GET /api/v1/guard/lots/:lotId/board
// STUB: replace in Stage 5
guardRouter.get('/lots/:lotId/board', (req: Request, res: Response) => {
  // STUB: replace in Stage 5
  const lotId = Array.isArray(req.params.lotId) ? req.params.lotId[0]! : (req.params.lotId ?? 'lot_stub_001');
  const data: GuardBoard = {
    lot: {
      id: lotId,
      name: 'FC Road Smart Parking',
      totalSlots: 50,
    },
    slots: [
      {
        slotId: 'slot_stub_001',
        slotNumber: 'A1',
        status: SlotStatus.RESERVED,
        source: SlotSource.APP,
        booking: {
          bookingId: mockBooking.id,
          bookingCode: mockBooking.bookingCode,
          vehicleNumber: mockBooking.vehicleNumber,
          startTime: mockBooking.startTime,
          endTime: mockBooking.endTime,
          status: mockBooking.status,
          checkedInAt: null,
        },
      },
      {
        slotId: 'slot_stub_002',
        slotNumber: 'A2',
        status: SlotStatus.AVAILABLE,
        source: SlotSource.SIM,
        booking: null,
      },
    ],
  };
  sendSuccess(res, data, 200);
});

// POST /api/v1/guard/check-in
// STUB: replace in Stage 5
guardRouter.post(
  '/check-in',
  validate({ body: GuardCheckInRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const data: BookingView = {
      ...mockBooking,
      bookingCode: req.body.bookingCode,
      checkedInAt: '2026-10-05T12:05:00.000Z',
    };
    sendSuccess(res, data, 200);
  }
);

// POST /api/v1/guard/slots/:slotId/walk-in
// STUB: replace in Stage 5
guardRouter.post(
  '/slots/:slotId/walk-in',
  validate({ body: GuardWalkInRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const slotId = Array.isArray(req.params.slotId) ? req.params.slotId[0]! : (req.params.slotId ?? 'slot_stub_001');
    const data: GuardWalkInResponseData = {
      slotId,
      status: req.body.status === 'OCCUPIED' ? SlotStatus.OCCUPIED : SlotStatus.AVAILABLE,
      source: SlotSource.GUARD,
    };
    sendSuccess(res, data, 200);
  }
);
