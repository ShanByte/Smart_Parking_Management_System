import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import type { User, RefreshToken, ParkingLot, Booking } from '@prisma/client';
import { hashPassword, signAccessToken, generateRefreshToken, hashToken } from './lib/crypto.js';
import { Role, SlotStatus } from '@smart-parking/shared';
import * as lotsService from './services/lots.service.js';
import * as reservationsService from './services/reservations.service.js';
import * as statsService from './services/stats.service.js';
import {
  RegisterResponseDataSchema,
  LoginResponseDataSchema,
  RefreshResponseDataSchema,
  LogoutResponseDataSchema,
  MeResponseDataSchema,
  GetLotsResponseDataSchema,
  GetLotResponseDataSchema,
  GetSlotsResponseDataSchema,
  GetStatsResponseDataSchema,
  CreateBookingResponseDataSchema,
  GetMyBookingsResponseDataSchema,
  CancelBookingResponseDataSchema,
  CreatePaymentOrderResponseDataSchema,
  VerifyPaymentResponseDataSchema,
  RefundPaymentResponseDataSchema,
  SensorEventResponseDataSchema,
  ParkingLotSchema,
  DeleteLotResponseDataSchema,
  GenerateSlotsResponseDataSchema,
  ReleaseSlotResponseDataSchema,
  AdminAuditLogResponseDataSchema,
  GuardBoardResponseDataSchema,
  GuardCheckInResponseDataSchema,
  GuardWalkInResponseDataSchema,
} from '@smart-parking/shared';

