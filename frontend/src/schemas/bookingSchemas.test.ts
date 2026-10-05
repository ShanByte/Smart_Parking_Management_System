import { describe, it, expect } from 'vitest';
import {
  vehicleNumberSchema,
  timeWindowDurationSchema,
  idempotencyKeySchema,
  createBookingRequestSchema,
  validateVehicleNumber,
} from './bookingSchemas';

describe('Booking Schemas Validation (C3 & C7 Rules)', () => {
  describe('vehicleNumberSchema', () => {
    it('accepts valid uppercase alphanumeric numbers between 4 and 15 characters', () => {
      expect(vehicleNumberSchema.safeParse('MH12AB1234').success).toBe(true);
      expect(vehicleNumberSchema.safeParse('KA01C1234').success).toBe(true);
      expect(vehicleNumberSchema.safeParse('DL01').success).toBe(true);
      expect(vehicleNumberSchema.safeParse('123456789012345').success).toBe(true);
    });

    it('transforms lowercase to uppercase and trims whitespace', () => {
      const res = vehicleNumberSchema.safeParse('  mh12ab1234  ');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe('MH12AB1234');
      }
    });

    it('accepts empty string as optional vehicle number', () => {
      expect(vehicleNumberSchema.safeParse('').success).toBe(true);
      expect(vehicleNumberSchema.safeParse('   ').success).toBe(true);
    });

    it('rejects numbers with fewer than 4 or more than 15 characters, or symbols', () => {
      expect(vehicleNumberSchema.safeParse('ABC').success).toBe(false);
      expect(vehicleNumberSchema.safeParse('1234567890123456').success).toBe(false);
      expect(vehicleNumberSchema.safeParse('MH-12-AB').success).toBe(false);
      expect(vehicleNumberSchema.safeParse('MH12@#$').success).toBe(false);
    });
  });

  describe('timeWindowDurationSchema', () => {
    it('accepts durations between 15 minutes (0.25h) and 24 hours (24h)', () => {
      expect(timeWindowDurationSchema.safeParse(0.25).success).toBe(true);
      expect(timeWindowDurationSchema.safeParse(1).success).toBe(true);
      expect(timeWindowDurationSchema.safeParse(8).success).toBe(true);
      expect(timeWindowDurationSchema.safeParse(24).success).toBe(true);
    });

    it('rejects durations under 15 minutes or over 24 hours', () => {
      expect(timeWindowDurationSchema.safeParse(0.1).success).toBe(false);
      expect(timeWindowDurationSchema.safeParse(25).success).toBe(false);
    });
  });

  describe('idempotencyKeySchema', () => {
    it('accepts keys between 8 and 64 characters', () => {
      expect(idempotencyKeySchema.safeParse('12345678').success).toBe(true);
      expect(idempotencyKeySchema.safeParse('a'.repeat(64)).success).toBe(true);
    });

    it('rejects keys under 8 or over 64 characters', () => {
      expect(idempotencyKeySchema.safeParse('short').success).toBe(false);
      expect(idempotencyKeySchema.safeParse('a'.repeat(65)).success).toBe(false);
    });
  });

  describe('createBookingRequestSchema', () => {
    const validStartTime = new Date(Date.now() + 60000).toISOString();
    const validEndTime = new Date(Date.now() + 3660000).toISOString(); // 1 hour duration

    it('accepts valid booking request with valid duration and optional vehicle number', () => {
      const res = createBookingRequestSchema.safeParse({
        slotId: 'slot-1-1',
        startTime: validStartTime,
        endTime: validEndTime,
        vehicleNumber: 'MH12AB1234',
      });
      expect(res.success).toBe(true);
    });

    it('accepts valid booking request without vehicle number', () => {
      const res = createBookingRequestSchema.safeParse({
        slotId: 'slot-1-1',
        startTime: validStartTime,
        endTime: validEndTime,
      });
      expect(res.success).toBe(true);
    });

    it('rejects booking when duration is less than 15 minutes', () => {
      const shortEndTime = new Date(new Date(validStartTime).getTime() + 10 * 60 * 1000).toISOString();
      const res = createBookingRequestSchema.safeParse({
        slotId: 'slot-1-1',
        startTime: validStartTime,
        endTime: shortEndTime,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('between 15 minutes and 24 hours');
      }
    });

    it('rejects booking when duration exceeds 24 hours', () => {
      const longEndTime = new Date(new Date(validStartTime).getTime() + 25 * 3600 * 1000).toISOString();
      const res = createBookingRequestSchema.safeParse({
        slotId: 'slot-1-1',
        startTime: validStartTime,
        endTime: longEndTime,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('between 15 minutes and 24 hours');
      }
    });
  });

  describe('validateVehicleNumber helper', () => {
    it('returns isValid true for empty or valid strings', () => {
      expect(validateVehicleNumber('').isValid).toBe(true);
      expect(validateVehicleNumber('DL01AB1234').isValid).toBe(true);
    });

    it('returns isValid false with error message for invalid strings', () => {
      const result = validateVehicleNumber('AB!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
