import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  Role,
  BookingStatus,
  CreateLotRequestSchema,
  UpdateLotRequestSchema,
  GenerateSlotsRequestSchema,
  AdminBookingsQuerySchema,
  UpdateUserRoleRequestSchema,
  CreateDeviceRequestSchema,
} from '@smart-parking/shared';
import {
  adminCreateLot,
  adminUpdateLot,
  adminDeleteLot,
  adminGenerateSlots,
  adminReleaseSlot,
  adminGetBookings,
  adminGetUsers,
  adminUpdateUserRole,
  adminCreateDevice,
  adminGetDevices,
  adminRevokeDevice,
  adminGetAuditLogs,
} from '../services/admin.service.js';

export const adminRouter = Router();

// Protect all admin routes per Contract C5, C7 & Security Rule 6
adminRouter.use(requireAuth);
adminRouter.use(requireRole(Role.ADMIN));

// POST /api/v1/admin/lots
adminRouter.post(
  '/lots',
  validate({ body: CreateLotRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await adminCreateLot(req.user!.userId, req.body);
      sendSuccess(res, data, 201);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/lots/:id
adminRouter.put(
  '/lots/:id',
  validate({ body: UpdateLotRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const data = await adminUpdateLot(req.user!.userId, id, req.body);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/lots/:id (deactivates)
adminRouter.delete(
  '/lots/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const data = await adminDeleteLot(req.user!.userId, id);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/admin/lots/:id/generate-slots
adminRouter.post(
  '/lots/:id/generate-slots',
  validate({ body: GenerateSlotsRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const data = await adminGenerateSlots(req.user!.userId, id, req.body.count);
      sendSuccess(res, data, 201);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/slots/:id/release
adminRouter.put(
  '/slots/:id/release',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const data = await adminReleaseSlot(req.user!.userId, id);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/bookings?status=
adminRouter.get(
  '/bookings',
  validate({ query: AdminBookingsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = req.query.status as BookingStatus | undefined;
      const data = await adminGetBookings(status);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/users
adminRouter.get(
  '/users',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await adminGetUsers();
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/users/:id/role
adminRouter.put(
  '/users/:id/role',
  validate({ body: UpdateUserRoleRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const data = await adminUpdateUserRole(
        req.user!.userId,
        id,
        req.body.role,
        req.body.assignedLotId
      );
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/admin/devices
adminRouter.post(
  '/devices',
  validate({ body: CreateDeviceRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await adminCreateDevice(req.user!.userId, req.body);
      sendSuccess(res, data, 201);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/devices
adminRouter.get(
  '/devices',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await adminGetDevices();
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/devices/:id (revokes)
adminRouter.delete(
  '/devices/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const data = await adminRevokeDevice(req.user!.userId, id);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/audit-log
adminRouter.get(
  '/audit-log',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await adminGetAuditLogs();
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);
