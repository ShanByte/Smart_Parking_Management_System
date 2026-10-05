import { describe, it, expect } from 'vitest';
import { holdSlot, confirmBooking } from './reservations.service.js';
import { ValidationError } from '../lib/errors.js';

describe('Stage 2 Unit Tests: Booking Engine Validations', () => {
  const dummyUserId = 'user_dummy_1';
  const dummySlotId = 'slot_dummy_1';
  const validKey = 'valid-idempotency-key-12345';

  it('rejects booking with duration less than 15 minutes', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 10 * 60 * 1000); // 10 mins

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, validKey)
    ).rejects.toThrow(ValidationError);
  });

  it('rejects booking with duration greater than 24 hours', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 25 * 60 * 60 * 1000); // 25 hours

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, validKey)
    ).rejects.toThrow(ValidationError);
  });

  it('rejects booking with startTime more than 1 minute in the past', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 2 * 60 * 1000); // 2 mins ago
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, validKey)
    ).rejects.toThrow(ValidationError);
  });

  it('rejects booking with startTime more than 7 days in the future', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 days ahead
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, validKey)
    ).rejects.toThrow(ValidationError);
  });

  it('rejects booking with idempotencyKey shorter than 8 characters', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, 'short')
    ).rejects.toThrow(ValidationError);
  });

  it('rejects invalid vehicle numbers (lowercase, special characters, wrong length)', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, validKey, 'mh12ab1234') // lowercase
    ).rejects.toThrow(ValidationError);

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, validKey, 'MH-12-AB') // hyphen
    ).rejects.toThrow(ValidationError);

    await expect(
      holdSlot(dummyUserId, dummySlotId, startTime, endTime, validKey, 'ABC') // too short (<4)
    ).rejects.toThrow(ValidationError);
  });

  it('rejects payment confirmation with missing orderId or paymentId', async () => {
    await expect(
      confirmBooking('booking_dummy', {
        razorpayOrderId: '',
        razorpayPaymentId: 'pay_123',
        amountPaise: 4000,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      confirmBooking('booking_dummy', {
        razorpayOrderId: 'order_123',
        razorpayPaymentId: '',
        amountPaise: 4000,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('rejects payment confirmation with invalid amountPaise (zero, negative, float)', async () => {
    await expect(
      confirmBooking('booking_dummy', {
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        amountPaise: 0,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      confirmBooking('booking_dummy', {
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        amountPaise: -100,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      confirmBooking('booking_dummy', {
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        amountPaise: 40.5,
      })
    ).rejects.toThrow(ValidationError);
  });
});
