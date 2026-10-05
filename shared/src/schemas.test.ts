import { describe, it, expect } from 'vitest';
import {
  SlotStatus,
  BookingStatus,
  Role,
  PaymentStatus,
  SlotSource,
  ErrorCode,
} from './enums.js';
import {
  RegisterRequestSchema,
  CreateBookingRequestSchema,
  CreateBookingHeadersSchema,
  UpdateUserRoleRequestSchema,
  GuardCheckInRequestSchema,
  GuardWalkInRequestSchema,
  SensorEventRequestSchema,
  FailureEnvelopeSchema,
  createSuccessEnvelopeSchema,
  UserViewSchema,
} from './schemas.js';

describe('Frozen Contract C2 Enums', () => {
  it('has exact SlotStatus enum values', () => {
    expect(Object.values(SlotStatus)).toEqual([
      'AVAILABLE',
      'HELD',
      'RESERVED',
      'OCCUPIED',
    ]);
  });

  it('has exact BookingStatus enum values', () => {
    expect(Object.values(BookingStatus)).toEqual([
      'HELD',
      'CONFIRMED',
      'CANCELLED',
      'EXPIRED',
      'COMPLETED',
      'NO_SHOW',
    ]);
  });

  it('has exact Role enum values', () => {
    expect(Object.values(Role)).toEqual(['USER', 'ADMIN', 'GUARD']);
  });

  it('has exact PaymentStatus enum values', () => {
    expect(Object.values(PaymentStatus)).toEqual([
      'CREATED',
      'PAID',
      'FAILED',
      'REFUNDED',
    ]);
  });

  it('has exact SlotSource enum values', () => {
    expect(Object.values(SlotSource)).toEqual([
      'SIM',
      'SENSOR',
      'APP',
      'GUARD',
    ]);
  });
});

describe('Zod Validation Schemas', () => {
  describe('RegisterRequestSchema', () => {
    it('accepts valid registration data and lowercases email', () => {
      const parsed = RegisterRequestSchema.parse({
        name: 'Jane Doe',
        email: 'Jane@Example.COM',
        password: 'securepassword123',
      });
      expect(parsed.email).toBe('jane@example.com');
      expect(parsed.name).toBe('Jane Doe');
    });

    it('rejects passwords shorter than 10 characters', () => {
      const result = RegisterRequestSchema.safeParse({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown body keys (strict mode)', () => {
      const result = RegisterRequestSchema.safeParse({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'securepassword123',
        extraField: 'not-allowed',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateBookingRequestSchema & Headers', () => {
    it('accepts valid booking request with vehicle number', () => {
      const result = CreateBookingRequestSchema.safeParse({
        slotId: 'slot-123',
        startTime: '2026-10-05T10:00:00.000Z',
        endTime: '2026-10-05T11:00:00.000Z',
        vehicleNumber: 'MH12AB1234',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid vehicle number format', () => {
      const result = CreateBookingRequestSchema.safeParse({
        slotId: 'slot-123',
        startTime: '2026-10-05T10:00:00.000Z',
        endTime: '2026-10-05T11:00:00.000Z',
        vehicleNumber: 'invalid_number!',
      });
      expect(result.success).toBe(false);
    });

    it('validates idempotency-key header length between 8 and 64 characters', () => {
      expect(CreateBookingHeadersSchema.safeParse({ 'idempotency-key': '12345678' }).success).toBe(true);
      expect(CreateBookingHeadersSchema.safeParse({ 'idempotency-key': 'short' }).success).toBe(false);
    });
  });

  describe('UpdateUserRoleRequestSchema', () => {
    it('requires assignedLotId when role is GUARD', () => {
      const withLot = UpdateUserRoleRequestSchema.safeParse({
        role: Role.GUARD,
        assignedLotId: 'lot-1',
      });
      expect(withLot.success).toBe(true);

      const withoutLot = UpdateUserRoleRequestSchema.safeParse({
        role: Role.GUARD,
        assignedLotId: null,
      });
      expect(withoutLot.success).toBe(false);
    });

    it('allows null assignedLotId when role is USER or ADMIN', () => {
      const userRole = UpdateUserRoleRequestSchema.safeParse({
        role: Role.USER,
        assignedLotId: null,
      });
      expect(userRole.success).toBe(true);
    });
  });

  describe('GuardCheckInRequestSchema', () => {
    it('accepts 6-character code using C3 alphabet', () => {
      const result = GuardCheckInRequestSchema.safeParse({
        bookingCode: 'ABC234',
      });
      expect(result.success).toBe(true);
    });

    it('rejects ambiguous characters 0, O, 1, I', () => {
      expect(GuardCheckInRequestSchema.safeParse({ bookingCode: 'ABC012' }).success).toBe(false);
      expect(GuardCheckInRequestSchema.safeParse({ bookingCode: 'ABCO12' }).success).toBe(false);
      expect(GuardCheckInRequestSchema.safeParse({ bookingCode: 'ABCI12' }).success).toBe(false);
    });
  });

  describe('GuardWalkInRequestSchema', () => {
    it('accepts only OCCUPIED or AVAILABLE', () => {
      expect(GuardWalkInRequestSchema.safeParse({ status: 'OCCUPIED' }).success).toBe(true);
      expect(GuardWalkInRequestSchema.safeParse({ status: 'AVAILABLE' }).success).toBe(true);
      expect(GuardWalkInRequestSchema.safeParse({ status: 'HELD' }).success).toBe(false);
      expect(GuardWalkInRequestSchema.safeParse({ status: 'RESERVED' }).success).toBe(false);
    });
  });

  describe('SensorEventRequestSchema', () => {
    it('accepts only AVAILABLE or OCCUPIED', () => {
      const valid = SensorEventRequestSchema.safeParse({
        slotId: 'slot-1',
        status: 'OCCUPIED',
        timestamp: '2026-10-05T10:00:00.000Z',
      });
      expect(valid.success).toBe(true);

      const invalid = SensorEventRequestSchema.safeParse({
        slotId: 'slot-1',
        status: 'HELD',
        timestamp: '2026-10-05T10:00:00.000Z',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('Envelopes per C4', () => {
    it('validates success envelope', () => {
      const schema = createSuccessEnvelopeSchema(UserViewSchema);
      const result = schema.safeParse({
        success: true,
        data: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          role: Role.USER,
        },
      });
      expect(result.success).toBe(true);
    });

    it('validates failure envelope with ErrorCode', () => {
      const result = FailureEnvelopeSchema.safeParse({
        success: false,
        message: 'Invalid credentials',
        code: ErrorCode.UNAUTHORIZED,
        requestId: 'req-123',
      });
      expect(result.success).toBe(true);
    });
  });
});
