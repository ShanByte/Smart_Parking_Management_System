import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { ErrorCode } from '@smart-parking/shared';

describe('Booking Endpoint Validation Rules (Stage 3 & C3)', () => {
  const app = createApp();

  const validBookingPayload = {
    slotId: 'slot_123',
    startTime: '2026-10-05T12:00:00.000Z',
    endTime: '2026-10-05T13:00:00.000Z',
    vehicleNumber: 'MH12AB1234',
  };

  it('accepts valid booking request with Idempotency-Key header', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('idempotency-key', 'idem-valid-key-12345')
      .send(validBookingPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slotId).toBe('slot_123');
  });

  it('rejects booking request missing Idempotency-Key header', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .send(validBookingPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('rejects booking request with duration shorter than 15 minutes', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
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
      .set('idempotency-key', 'idem-valid-key-12345')
      .send({
        ...validBookingPayload,
        vehicleNumber: 'invalid_number!',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
