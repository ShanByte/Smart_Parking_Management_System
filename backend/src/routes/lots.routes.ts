import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import {
  GetSlotsQuerySchema,
  SlotStatus,
  LotWithCount,
  SlotView,
  GetLotsResponseData,
  GetLotResponseData,
  GetSlotsResponseData,
  GetStatsResponseData,
} from '@smart-parking/shared';

export const lotsRouter = Router();

const mockLot: LotWithCount = {
  id: 'lot_stub_001',
  name: 'FC Road Smart Parking',
  address: 'Fergusson College Rd, Shivajinagar, Pune',
  latitude: 18.5204,
  longitude: 73.8567,
  totalSlots: 50,
  freeCount: 25,
  pricePerHourPaise: 4000,
};

const mockSlots: SlotView[] = [
  { id: 'slot_stub_001', slotNumber: 'A1', status: SlotStatus.AVAILABLE },
  { id: 'slot_stub_002', slotNumber: 'A2', status: SlotStatus.OCCUPIED },
  { id: 'slot_stub_003', slotNumber: 'A3', status: SlotStatus.RESERVED },
];

// GET /api/v1/parking-lots
// STUB: replace in Stage 3
lotsRouter.get('/', (_req: Request, res: Response) => {
  // STUB: replace in Stage 3
  const data: GetLotsResponseData = [mockLot];
  sendSuccess(res, data, 200);
});

// GET /api/v1/parking-lots/:id
// STUB: replace in Stage 3
lotsRouter.get('/:id', (req: Request, res: Response) => {
  // STUB: replace in Stage 3
  const data: GetLotResponseData = {
    ...mockLot,
    id: req.params.id || mockLot.id,
  };
  sendSuccess(res, data, 200);
});

// GET /api/v1/parking-lots/:id/slots?from=&to=
// STUB: replace in Stage 3
lotsRouter.get(
  '/:id/slots',
  validate({ query: GetSlotsQuerySchema }),
  (_req: Request, res: Response) => {
    // STUB: replace in Stage 3
    const data: GetSlotsResponseData = mockSlots;
    sendSuccess(res, data, 200);
  }
);

// GET /api/v1/parking-lots/:id/stats
// STUB: replace in Stage 3 (Member 4 provides backend/src/routes/stats.routes.ts)
lotsRouter.get('/:id/stats', (req: Request, res: Response) => {
  // STUB: replace in Stage 3 when Member 4 delivers stats.routes.ts
  const data: GetStatsResponseData = {
    parkingLotId: req.params.id || mockLot.id,
    totalSlots: 50,
    hours: [
      { hourOfDay: 9, averageOccupiedPercent: 45.5, samples: 10 },
      { hourOfDay: 10, averageOccupiedPercent: 78.0, samples: 12 },
    ],
  };
  sendSuccess(res, data, 200);
});
