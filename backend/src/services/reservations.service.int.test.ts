import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getTestPrisma, resetDb } from '../test/helpers.js';
import {
  holdSlot,
  confirmBooking,
  cancelBooking,
  expireHolds,
} from './reservations.service.js';
import {
  getLotsWithFreeCount,
  getLot,
  getSlotsByLot,
} from './lots.service.js';
import { Role, SlotStatus, SlotSource } from '@prisma/client';
import { ConflictError } from '../lib/errors.js';
import { ErrorCode } from '@smart-parking/shared';

describe('Stage 2 Integration Tests: Read Services & Booking Engine', () => {
  const prisma = getTestPrisma();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedTestLotAndUsers() {
    const lot = await prisma.parkingLot.create({
      data: {
        name: 'FC Road Demo Lot',
        address: 'FC Road, Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        totalSlots: 5,
        pricePerHourPaise: 4000,
        isActive: true,
      },
    });

    const slots = [];
    for (let i = 1; i <= 5; i++) {
      const slot = await prisma.parkingSlot.create({
        data: {
          parkingLotId: lot.id,
          slotNumber: `A${i}`,
          status: SlotStatus.AVAILABLE,
          source: SlotSource.APP,
        },
      });
      slots.push(slot);
    }

    const users = [];
    for (let i = 1; i <= 20; i++) {
      const user = await prisma.user.create({
        data: {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          passwordHash: 'dummyhash',
          role: Role.USER,
        },
      });
      users.push(user);
    }

    return { lot, slots, users };
  }

  it('20 parallel holdSlot calls on one slot give exactly 1 winner and 19 SLOT_UNAVAILABLE', async () => {
    const { slots, users } = await seedTestLotAndUsers();
    const contestedSlot = slots[0]!;

    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 mins ahead
    const endTime = new Date(now.getTime() + 70 * 60 * 1000); // 1 hour duration

    // Launch 20 concurrent holds on the same slot
    const promises = users.map((user, idx) =>
      holdSlot(
        user.id,
        contestedSlot.id,
        startTime,
        endTime,
        `idempotency-key-race-${idx}-${Date.now()}`
      )
    );

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 1 winner
    expect(fulfilled.length).toBe(1);
    // Exactly 19 losers
    expect(rejected.length).toBe(19);

    // All losers received ConflictError with SLOT_UNAVAILABLE code
    for (const r of rejected) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ConflictError);
        expect((r.reason as ConflictError).code).toBe(ErrorCode.SLOT_UNAVAILABLE);
      }
    }

    // Verify slot is HELD in database
    const slotInDb = await prisma.parkingSlot.findUnique({
      where: { id: contestedSlot.id },
    });
    expect(slotInDb?.status).toBe(SlotStatus.HELD);
  });

  it('same (userId, idempotencyKey) returns the original booking without duplicate insert', async () => {
    const { slots, users } = await seedTestLotAndUsers();
    const slot = slots[1]!;
    const user = users[0]!;

    const now = new Date();
    const startTime = new Date(now.getTime() + 15 * 60 * 1000);
    const endTime = new Date(now.getTime() + 75 * 60 * 1000);
    const key = 'stable-idempotency-key-12345';

    const booking1 = await holdSlot(user.id, slot.id, startTime, endTime, key);
    expect(booking1.id).toBeDefined();

    const booking2 = await holdSlot(user.id, slot.id, startTime, endTime, key);
    expect(booking2.id).toBe(booking1.id);
    expect(booking2.bookingCode).toBe(booking1.bookingCode);

    const totalBookings = await prisma.booking.count({
      where: { userId: user.id },
    });
    expect(totalBookings).toBe(1);
  });

  it('confirmBooking is idempotent: calling twice with same razorpayPaymentId returns the booking', async () => {
    const { slots, users } = await seedTestLotAndUsers();
    const slot = slots[2]!;
    const user = users[1]!;

    const now = new Date();
    const startTime = new Date(now.getTime() + 20 * 60 * 1000);
    const endTime = new Date(now.getTime() + 80 * 60 * 1000);

    const hold = await holdSlot(
      user.id,
      slot.id,
      startTime,
      endTime,
      'confirm-test-key-111'
    );

    const paymentInfo = {
      razorpayOrderId: 'order_test_123',
      razorpayPaymentId: 'pay_test_456',
      amountPaise: 4000,
    };

    const confirmed1 = await confirmBooking(hold.id, paymentInfo);
    expect(confirmed1.status).toBe('CONFIRMED');

    // Second call with same payment ID returns confirmed booking
    const confirmed2 = await confirmBooking(hold.id, paymentInfo);
    expect(confirmed2.id).toBe(confirmed1.id);
    expect(confirmed2.status).toBe('CONFIRMED');

    // Slot is RESERVED
    const slotInDb = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(slotInDb?.status).toBe(SlotStatus.RESERVED);
  });

  it('cancelBooking marks booking CANCELLED and frees the slot to AVAILABLE', async () => {
    const { slots, users } = await seedTestLotAndUsers();
    const slot = slots[3]!;
    const user = users[2]!;

    const now = new Date();
    const startTime = new Date(now.getTime() + 30 * 60 * 1000);
    const endTime = new Date(now.getTime() + 90 * 60 * 1000);

    const hold = await holdSlot(
      user.id,
      slot.id,
      startTime,
      endTime,
      'cancel-test-key-222'
    );

    const cancelled = await cancelBooking(user.id, hold.id);
    expect(cancelled.status).toBe('CANCELLED');

    const slotInDb = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(slotInDb?.status).toBe(SlotStatus.AVAILABLE);
  });

  it('expireHolds frees slots whose heldUntil is in the past', async () => {
    const { slots, users } = await seedTestLotAndUsers();
    const slot = slots[4]!;
    const user = users[3]!;

    const pastTime = new Date(Date.now() - 10 * 60 * 1000);

    // Create an expired hold directly in DB
    const expiredBooking = await prisma.booking.create({
      data: {
        userId: user.id,
        slotId: slot.id,
        status: 'HELD',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 120 * 60 * 1000),
        amountPaise: 4000,
        heldUntil: pastTime,
        idempotencyKey: 'expired-key-333',
        bookingCode: 'EXP123',
      },
    });

    await prisma.parkingSlot.update({
      where: { id: slot.id },
      data: { status: 'HELD', heldUntil: pastTime },
    });

    const count = await expireHolds();
    expect(count).toBeGreaterThanOrEqual(1);

    const refreshedBooking = await prisma.booking.findUnique({
      where: { id: expiredBooking.id },
    });
    expect(refreshedBooking?.status).toBe('EXPIRED');

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.AVAILABLE);
  });

  it('read services: getLotsWithFreeCount and getSlotsByLot return accurate data', async () => {
    const { lot } = await seedTestLotAndUsers();

    const lotsWithCount = await getLotsWithFreeCount();
    expect(lotsWithCount.length).toBe(1);
    expect(lotsWithCount[0]?.freeCount).toBe(5);
    expect(lotsWithCount[0]?.totalSlots).toBe(5);

    const singleLot = await getLot(lot.id);
    expect(singleLot.id).toBe(lot.id);
    expect(singleLot.freeCount).toBe(5);

    const slots = await getSlotsByLot(lot.id);
    expect(slots.length).toBe(5);
    expect(slots.every((s) => s.status === SlotStatus.AVAILABLE)).toBe(true);
  });

  it('overlapping future windows rejected: hold on contested future window throws SLOT_UNAVAILABLE', async () => {
    const { slots, users } = await seedTestLotAndUsers();
    const slot = slots[0]!;
    const userA = users[0]!;
    const userB = users[1]!;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const t10 = new Date(tomorrow);
    const t12 = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
    const t11 = new Date(tomorrow.getTime() + 1 * 60 * 60 * 1000);
    const t13 = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000);

    // User A holds slot for tomorrow 10:00 to 12:00
    const holdA = await holdSlot(
      userA.id,
      slot.id,
      t10,
      t12,
      'userA-future-key-1'
    );
    expect(holdA.id).toBeDefined();

    // User B attempts to hold slot for tomorrow 11:00 to 13:00 (overlapping window)
    await expect(
      holdSlot(
        userB.id,
        slot.id,
        t11,
        t13,
        'userB-future-key-2'
      )
    ).rejects.toThrow(ConflictError);

    // Verify window availability: slot is HELD during [t11, t13)
    const windowSlotsOverlap = await getSlotsByLot(slot.parkingLotId, t11, t13);
    const slotOverlapView = windowSlotsOverlap.find((s) => s.id === slot.id);
    expect(slotOverlapView?.status).toBe(SlotStatus.HELD);
  });

  it('back-to-back future windows accepted: adjacent boundary bookings succeed on same slot', async () => {
    const { slots, users } = await seedTestLotAndUsers();
    const slot = slots[1]!;
    const userA = users[0]!;
    const userB = users[1]!;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(14, 0, 0, 0);

    const t14 = new Date(tomorrow);
    const t16 = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
    const t18 = new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000);

    // Booking 1: 14:00 to 16:00
    const hold1 = await holdSlot(
      userA.id,
      slot.id,
      t14,
      t16,
      'userA-backtoback-key-1'
    );
    expect(hold1.id).toBeDefined();

    // Booking 2: 16:00 to 18:00 (back-to-back, starts exactly when previous ends)
    const hold2 = await holdSlot(
      userB.id,
      slot.id,
      t16,
      t18,
      'userB-backtoback-key-2'
    );
    expect(hold2.id).toBeDefined();

    // Window [14:00, 16:00) shows slot as HELD
    const window1 = await getSlotsByLot(slot.parkingLotId, t14, t16);
    expect(window1.find((s) => s.id === slot.id)?.status).toBe(SlotStatus.HELD);

    // Window [16:00, 18:00) shows slot as HELD
    const window2 = await getSlotsByLot(slot.parkingLotId, t16, t18);
    expect(window2.find((s) => s.id === slot.id)?.status).toBe(SlotStatus.HELD);

    // Window [18:00, 20:00) shows slot as AVAILABLE
    const t20 = new Date(tomorrow.getTime() + 6 * 60 * 60 * 1000);
    const window3 = await getSlotsByLot(slot.parkingLotId, t18, t20);
    expect(window3.find((s) => s.id === slot.id)?.status).toBe(SlotStatus.AVAILABLE);
  });
});
