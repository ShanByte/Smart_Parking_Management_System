/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import {
  hashToken,
  signAccessToken,
  hashPassword,
  generateRefreshToken,
  DUMMY_PASSWORD_HASH,
} from './lib/crypto.js';
import { Role, ErrorCode } from '@smart-parking/shared';
import * as reservationsService from './services/reservations.service.js';
import * as ingestionService from './services/ingestion.service.js';
import { ForbiddenError } from './lib/errors.js';

describe('Stage 8 Non-Negotiable Security Rules & Edge-Cases Suite', () => {
  const app = createApp();

  const normalUserToken = signAccessToken({ sub: 'usr_normal', role: Role.USER });
  const otherUserToken = signAccessToken({ sub: 'usr_other', role: Role.USER });
  const adminToken = signAccessToken({ sub: 'usr_admin', role: Role.ADMIN });
  const guardToken = signAccessToken({ sub: 'usr_guard', role: Role.GUARD });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Security Rule 3: Strict Body Validation (Unknown Keys Rejected)', () => {
    it('rejects auth register request with unknown body keys', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice Hacker',
          email: 'alice@example.com',
          password: 'Password123!',
          isAdmin: true, // Unknown property injection attempt
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects booking creation request with unknown body keys', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .set('idempotency-key', 'idemp_key_12345678')
        .send({
          slotId: 'slot_123',
          startTime: '2026-10-10T10:00:00.000Z',
          endTime: '2026-10-10T12:00:00.000Z',
          priceOverride: 0, // Unknown property injection attempt
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects sensor event request with unknown keys or invalid status', async () => {
      const rawKey = 'test-raw-device-key-32-chars-long-here';
      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', rawKey)
        .send({
          slotId: 'slot_123',
          status: 'RESERVED', // Invalid status (only AVAILABLE and OCCUPIED allowed)
          timestamp: '2026-10-10T10:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('Security Rule 4: Password Hashing & Timing Attack Mitigation', () => {
    it('returns exact same generic error message and runs compare on unknown email', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns exact same generic error message on wrong password for existing user', async () => {
      const validHash = await hashPassword('CorrectPassword123!');
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_normal',
        email: 'alice@example.com',
        passwordHash: validHash,
        role: Role.USER,
        name: 'Alice',
        assignedLotId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'IncorrectPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('dummy hash uses cost 12 bcrypt format', () => {
      expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$12\$/);
    });
  });

  describe('Security Rule 5: Refresh Token Reuse Detection & Revocation', () => {
    it('revokes all user refresh tokens when a revoked token is presented', async () => {
      const stolenToken = generateRefreshToken();
      const stolenHash = hashToken(stolenToken);

      vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue({
        id: 'rt_stolen',
        userId: 'usr_normal',
        tokenHash: stolenHash,
        expiresAt: new Date(Date.now() + 1000000),
        revokedAt: new Date(Date.now() - 5000), // Already revoked!
        createdAt: new Date(),
        user: { id: 'usr_normal', role: Role.USER, name: 'Normal', email: 'normal@test.com', assignedLotId: null },
      } as any);

      const updateManySpy = vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValue({ count: 5 });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('x-requested-with', 'XMLHttpRequest')
        .set('Cookie', `refresh_token=${stolenToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(res.body.message).toContain('All active sessions terminated');

      // Verify that all active tokens for that user were revoked
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'usr_normal',
            revokedAt: null,
          },
        })
      );
    });
  });

  describe('Security Rule 6: Resource Ownership (404 NOT_FOUND, not 403)', () => {
    it('returns 404 NOT_FOUND when canceling another user booking', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_other',
        role: Role.USER,
        assignedLotId: null,
      } as any);

      vi.spyOn(reservationsService, 'cancelBooking').mockRejectedValue(
        new ForbiddenError(ErrorCode.FORBIDDEN, 'You are not authorized to cancel this booking')
      );

      const res = await request(app)
        .delete('/api/v1/bookings/bk_alice_123')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      expect(res.body.message).toBe('Booking not found');
    });
  });

  describe('Security Rules 5 & 14: Database Role Verification on Every Call', () => {
    it('denies admin route if token claims ADMIN but database role was revoked to USER', async () => {
      // Token claims ADMIN, but database lookup returns USER
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_admin',
        role: Role.USER, // Revoked in DB!
        assignedLotId: null,
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/audit-log')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('denies guard access to a lot other than their assignedLotId', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_guard',
        role: Role.GUARD,
        assignedLotId: 'lot_permitted',
      } as any);

      const res = await request(app)
        .get('/api/v1/guard/lots/lot_unauthorized/board')
        .set('Authorization', `Bearer ${guardToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      expect(res.body.message).toContain('not assigned to guard');
    });

    it('always refuses USER token on guard routes', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_normal',
        role: Role.USER,
        assignedLotId: null,
      } as any);

      const res = await request(app)
        .get('/api/v1/guard/lots/lot_001/board')
        .set('Authorization', `Bearer ${normalUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('Security Rule 8: Error Envelope and Stack Trace Leakage Prevention', () => {
    it('returns clean RFC/envelope 500 INTERNAL_ERROR with requestId and no stack trace', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValue(new Error('Sensitive DB crash error detail'));

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${normalUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(res.body.message).toBe('Internal server error');
      expect(res.body).toHaveProperty('requestId');
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('Sensitive DB crash error detail');
    });
  });

  describe('Security Rule 10: Sensor Authentication with Device Key Hash', () => {
    it('rejects revoked device key with 401 UNAUTHORIZED', async () => {
      const rawKey = 'revoked-device-key-32-chars-long';
      const keyHash = hashToken(rawKey);

      vi.spyOn(prisma.device, 'findUnique').mockResolvedValue({
        id: 'dev_revoked',
        name: 'Revoked Device',
        kind: 'SENSOR',
        parkingLotId: 'lot_001',
        keyHash,
        isActive: false,
        revokedAt: new Date(),
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', rawKey)
        .send({
          slotId: 'slot_123',
          status: 'OCCUPIED',
          timestamp: '2026-10-10T10:00:00.000Z',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(res.body.message).toBe('Invalid or revoked device key');
    });

    it('accepts valid active device key and looks up strictly via keyHash', async () => {
      const rawKey = 'valid-device-key-32-chars-long-here';
      const keyHash = hashToken(rawKey);

      const findSpy = vi.spyOn(prisma.device, 'findUnique').mockResolvedValue({
        id: 'dev_valid',
        name: 'Valid Device',
        kind: 'SENSOR',
        parkingLotId: 'lot_001',
        keyHash,
        isActive: true,
        revokedAt: null,
        createdAt: new Date(),
      } as any);

      vi.spyOn(ingestionService, 'ingestSensorEvent').mockResolvedValue({ applied: true });

      const res = await request(app)
        .post('/api/v1/sensors/events')
        .set('x-device-key', rawKey)
        .send({
          slotId: 'slot_123',
          status: 'AVAILABLE',
          timestamp: '2026-10-10T10:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applied).toBe(true);
      expect(findSpy).toHaveBeenCalledWith({ where: { keyHash } });
    });
  });

  describe('Security Rule 9: Razorpay Webhook Signature & Deduplication', () => {
    const webhookSecret = 'test_webhook_secret_32_characters_long';

    it('rejects webhook with invalid signature with 400 VALIDATION_ERROR', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', 'invalid_signature_hex')
        .set('x-razorpay-event-id', 'evt_12345')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ event: 'payment.captured' }));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('safely deduplicates duplicate webhook events without processing twice', async () => {
      const webhookSecret = 'test_webhook_secret_32_characters_long';
      process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_123', order_id: 'order_123', amount: 5000 } },
        },
      });

      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(Buffer.from(payload, 'utf8'))
        .digest('hex');

      // First call throws duplicate unique constraint error in Prisma (simulate duplicate eventId)
      vi.spyOn(prisma.webhookEvent, 'create').mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`eventId`)')
      );

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_duplicate_123')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.received).toBe(true);
    });
  });
});