describe('C7 Endpoint Stubs Contract Parity', () => {
  const app = createApp();

  describe('Auth Endpoints', () => {
    it('POST /api/v1/auth/register matches RegisterResponseDataSchema', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'usr_001',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'USER',
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      } as unknown as User);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'securePassword123',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const parsed = RegisterResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/auth/login matches LoginResponseDataSchema', async () => {
      const passwordHash = await hashPassword('password123');
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_001',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'USER',
        passwordHash,
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      } as unknown as User);
      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({} as unknown as RefreshToken);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'demo@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = LoginResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/auth/refresh matches RefreshResponseDataSchema', async () => {
      const rawToken = generateRefreshToken();
      vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue({
        id: 'tok_001',
        tokenHash: hashToken(rawToken),
        userId: 'usr_001',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        user: {
          id: 'usr_001',
          name: 'Demo User',
          email: 'demo@example.com',
          role: 'USER',
          assignedLotId: null,
          createdAt: new Date('2026-10-05T00:00:00.000Z'),
        },
      } as unknown as (RefreshToken & { user: User }));
      vi.spyOn(prisma.refreshToken, 'update').mockResolvedValue({} as unknown as RefreshToken);
      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({} as unknown as RefreshToken);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', [`refresh_token=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = RefreshResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/auth/logout matches LogoutResponseDataSchema', async () => {
      const rawToken = generateRefreshToken();
      vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', [`refresh_token=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = LogoutResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('GET /api/v1/auth/me matches MeResponseDataSchema', async () => {
      const token = signAccessToken({ sub: 'usr_001', role: Role.USER });
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_001',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'USER',
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      } as unknown as User);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = MeResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Parking Lots Endpoints', () => {
    it('GET /api/v1/parking-lots matches GetLotsResponseDataSchema', async () => {
      vi.spyOn(lotsService, 'getLotsWithFreeCount').mockResolvedValue([
        {
          id: 'lot_001',
          name: 'Pune Station Parking',
          address: 'Station Rd, Pune',
          latitude: 18.5284,
          longitude: 73.8743,
          totalSlots: 100,
          freeCount: 50,
          pricePerHourPaise: 5000,
        },
      ]);

      const res = await request(app).get('/api/v1/parking-lots');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GetLotsResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('GET /api/v1/parking-lots/:id matches GetLotResponseDataSchema', async () => {
      vi.spyOn(lotsService, 'getLot').mockResolvedValue({
        id: 'lot_001',
        name: 'Pune Station Parking',
        address: 'Station Rd, Pune',
        latitude: 18.5284,
        longitude: 73.8743,
        totalSlots: 100,
        freeCount: 50,
        pricePerHourPaise: 5000,
      });

      const res = await request(app).get('/api/v1/parking-lots/lot_001');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GetLotResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('GET /api/v1/parking-lots/:id/slots matches GetSlotsResponseDataSchema', async () => {
      vi.spyOn(lotsService, 'getSlotsByLot').mockResolvedValue([
        { id: 'slot_001', slotNumber: 'A1', status: SlotStatus.AVAILABLE },
      ]);

      const res = await request(app).get('/api/v1/parking-lots/lot_001/slots');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GetSlotsResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('GET /api/v1/parking-lots/:id/stats matches GetStatsResponseDataSchema', async () => {
      vi.spyOn(prisma.parkingLot, 'findUnique').mockResolvedValue({
        id: 'lot_001',
        name: 'Pune Station Parking',
        address: 'Station Rd, Pune',
        latitude: 18.5284,
        longitude: 73.8743,
        totalSlots: 100,
        pricePerHourPaise: 5000,
        isActive: true,
      } as unknown as ParkingLot);
      vi.spyOn(statsService, 'getHourlyStats').mockResolvedValue([
        { hourOfDay: 10, averageOccupiedPercent: 40.0, samples: 5 },
      ]);

      const res = await request(app).get('/api/v1/parking-lots/lot_001/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GetStatsResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Bookings Endpoints', () => {
    const bookingToken = signAccessToken({ sub: 'usr_001', role: Role.USER });

    it('POST /api/v1/bookings matches CreateBookingResponseDataSchema', async () => {
      vi.spyOn(reservationsService, 'holdSlot').mockResolvedValue({
        id: 'bk_001',
        userId: 'usr_001',
        slotId: 'slot_001',
        status: 'HELD',
        startTime: new Date('2026-10-05T12:00:00.000Z'),
        endTime: new Date('2026-10-05T13:00:00.000Z'),
        amountPaise: 5000,
        heldUntil: new Date('2026-10-05T12:05:00.000Z'),
        bookingCode: 'ABC234',
        vehicleNumber: 'MH12AB1234',
        idempotencyKey: 'idem-12345678',
        checkedInAt: null,
        createdAt: new Date('2026-10-05T11:59:00.000Z'),
      } as unknown as Booking);

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${bookingToken}`)
        .set('idempotency-key', 'idem-12345678')
        .send({
          slotId: 'slot_001',
          startTime: '2026-10-05T12:00:00.000Z',
          endTime: '2026-10-05T13:00:00.000Z',
          vehicleNumber: 'MH12AB1234',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const parsed = CreateBookingResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('GET /api/v1/bookings/my matches GetMyBookingsResponseDataSchema', async () => {
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([
        {
          id: 'bk_001',
          userId: 'usr_001',
          slotId: 'slot_001',
          status: 'HELD',
          startTime: new Date('2026-10-05T12:00:00.000Z'),
          endTime: new Date('2026-10-05T13:00:00.000Z'),
          amountPaise: 5000,
          heldUntil: new Date('2026-10-05T12:05:00.000Z'),
          bookingCode: 'ABC234',
          vehicleNumber: 'MH12AB1234',
          idempotencyKey: 'idem-12345678',
          checkedInAt: null,
          createdAt: new Date('2026-10-05T11:59:00.000Z'),
        } as unknown as Booking,
      ]);

      const res = await request(app)
        .get('/api/v1/bookings/my')
        .set('Authorization', `Bearer ${bookingToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GetMyBookingsResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('DELETE /api/v1/bookings/:id matches CancelBookingResponseDataSchema', async () => {
      vi.spyOn(reservationsService, 'cancelBooking').mockResolvedValue({
        id: 'bk_001',
        userId: 'usr_001',
        slotId: 'slot_001',
        status: 'CANCELLED',
        startTime: new Date('2026-10-05T12:00:00.000Z'),
        endTime: new Date('2026-10-05T13:00:00.000Z'),
        amountPaise: 5000,
        heldUntil: new Date('2026-10-05T12:05:00.000Z'),
        bookingCode: 'ABC234',
        vehicleNumber: 'MH12AB1234',
        idempotencyKey: 'idem-12345678',
        checkedInAt: null,
        createdAt: new Date('2026-10-05T11:59:00.000Z'),
      } as unknown as Booking);

      const res = await request(app)
        .delete('/api/v1/bookings/bk_001')
        .set('Authorization', `Bearer ${bookingToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = CancelBookingResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Payments Endpoints', () => {
    it('POST /api/v1/payments/create-order matches CreatePaymentOrderResponseDataSchema', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .send({ bookingId: 'bk_001' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = CreatePaymentOrderResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/payments/verify matches VerifyPaymentResponseDataSchema', async () => {
      const res = await request(app)
        .post('/api/v1/payments/verify')
        .send({
          bookingId: 'bk_001',
          razorpayOrderId: 'order_123',
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'sig_123',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = VerifyPaymentResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/payments/refund matches RefundPaymentResponseDataSchema', async () => {
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .send({ bookingId: 'bk_001' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = RefundPaymentResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Sensors Endpoints', () => {
    it('POST /api/v1/sensors/events matches SensorEventResponseDataSchema', async () => {
      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', 'raw-device-key-test')
        .send({
          slotId: 'slot_001',
          status: 'OCCUPIED',
          timestamp: '2026-10-05T12:00:00.000Z',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = SensorEventResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Admin Endpoints', () => {
    it('POST /api/v1/admin/lots matches ParkingLotSchema', async () => {
      const res = await request(app)
        .post('/api/v1/admin/lots')
        .send({
          name: 'Pune Station Parking',
          address: 'Station Rd, Pune',
          latitude: 18.5284,
          longitude: 73.8743,
          totalSlots: 100,
          pricePerHourPaise: 5000,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const parsed = ParkingLotSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('DELETE /api/v1/admin/lots/:id matches DeleteLotResponseDataSchema', async () => {
      const res = await request(app).delete('/api/v1/admin/lots/lot_001');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = DeleteLotResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/admin/lots/:id/generate-slots matches GenerateSlotsResponseDataSchema', async () => {
      const res = await request(app)
        .post('/api/v1/admin/lots/lot_001/generate-slots')
        .send({ count: 5 });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const parsed = GenerateSlotsResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('PUT /api/v1/admin/slots/:id/release matches ReleaseSlotResponseDataSchema', async () => {
      const res = await request(app).put('/api/v1/admin/slots/slot_001/release');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = ReleaseSlotResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('GET /api/v1/admin/audit-log matches AdminAuditLogResponseDataSchema', async () => {
      const res = await request(app).get('/api/v1/admin/audit-log');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = AdminAuditLogResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Guard Endpoints', () => {
    it('GET /api/v1/guard/lots/:lotId/board matches GuardBoardResponseDataSchema', async () => {
      const res = await request(app).get('/api/v1/guard/lots/lot_001/board');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GuardBoardResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/guard/check-in matches GuardCheckInResponseDataSchema', async () => {
      const res = await request(app)
        .post('/api/v1/guard/check-in')
        .send({ bookingCode: 'ABC234' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GuardCheckInResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });

    it('POST /api/v1/guard/slots/:slotId/walk-in matches GuardWalkInResponseDataSchema', async () => {
      const res = await request(app)
        .post('/api/v1/guard/slots/slot_001/walk-in')
        .send({ status: 'OCCUPIED' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const parsed = GuardWalkInResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);
    });
  });
});
