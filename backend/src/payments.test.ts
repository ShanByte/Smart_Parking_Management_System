import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { ErrorCode, Role } from '@smart-parking/shared';
import { signAccessToken } from './lib/crypto.js';
import { prisma } from './lib/prisma.js';
import * as reservationsService from './services/reservations.service.js';
import { razorpayClient } from './services/payments.service.js';
import type { Booking, Payment, User } from '@prisma/client';

describe('Stage 4 Payments Endpoints & Security Rules (C7, C9, Rules 6, 7 & 9)', () => {
  const app = createApp();

  const userToken = signAccessToken({ sub: 'usr_payer_001', role: Role.USER });
  const otherUserToken = signAccessToken({ sub: 'usr_other_002', role: Role.USER });
  const adminToken = signAccessToken({ sub: 'usr_admin_001', role: Role.ADMIN });

  const testKeySecret = 'test_razorpay_key_secret_for_tests';
  const testWebhookSecret = 'test_razorpay_webhook_secret_for_tests';
  const mutableEnv = env as unknown as Record<string, unknown>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mutableEnv.RAZORPAY_KEY_SECRET = testKeySecret;
    mutableEnv.RAZORPAY_WEBHOOK_SECRET = testWebhookSecret;
  });

  const mockHeldBooking: Booking = {
    id: 'bk_held_001',
    userId: 'usr_payer_001',
    slotId: 'slot_001',
    status: 'HELD',
    startTime: new Date('2026-10-05T12:00:00.000Z'),
    endTime: new Date('2026-10-05T13:00:00.000Z'),
    amountPaise: 4000,
    heldUntil: new Date(Date.now() + 5 * 60 * 1000), // 5 min in future
    bookingCode: 'ABC234',
    vehicleNumber: 'MH12AB1234',
    idempotencyKey: 'idem-held-12345',
    checkedInAt: null,
    createdAt: new Date('2026-10-05T11:55:00.000Z'),
  };

  const mockConfirmedBooking: Booking = {
    ...mockHeldBooking,
    status: 'CONFIRMED',
    heldUntil: null,
  };

  const mockPaidPayment: Payment = {
    id: 'pmt_001',
    bookingId: 'bk_held_001',
    razorpayOrderId: 'order_test_123',
    razorpayPaymentId: 'pay_test_456',
    amountPaise: 4000,
    paymentStatus: 'PAID',
    createdAt: new Date('2026-10-05T12:00:00.000Z'),
  };

  // ============================================================================
  // 1. POST /api/v1/payments/create-order
  // ============================================================================
  describe('POST /api/v1/payments/create-order', () => {
    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns 404 NOT_FOUND when booking does not exist', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId: 'bk_nonexistent' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('returns 404 NOT_FOUND when booking belongs to another user (Security Rule 6)', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);

      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('rejects with 409 BOOKING_NOT_ELIGIBLE if booking status is not HELD', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockConfirmedBooking);

      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId: 'bk_confirmed_001' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.BOOKING_NOT_ELIGIBLE);
    });

    it('rejects with 409 BOOKING_NOT_ELIGIBLE if booking hold has expired', async () => {
      const expiredBooking: Booking = {
        ...mockHeldBooking,
        heldUntil: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      };
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(expiredBooking);

      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.BOOKING_NOT_ELIGIBLE);
    });

    it('successfully creates order with amount strictly from stored Booking (Security Rule 9)', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);
      vi.spyOn(razorpayClient.orders, 'create').mockResolvedValue({
        id: 'order_rzp_created_123',
        amount: 4000,
        currency: 'INR',
        status: 'created',
      } as unknown as never);

      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe('order_rzp_created_123');
      expect(res.body.data.amountPaise).toBe(4000);
      expect(res.body.data.currency).toBe('INR');
      expect(res.body.data.keyId).toBeDefined();

      expect(razorpayClient.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4000,
          currency: 'INR',
          receipt: 'bk_held_001',
        })
      );
    });
  });

  // ============================================================================
  // 2. POST /api/v1/payments/verify
  // ============================================================================
  describe('POST /api/v1/payments/verify', () => {
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_456';
    const validSignature = crypto
      .createHmac('sha256', testKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/payments/verify')
        .send({
          bookingId: 'bk_held_001',
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSignature,
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('rejects tampered signature with 400 VALIDATION_ERROR (Rule 9 timingSafeEqual)', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);

      const tamperedSignature = validSignature.slice(0, -4) + 'abcd';

      const res = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: 'bk_held_001',
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: tamperedSignature,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns 404 NOT_FOUND if booking belongs to another user (Rule 6)', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);

      const res = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          bookingId: 'bk_held_001',
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSignature,
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('accepts valid signature, confirms booking via reservationsService, and returns BookingView', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);
      vi.spyOn(reservationsService, 'confirmBooking').mockResolvedValue(mockConfirmedBooking);

      const res = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookingId: 'bk_held_001',
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('bk_held_001');
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.bookingCode).toBe('ABC234');

      expect(reservationsService.confirmBooking).toHaveBeenCalledWith('bk_held_001', {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amountPaise: 4000,
      });
    });
  });

  // ============================================================================
  // 3. POST /api/v1/payments/webhook
  // ============================================================================
  describe('POST /api/v1/payments/webhook', () => {
    const makeWebhookPayload = (amount = 4000, bookingId = 'bk_held_001') => ({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_captured_123',
            order_id: 'order_wh_123',
            amount,
            notes: { bookingId },
          },
        },
      },
    });

    it('rejects webhook missing signature or event-id headers with 400 VALIDATION_ERROR', async () => {
      const payload = JSON.stringify(makeWebhookPayload());
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects webhook with tampered signature with 400 VALIDATION_ERROR', async () => {
      const payload = JSON.stringify(makeWebhookPayload());
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(payload)
        .digest('hex');
      const tampered = signature.slice(0, -4) + '0000';

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', tampered)
        .set('x-razorpay-event-id', 'evt_tampered_001')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('processes valid webhook, verifies signature, dedupes, and confirms booking', async () => {
      const payload = JSON.stringify(makeWebhookPayload());
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(payload)
        .digest('hex');

      vi.spyOn(prisma.webhookEvent, 'create').mockResolvedValue({
        id: 'wh_evt_001',
        eventId: 'evt_valid_001',
        type: 'payment.captured',
        receivedAt: new Date(),
        processedAt: new Date(),
      });
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);
      vi.spyOn(reservationsService, 'confirmBooking').mockResolvedValue(mockConfirmedBooking);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_valid_001')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.received).toBe(true);

      expect(reservationsService.confirmBooking).toHaveBeenCalledWith('bk_held_001', {
        razorpayOrderId: 'order_wh_123',
        razorpayPaymentId: 'pay_wh_captured_123',
        amountPaise: 4000,
      });
    });

    it('duplicate webhook does nothing and returns received: true without reconfirming (Rule 9)', async () => {
      const payload = JSON.stringify(makeWebhookPayload());
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(payload)
        .digest('hex');

      // Simulate unique constraint collision on WebhookEvent.eventId
      vi.spyOn(prisma.webhookEvent, 'create').mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`eventId`)')
      );
      const confirmSpy = vi.spyOn(reservationsService, 'confirmBooking');

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_duplicate_001')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.received).toBe(true);

      // Confirm was NOT called on duplicate event
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('wrong amount in webhook does NOT confirm booking (Security Rule 9 amount match)', async () => {
      // Booking has amountPaise = 4000, webhook provides 2000
      const payload = JSON.stringify(makeWebhookPayload(2000));
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(payload)
        .digest('hex');

      vi.spyOn(prisma.webhookEvent, 'create').mockResolvedValue({
        id: 'wh_evt_002',
        eventId: 'evt_mismatch_001',
        type: 'payment.captured',
        receivedAt: new Date(),
        processedAt: new Date(),
      });
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);
      const confirmSpy = vi.spyOn(reservationsService, 'confirmBooking');

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_mismatch_001')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);

      // confirm was NOT called due to amount mismatch
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 4. POST /api/v1/payments/refund
  // ============================================================================
  describe('POST /api/v1/payments/refund (ADMIN only)', () => {
    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('rejects non-admin role USER with 403 FORBIDDEN (Security Rule 6)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_payer_001',
        role: 'USER',
        assignedLotId: null,
      } as unknown as User);

      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('rejects with 404 NOT_FOUND if booking is not found', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_admin_001',
        role: 'ADMIN',
      } as unknown as User);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bookingId: 'bk_not_found' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('rejects with 409 BOOKING_NOT_ELIGIBLE if booking has no paid transaction', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_admin_001',
        role: 'ADMIN',
      } as unknown as User);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockHeldBooking,
        payments: [],
      } as unknown as (Booking & { payments: Payment[] }));

      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.BOOKING_NOT_ELIGIBLE);
    });

    it('successfully processes refund, updates payment to REFUNDED, and cancels booking', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_admin_001',
        role: 'ADMIN',
      } as unknown as User);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockConfirmedBooking,
        payments: [mockPaidPayment],
      } as unknown as (Booking & { payments: Payment[] }));
      vi.spyOn(razorpayClient.payments, 'refund').mockResolvedValue({
        id: 'rfnd_test_123',
        amount: 4000,
        status: 'processed',
      } as unknown as never);
      vi.spyOn(prisma.payment, 'update').mockResolvedValue({
        ...mockPaidPayment,
        paymentStatus: 'REFUNDED',
      });
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: unknown) => {
        return (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
      });
      vi.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockConfirmedBooking,
        status: 'CANCELLED',
      });
      vi.spyOn(prisma.parkingSlot, 'findUnique').mockResolvedValue({
        id: 'slot_001',
        status: 'RESERVED',
      } as unknown as never);
      vi.spyOn(prisma.parkingSlot, 'update').mockResolvedValue({} as unknown as never);

      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REFUNDED');
      expect(res.body.data.bookingId).toBe('bk_held_001');
      expect(res.body.data.amountPaise).toBe(4000);
    });
  });

  // ============================================================================
  // 5. POST /api/v1/payments/demo-confirm
  // ============================================================================
  describe('POST /api/v1/payments/demo-confirm', () => {
    it('returns 404 NOT_FOUND when DEMO_PAY_ENABLED=false (demo route absent when disabled)', async () => {
      mutableEnv.DEMO_PAY_ENABLED = false;

      const res = await request(app)
        .post('/api/v1/payments/demo-confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(404);
    });

    it('processes demo confirmation when DEMO_PAY_ENABLED=true', async () => {
      mutableEnv.DEMO_PAY_ENABLED = true;

      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockHeldBooking);
      vi.spyOn(reservationsService, 'confirmBooking').mockResolvedValue(mockConfirmedBooking);

      const res = await request(app)
        .post('/api/v1/payments/demo-confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId: 'bk_held_001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('bk_held_001');
      expect(res.body.data.status).toBe('CONFIRMED');

      mutableEnv.DEMO_PAY_ENABLED = false;
    });
  });
});
