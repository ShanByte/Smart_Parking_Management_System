import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import {
  CreateLotRequestSchema,
  UpdateLotRequestSchema,
  GenerateSlotsRequestSchema,
  AdminBookingsQuerySchema,
  UpdateUserRoleRequestSchema,
  CreateDeviceRequestSchema,
  Role,
  SlotStatus,
  BookingStatus,
  SlotSource,
  ParkingLotView,
  UserView,
  DeviceView,
  AuditLogView,
  SlotView,
  BookingView,
  DeleteLotResponseData,
  GenerateSlotsResponseData,
  ReleaseSlotResponseData,
  DeleteDeviceResponseData,
  CreateDeviceResponseData,
} from '@smart-parking/shared';

export const adminRouter = Router();

const mockLot: ParkingLotView = {
  id: 'lot_stub_001',
  name: 'FC Road Smart Parking',
  address: 'Fergusson College Rd, Shivajinagar, Pune',
  latitude: 18.5204,
  longitude: 73.8567,
  totalSlots: 50,
  pricePerHourPaise: 4000,
  isActive: true,
};

const mockUser: UserView = {
  id: 'usr_stub_001',
  name: 'Demo Admin',
  email: 'admin@example.com',
  role: Role.ADMIN,
  assignedLotId: null,
  createdAt: '2026-10-05T00:00:00.000Z',
};

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

const mockDevice: DeviceView = {
  id: 'dev_stub_001',
  name: 'Gate Simulator',
  kind: SlotSource.SIM,
  parkingLotId: 'lot_stub_001',
  isActive: true,
  revokedAt: null,
  createdAt: '2026-10-05T00:00:00.000Z',
};

const mockAuditLog: AuditLogView = {
  id: 'aud_stub_001',
  adminId: 'usr_stub_001',
  action: 'CREATE_LOT',
  targetType: 'ParkingLot',
  targetId: 'lot_stub_001',
  details: { name: 'FC Road Smart Parking' },
  createdAt: '2026-10-05T00:00:00.000Z',
};

// POST /api/v1/admin/lots
// STUB: replace in Stage 5
adminRouter.post(
  '/lots',
  validate({ body: CreateLotRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const data: ParkingLotView = {
      ...mockLot,
      name: req.body.name,
      address: req.body.address,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      totalSlots: req.body.totalSlots,
      pricePerHourPaise: req.body.pricePerHourPaise,
    };
    sendSuccess(res, data, 201);
  }
);

// PUT /api/v1/admin/lots/:id
// STUB: replace in Stage 5
adminRouter.put(
  '/lots/:id',
  validate({ body: UpdateLotRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const data: ParkingLotView = {
      ...mockLot,
      id: req.params.id || mockLot.id,
      ...req.body,
    };
    sendSuccess(res, data, 200);
  }
);

// DELETE /api/v1/admin/lots/:id
// STUB: replace in Stage 5
adminRouter.delete('/lots/:id', (req: Request, res: Response) => {
  // STUB: replace in Stage 5
  const data: DeleteLotResponseData = {
    deactivated: true,
    lotId: req.params.id || mockLot.id,
  };
  sendSuccess(res, data, 200);
});

// POST /api/v1/admin/lots/:id/generate-slots
// STUB: replace in Stage 5
adminRouter.post(
  '/lots/:id/generate-slots',
  validate({ body: GenerateSlotsRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const count = req.body.count;
    const slots: SlotView[] = Array.from({ length: count }, (_, i) => ({
      id: `slot_stub_${i + 1}`,
      slotNumber: `A${i + 1}`,
      status: SlotStatus.AVAILABLE,
    }));
    const data: GenerateSlotsResponseData = { count, slots };
    sendSuccess(res, data, 201);
  }
);

// PUT /api/v1/admin/slots/:id/release
// STUB: replace in Stage 5
adminRouter.put('/slots/:id/release', (req: Request, res: Response) => {
  // STUB: replace in Stage 5
  const data: ReleaseSlotResponseData = {
    released: true,
    slotId: req.params.id || 'slot_stub_001',
  };
  sendSuccess(res, data, 200);
});

// GET /api/v1/admin/bookings
// STUB: replace in Stage 5
adminRouter.get(
  '/bookings',
  validate({ query: AdminBookingsQuerySchema }),
  (_req: Request, res: Response) => {
    // STUB: replace in Stage 5
    sendSuccess(res, [mockBooking], 200);
  }
);

// GET /api/v1/admin/users
// STUB: replace in Stage 5
adminRouter.get('/users', (_req: Request, res: Response) => {
  // STUB: replace in Stage 5
  sendSuccess(res, [mockUser], 200);
});

// PUT /api/v1/admin/users/:id/role
// STUB: replace in Stage 5
adminRouter.put(
  '/users/:id/role',
  validate({ body: UpdateUserRoleRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const data: UserView = {
      ...mockUser,
      id: req.params.id || mockUser.id,
      role: req.body.role,
      assignedLotId: req.body.assignedLotId ?? null,
    };
    sendSuccess(res, data, 200);
  }
);

// GET /api/v1/admin/devices
// STUB: replace in Stage 5
adminRouter.get('/devices', (_req: Request, res: Response) => {
  // STUB: replace in Stage 5
  sendSuccess(res, [mockDevice], 200);
});

// POST /api/v1/admin/devices
// STUB: replace in Stage 5
adminRouter.post(
  '/devices',
  validate({ body: CreateDeviceRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 5
    const data: CreateDeviceResponseData = {
      device: {
        ...mockDevice,
        name: req.body.name,
        kind: req.body.kind,
        parkingLotId: req.body.parkingLotId ?? null,
      },
      rawKey: 'dev_raw_key_shown_once_sample',
    };
    sendSuccess(res, data, 201);
  }
);

// DELETE /api/v1/admin/devices/:id
// STUB: replace in Stage 5
adminRouter.delete('/devices/:id', (req: Request, res: Response) => {
  // STUB: replace in Stage 5
  const data: DeleteDeviceResponseData = {
    revoked: true,
    deviceId: req.params.id || mockDevice.id,
  };
  sendSuccess(res, data, 200);
});

// GET /api/v1/admin/audit-log
// STUB: replace in Stage 5
adminRouter.get('/audit-log', (_req: Request, res: Response) => {
  // STUB: replace in Stage 5
  sendSuccess(res, [mockAuditLog], 200);
});
