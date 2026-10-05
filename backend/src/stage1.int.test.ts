import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getTestPrisma, resetDb } from './test/helpers.js';
import { BookingStatus, Role, SlotStatus, SlotSource } from '@prisma/client';

describe('Stage 1 Integration Tests: Exclusion Constraint & Database Safety', () => {
  const prisma = getTestPrisma();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('PostgreSQL exclusion constraint rejects overlapping bookings on the same slot (status HELD/CONFIRMED)', async () => {
    // 1. Create a user, lot, slot
    const user = await prisma.user.create({
      data: {
        name: 'Test Driver',
        email: 'driver1@example.com',
        passwordHash: 'dummyhash',
        role: Role.USER,
      },
    });

    const lot = await prisma.parkingLot.create({
      data: {
        name: 'Test Lot',
        address: 'Test Road, Pune',
        latitude: 18.52,
        longitude: 73.85,
        totalSlots: 10,
        pricePerHourPaise: 5000,
      },
    });

    const slot = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lot.id,
        slotNumber: 'A1',
        status: SlotStatus.AVAILABLE,
        source: SlotSource.APP,
      },
    });

    const t10 = new Date('2026-10-06T10:00:00.000Z');
    const t11 = new Date('2026-10-06T11:00:00.000Z');
    const t10_30 = new Date('2026-10-06T10:30:00.000Z');
    const t11_30 = new Date('2026-10-06T11:30:00.000Z');
    const t12 = new Date('2026-10-06T12:00:00.000Z');

    // 2. Insert Booking 1 (10:00 to 11:00, HELD)
    const booking1 = await prisma.booking.create({
      data: {
        userId: user.id,
        slotId: slot.id,
        status: BookingStatus.HELD,
        startTime: t10,
        endTime: t11,
        amountPaise: 5000,
        idempotencyKey: 'key-1',
        bookingCode: 'ABC234',
      },
    });
    expect(booking1.id).toBeDefined();

    // 3. Attempt to insert Booking 2 overlapping (10:30 to 11:30, CONFIRMED)
    // Must be rejected by Postgres exclusion constraint
    let caughtError: unknown = null;
    try {
      await prisma.booking.create({
        data: {
          userId: user.id,
          slotId: slot.id,
          status: BookingStatus.CONFIRMED,
          startTime: t10_30,
          endTime: t11_30,
          amountPaise: 5000,
          idempotencyKey: 'key-2',
          bookingCode: 'DEF567',
        },
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    const errorMsg = String(caughtError);
    // Postgres exclusion constraint error code is 23P01 or mentions exclusion
    expect(
      errorMsg.includes('exclusion') ||
      errorMsg.includes('booking_slot_timerange') ||
      errorMsg.includes('23P01')
    ).toBe(true);

    // 4. Back-to-back Booking 3 (11:00 to 12:00, HELD) must be accepted (half-open range)
    const booking3 = await prisma.booking.create({
      data: {
        userId: user.id,
        slotId: slot.id,
        status: BookingStatus.HELD,
        startTime: t11,
        endTime: t12,
        amountPaise: 5000,
        idempotencyKey: 'key-3',
        bookingCode: 'GHJ89K',
      },
    });
    expect(booking3.id).toBeDefined();

    // 5. Overlapping Booking 4 with status CANCELLED must be accepted (WHERE clause allows it)
    const booking4 = await prisma.booking.create({
      data: {
        userId: user.id,
        slotId: slot.id,
        status: BookingStatus.CANCELLED,
        startTime: t10_30,
        endTime: t11_30,
        amountPaise: 5000,
        idempotencyKey: 'key-4',
        bookingCode: 'LMN234',
      },
    });
    expect(booking4.id).toBeDefined();
  });
});
