/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { hashToken, signAccessToken } from './lib/crypto.js';
import { Role } from '@smart-parking/shared';
import * as ingestionService from './services/ingestion.service.js';
import * as guardService from './services/guard.service.js';
import { NotFoundError, ConflictError } from './lib/errors.js';
import { ErrorCode } from '@smart-parking/shared';

describe('Stage 5 Sensors, Guard & Admin API Suite', () => {
  const app = createApp();

  const userToken = signAccessToken({ sub: 'usr_normal', role: Role.USER });
  const guardToken = signAccessToken({ sub: 'usr_guard', role: Role.GUARD });
  const adminToken = signAccessToken({ sub: 'usr_admin', role: Role.ADMIN });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.user, 'findUnique').mockImplementation(((args: any) => {
      const id = args?.where?.id;
      if (id === 'usr_admin') {
        return Promise.resolve({ id: 'usr_admin', role: Role.ADMIN, assignedLotId: null });
      }
      if (id === 'usr_guard') {
        return Promise.resolve({ id: 'usr_guard', role: Role.GUARD, assignedLotId: 'lot_001' });
      }
      if (id === 'usr_normal') {
        return Promise.resolve({ id: 'usr_normal', role: Role.USER, assignedLotId: null });
      }
      return Promise.resolve(null);
    }) as any);
  });

  describe('Sensors API (POST /api/v1/sensors/events)', () => {
    const rawKey = 'test-raw-device-key-32-chars-long-here';
    const keyHash = hashToken(rawKey);

    it('successfully ingests event with active valid device key', async () => {
      vi.spyOn(prisma.device, 'findUnique').mockResolvedValue({
        id: 'dev_001',
        name: 'Gate Camera 1',
        kind: 'SENSOR',
        parkingLotId: 'lot_001',
        keyHash,
        isActive: true,
        revokedAt: null,
        createdAt: new Date(),
      } as unknown as any);

      vi.spyOn(ingestionService, 'ingestSensorEvent').mockResolvedValue({ applied: true });

      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', rawKey)
        .send({
          slotId: 'slot_001',
          status: 'OCCUPIED',
          timestamp: '2026-10-05T12:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applied).toBe(true);
      expect(ingestionService.ingestSensorEvent).toHaveBeenCalledWith(
        'dev_001',
        'slot_001',
        'OCCUPIED',
        new Date('2026-10-05T12:00:00.000Z')
      );
    });

    it('rejects unknown device key with 401 UNAUTHORIZED', async () => {
      vi.spyOn(prisma.device, 'findUnique').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', 'unknown-key')
        .send({
          slotId: 'slot_001',
          status: 'AVAILABLE',
          timestamp: '2026-10-05T12:00:00.000Z',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects revoked device key with 401 UNAUTHORIZED', async () => {
      vi.spyOn(prisma.device, 'findUnique').mockResolvedValue({
        id: 'dev_001',
        name: 'Revoked Device',
        keyHash,
        isActive: false,
        revokedAt: new Date(),
      } as unknown as any);

      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', rawKey)
        .send({
          slotId: 'slot_001',
          status: 'OCCUPIED',
          timestamp: '2026-10-05T12:00:00.000Z',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid status (e.g. BROKEN) with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', rawKey)
        .send({
          slotId: 'slot_001',
          status: 'BROKEN',
          timestamp: '2026-10-05T12:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Guard API Security & Endpoints', () => {
    it('refuses USER role on guard board with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/guard/lots/lot_001/board')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('refuses USER role on check-in with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/v1/guard/check-in')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingCode: 'ABC234' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('refuses USER role on walk-in with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/v1/guard/slots/slot_001/walk-in')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'OCCUPIED' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('rejects malformed booking codes (containing 0 or O) with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/guard/check-in')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ bookingCode: 'AB0O12' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('passes through 404 NOT_FOUND from service when booking code does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_guard',
        role: Role.GUARD,
        assignedLotId: 'lot_001',
      } as unknown as any);

      vi.spyOn(guardService, 'checkInBooking').mockRejectedValue(
        new NotFoundError(ErrorCode.NOT_FOUND, 'Booking with code ABC234 not found')
      );

      const res = await request(app)
        .post('/api/v1/guard/check-in')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ bookingCode: 'ABC234' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('passes through 409 BOOKING_NOT_ELIGIBLE on second check-in attempt', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_guard',
        role: Role.GUARD,
        assignedLotId: 'lot_001',
      } as unknown as any);

      vi.spyOn(guardService, 'checkInBooking').mockRejectedValue(
        new ConflictError(ErrorCode.BOOKING_NOT_ELIGIBLE, 'Booking has already checked in')
      );

      const res = await request(app)
        .post('/api/v1/guard/check-in')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ bookingCode: 'ABC234' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('BOOKING_NOT_ELIGIBLE');
    });

    it('passes through 409 SLOT_UNAVAILABLE when marking a held slot as walk-in', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_guard',
        role: Role.GUARD,
        assignedLotId: 'lot_001',
      } as unknown as any);

      vi.spyOn(guardService, 'guardSetSlotStatus').mockRejectedValue(
        new ConflictError(ErrorCode.SLOT_UNAVAILABLE, 'Slot is currently HELD or RESERVED')
      );

      const res = await request(app)
        .post('/api/v1/guard/slots/slot_001/walk-in')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ status: 'OCCUPIED' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SLOT_UNAVAILABLE');
    });
  });

  describe('Admin API Security & Endpoints', () => {
    it('refuses non-admin user on all admin endpoints with 403 FORBIDDEN', async () => {
      const resLots = await request(app)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${userToken}`);
      expect(resLots.status).toBe(403);
      expect(resLots.body.code).toBe('FORBIDDEN');

      const resAudit = await request(app)
        .get('/api/v1/admin/audit-log')
        .set('Authorization', `Bearer ${guardToken}`);
      expect(resAudit.status).toBe(403);
      expect(resAudit.body.code).toBe('FORBIDDEN');
    });

    it('creates a device, hashes key, returns raw key once, and writes audit log in transaction', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_admin',
        role: Role.ADMIN,
      } as unknown as any);

      const createdDevice = {
        id: 'dev_new_123',
        name: 'Gate Exit Sensor',
        kind: 'SENSOR',
        parkingLotId: null,
        keyHash: 'fake_hash',
        isActive: true,
        revokedAt: null,
        createdAt: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const tx = {
          device: { create: vi.fn().mockResolvedValue(createdDevice) },
          auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud_1' }) },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/admin/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Gate Exit Sensor',
          kind: 'SENSOR',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.device.name).toBe('Gate Exit Sensor');
      expect(res.body.data.rawKey).toBeDefined();
      expect(res.body.data.rawKey.length).toBe(64); // 32 random bytes in hex
    });

    it('rejects assigning role GUARD without assignedLotId with 400 VALIDATION_ERROR', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_admin',
        role: Role.ADMIN,
      } as unknown as any);

      const res = await request(app)
        .put('/api/v1/admin/users/usr_target/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'GUARD',
          assignedLotId: null,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('successfully updates user to GUARD with valid assignedLotId in transaction', async () => {
      vi.spyOn(prisma.user, 'findUnique')
        .mockResolvedValueOnce({ id: 'usr_admin', role: Role.ADMIN } as unknown as any)
        .mockResolvedValueOnce({ id: 'usr_target', role: Role.USER } as unknown as any);

      vi.spyOn(prisma.parkingLot, 'findUnique').mockResolvedValue({
        id: 'lot_001',
        isActive: true,
      } as unknown as any);

      const updatedUser = {
        id: 'usr_target',
        name: 'John Guard',
        email: 'guard@example.com',
        role: Role.GUARD,
        assignedLotId: 'lot_001',
        createdAt: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const tx = {
          user: { update: vi.fn().mockResolvedValue(updatedUser) },
          auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud_2' }) },
        };
        return cb(tx);
      });

      const res = await request(app)
        .put('/api/v1/admin/users/usr_target/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'GUARD',
          assignedLotId: 'lot_001',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('GUARD');
      expect(res.body.data.assignedLotId).toBe('lot_001');
    });
  });
});
