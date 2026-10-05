import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { ErrorCode, Role } from '@smart-parking/shared';
import { signAccessToken } from './lib/crypto.js';
import * as reservationsService from './services/reservations.service.js';
import { prisma } from './lib/prisma.js';
import { ConflictError, ForbiddenError } from './lib/errors.js';
import type { Booking } from '@prisma/client';

describe('Booking Endpoints & Validation Rules (Stage 3 & C3)', () => {
  const app = createApp();
  const token = signAccessToken({ sub: 'usr_booking_tester', role: Role.USER });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validBookingPayload = {
    slotId: 'slot_123',
    startTime: '2026-10-05T12:00:00.000Z',
    endTime: '2026-10-05T13:00:00.000Z',
    vehicleNumber: 'MH12AB1234',
  };

  const mockBookingRecord: Booking = {
    id: 'bk_created_123',
    userId: 'usr_booking_tester',
    slotId: 'slot_123',
    status: 'HELD',
    startTime: new Date('2026-10-05T12:00:00.000Z'),
    endTime: new Date('2026-10-05T13:00:00.000Z'),
    amountPaise: 5000,
    heldUntil: new Date('2026-10-05T12:05:00.000Z'),
    bookingCode: 'ABC234',
    vehicleNumber: 'MH12AB1234',
    idempotencyKey: 'idem-valid-key-12345',
    checkedInAt: null,
    createdAt: new Date('2026-10-05T11:59:00.000Z'),
  };

  describe('POST /api/v1/bookings', () => {
    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('idempotency-key', 'idem-valid-key-12345')
        .send(validBookingPayload);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('accepts valid booking request with Idempotency-Key and Bearer token', async () => {
      vi.spyOn(reservationsService, 'holdSlot').mockResolvedValue(mockBookingRecord);

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .set('idempotency-key', 'idem-valid-key-12345')
        .send(validBookingPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('bk_created_123');
      expect(res.body.data.bookingCode).toBe('ABC234');
      expect(res.body.data.vehicleNumber).toBe('MH12AB1234');
    });

    it('rejects booking request missing Idempotency-Key header', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(validBookingPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects booking request with duration shorter than 15 minutes', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .set('idempotency-key', 'idem-valid-key-12345')
        .send({
          ...validBookingPayload,
          startTime: '2026-10-05T12:00:00.000Z',
          endTime: '2026-10-05T12:10:00.000Z', // 10 minutes
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects booking request with duration longer than 24 hours', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .set('idempotency-key', 'idem-valid-key-12345')
        .send({
          ...validBookingPayload,
          startTime: '2026-10-05T12:00:00.000Z',
          endTime: '2026-10-06T13:00:00.000Z', // 25 hours
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects invalid vehicle number format', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .set('idempotency-key', 'idem-valid-key-12345')
        .send({
          ...validBookingPayload,
          vehicleNumber: 'invalid_number!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('passes through 409 SLOT_UNAVAILABLE when slot is occupied or reserved', async () => {
      vi.spyOn(reservationsService, 'holdSlot').mockRejectedValue(
        new ConflictError(ErrorCode.SLOT_UNAVAILABLE, 'Slot is currently OCCUPIED')
      );

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .set('idempotency-key', 'idem-valid-key-12345')
        .send(validBookingPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.SLOT_UNAVAILABLE);
    });
  });

  describe('GET /api/v1/bookings/my', () => {
    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/bookings/my');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns user bookings', async () => {
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([mockBookingRecord]);

      const res = await request(app)
        .get('/api/v1/bookings/my')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('bk_created_123');
    });
  });

  describe('DELETE /api/v1/bookings/:id', () => {
    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app).delete('/api/v1/bookings/bk_created_123');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('cancels booking when user is owner', async () => {
      const cancelledRecord = { ...mockBookingRecord, status: 'CANCELLED' as const };
      vi.spyOn(reservationsService, 'cancelBooking').mockResolvedValue(cancelledRecord);

      const res = await request(app)
        .delete('/api/v1/bookings/bk_created_123')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('rejects with 403 FORBIDDEN when user does not own the booking', async () => {
      vi.spyOn(reservationsService, 'cancelBooking').mockRejectedValue(
        new ForbiddenError(ErrorCode.FORBIDDEN, 'You are not authorized to cancel this booking')
      );

      const res = await request(app)
        .delete('/api/v1/bookings/bk_other_user')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });
  });
});
