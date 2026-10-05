import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getTestPrisma, resetDb } from '../test/helpers.js';
import {
  getGuardBoard,
  checkInBooking,
  guardSetSlotStatus,
  releaseNoShows,
} from './guard.service.js';
import { holdSlot } from './reservations.service.js';
import {
  Role,
  SlotStatus,
  SlotSource,
  BookingStatus,
} from '@smart-parking/shared';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';

describe('Stage 4 Integration Tests: Guard Domain', () => {
  const prisma = getTestPrisma();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestFixture() {
    // 1. Lots
    const lotA = await prisma.parkingLot.create({
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

    const lotB = await prisma.parkingLot.create({
      data: {
        name: 'MG Road Central Parking',
        address: 'MG Road, Pune',
        latitude: 18.5158,
        longitude: 73.8785,
        totalSlots: 5,
        pricePerHourPaise: 5000,
        isActive: true,
      },
    });

    // 2. Slots in Lot A
    const slotA1 = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lotA.id,
        slotNumber: 'A1',
        status: SlotStatus.AVAILABLE,
        source: SlotSource.APP,
      },
    });

    const slotA2 = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lotA.id,
        slotNumber: 'A2',
        status: SlotStatus.AVAILABLE,
        source: SlotSource.APP,
      },
    });

    // 3. Slot in Lot B
    const slotB1 = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lotB.id,
        slotNumber: 'B1',
        status: SlotStatus.AVAILABLE,
        source: SlotSource.APP,
      },
    });

    // 4. Users
    const regularUser = await prisma.user.create({
      data: {
        name: 'Regular Driver',
        email: 'user@example.com',
        passwordHash: 'dummyhash',
        role: Role.USER,
      },
    });

    const guardA = await prisma.user.create({
      data: {
        name: 'Guard Lot A',
        email: 'guardA@example.com',
        passwordHash: 'dummyhash',
        role: Role.GUARD,
        assignedLotId: lotA.id,
      },
    });

    const guardB = await prisma.user.create({
      data: {
        name: 'Guard Lot B',
        email: 'guardB@example.com',
        passwordHash: 'dummyhash',
        role: Role.GUARD,
        assignedLotId: lotB.id,
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'System Admin',
        email: 'admin@example.com',
        passwordHash: 'dummyhash',
        role: Role.ADMIN,
      },
    });

    return { lotA, lotB, slotA1, slotA2, slotB1, regularUser, guardA, guardB, admin };
  }

  it('USER role is refused with ForbiddenError on guard operations', async () => {
    const { regularUser, lotA, slotA1 } = await createTestFixture();

    await expect(getGuardBoard(regularUser.id, lotA.id)).rejects.toThrow(ForbiddenError);
    await expect(checkInBooking(regularUser.id, 'ABC123')).rejects.toThrow(ForbiddenError);
    await expect(
      guardSetSlotStatus(regularUser.id, slotA1.id, 'OCCUPIED')
    ).rejects.toThrow(ForbiddenError);
  });

  it('guard of wrong lot receives NotFoundError', async () => {
    const { guardA, lotB, slotB1, regularUser } = await createTestFixture();

    // Guard A tries to view Lot B board
    await expect(getGuardBoard(guardA.id, lotB.id)).rejects.toThrow(NotFoundError);

    // Guard A tries to mark slot B1
    await expect(
      guardSetSlotStatus(guardA.id, slotB1.id, 'OCCUPIED')
    ).rejects.toThrow(NotFoundError);

    // Create booking in Lot B
    const bookingB = await prisma.booking.create({
      data: {
        userId: regularUser.id,
        slotId: slotB1.id,
        status: BookingStatus.CONFIRMED,
        startTime: new Date(Date.now() - 5 * 60 * 1000),
        endTime: new Date(Date.now() + 55 * 60 * 1000),
        amountPaise: 5000,
        idempotencyKey: 'key-wrong-lot',
        bookingCode: 'WRONG1',
      },
    });

    // Guard A tries to check in booking in Lot B
    await expect(checkInBooking(guardA.id, bookingB.bookingCode)).rejects.toThrow(
      NotFoundError
    );
  });

  it('checkInBooking succeeds inside window and writes AuditLog; second call throws BOOKING_NOT_ELIGIBLE', async () => {
    const { guardA, slotA1, regularUser } = await createTestFixture();

    // Create a CONFIRMED booking active right now
    const now = new Date();
    const booking = await prisma.booking.create({
      data: {
        userId: regularUser.id,
        slotId: slotA1.id,
        status: BookingStatus.CONFIRMED,
        startTime: new Date(now.getTime() - 5 * 60 * 1000), // started 5 mins ago
        endTime: new Date(now.getTime() + 55 * 60 * 1000), // ends in 55 mins
        amountPaise: 4000,
        idempotencyKey: 'checkin-key-1',
        bookingCode: 'VALID1',
      },
    });

    // 1. First check-in succeeds
    const checkedIn = await checkInBooking(guardA.id, 'VALID1');
    expect(checkedIn.checkedInAt).not.toBeNull();

    // Verify AuditLog written
    const auditLogs = await prisma.auditLog.findMany({
      where: { action: 'GUARD_CHECK_IN', targetId: booking.id },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.adminId).toBe(guardA.id);
    expect(auditLogs[0]?.targetType).toBe('BOOKING');

    // 2. Second check-in on same booking throws BOOKING_NOT_ELIGIBLE
    await expect(checkInBooking(guardA.id, 'VALID1')).rejects.toThrow(ConflictError);
  });

  it('checkInBooking fails if too early (more than 15 minutes before startTime)', async () => {
    const { guardA, slotA1, regularUser } = await createTestFixture();

    // Booking starts in 30 minutes (outside the 15-min arrival grace window)
    const now = new Date();
    await prisma.booking.create({
      data: {
        userId: regularUser.id,
        slotId: slotA1.id,
        status: BookingStatus.CONFIRMED,
        startTime: new Date(now.getTime() + 30 * 60 * 1000),
        endTime: new Date(now.getTime() + 90 * 60 * 1000),
        amountPaise: 4000,
        idempotencyKey: 'early-key-1',
        bookingCode: 'EARLY1',
      },
    });

    await expect(checkInBooking(guardA.id, 'EARLY1')).rejects.toThrow(ConflictError);
  });

  it('checkInBooking fails if after endTime', async () => {
    const { guardA, slotA1, regularUser } = await createTestFixture();

    // Booking ended 10 minutes ago
    const now = new Date();
    await prisma.booking.create({
      data: {
        userId: regularUser.id,
        slotId: slotA1.id,
        status: BookingStatus.CONFIRMED,
        startTime: new Date(now.getTime() - 70 * 60 * 1000),
        endTime: new Date(now.getTime() - 10 * 60 * 1000),
        amountPaise: 4000,
        idempotencyKey: 'ended-key-1',
        bookingCode: 'ENDED1',
      },
    });

    await expect(checkInBooking(guardA.id, 'ENDED1')).rejects.toThrow(ConflictError);
  });

  it('guardSetSlotStatus marks slot OCCUPIED then frees to AVAILABLE, retaining source GUARD', async () => {
    const { guardA, slotA1 } = await createTestFixture();

    // 1. Guard marks OCCUPIED
    const markOccupied = await guardSetSlotStatus(guardA.id, slotA1.id, 'OCCUPIED');
    expect(markOccupied.status).toBe(SlotStatus.OCCUPIED);
    expect(markOccupied.source).toBe(SlotSource.GUARD);

    let inDb = await prisma.parkingSlot.findUnique({ where: { id: slotA1.id } });
    expect(inDb?.status).toBe(SlotStatus.OCCUPIED);
    expect(inDb?.source).toBe(SlotSource.GUARD);

    // 2. Guard frees slot to AVAILABLE
    const markAvailable = await guardSetSlotStatus(guardA.id, slotA1.id, 'AVAILABLE');
    expect(markAvailable.status).toBe(SlotStatus.AVAILABLE);
    expect(markAvailable.source).toBe(SlotSource.GUARD);

    inDb = await prisma.parkingSlot.findUnique({ where: { id: slotA1.id } });
    expect(inDb?.status).toBe(SlotStatus.AVAILABLE);
    expect(inDb?.source).toBe(SlotSource.GUARD);

    // Verify AuditLog written for walk-ins
    const auditLogs = await prisma.auditLog.findMany({
      where: { action: 'GUARD_WALK_IN', targetId: slotA1.id },
    });
    expect(auditLogs.length).toBe(2);
  });

  it('guardSetSlotStatus on a HELD slot is refused with SLOT_UNAVAILABLE', async () => {
    const { guardA, slotA1 } = await createTestFixture();

    await prisma.parkingSlot.update({
      where: { id: slotA1.id },
      data: { status: SlotStatus.HELD, heldUntil: new Date(Date.now() + 5 * 60 * 1000) },
    });

    await expect(
      guardSetSlotStatus(guardA.id, slotA1.id, 'OCCUPIED')
    ).rejects.toThrow(ConflictError);
  });

  it('walk-in versus holdSlot race on the same slot gives exactly one winner', async () => {
    const { guardA, slotA1, regularUser } = await createTestFixture();

    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000);
    const endTime = new Date(now.getTime() + 70 * 60 * 1000);

    // Launch concurrent holdSlot vs guardSetSlotStatus
    const holdPromise = holdSlot(
      regularUser.id,
      slotA1.id,
      startTime,
      endTime,
      'race-hold-key-1'
    );
    const walkInPromise = guardSetSlotStatus(guardA.id, slotA1.id, 'OCCUPIED');

    const results = await Promise.allSettled([holdPromise, walkInPromise]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one winner and one loser
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0]?.status).toBe('rejected');
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
  });

  it('releaseNoShows runs idempotently and frees slots of unattended bookings', async () => {
    const { slotA1, slotA2, regularUser } = await createTestFixture();

    // Create 2 confirmed bookings past the no-show grace window (e.g. started 30 mins ago)
    const pastTime = new Date(Date.now() - 30 * 60 * 1000);
    const endTime = new Date(Date.now() + 30 * 60 * 1000);

    const booking1 = await prisma.booking.create({
      data: {
        userId: regularUser.id,
        slotId: slotA1.id,
        status: BookingStatus.CONFIRMED,
        startTime: pastTime,
        endTime,
        amountPaise: 4000,
        idempotencyKey: 'noshow-1',
        bookingCode: 'NOSHW1',
      },
    });

    const booking2 = await prisma.booking.create({
      data: {
        userId: regularUser.id,
        slotId: slotA2.id,
        status: BookingStatus.CONFIRMED,
        startTime: pastTime,
        endTime,
        amountPaise: 4000,
        idempotencyKey: 'noshow-2',
        bookingCode: 'NOSHW2',
      },
    });

    // Slots are RESERVED
    await prisma.parkingSlot.update({
      where: { id: slotA1.id },
      data: { status: SlotStatus.RESERVED },
    });
    await prisma.parkingSlot.update({
      where: { id: slotA2.id },
      data: { status: SlotStatus.RESERVED },
    });

    // 1. First execution releases 2 bookings
    const count1 = await releaseNoShows();
    expect(count1).toBe(2);

    const b1Db = await prisma.booking.findUnique({ where: { id: booking1.id } });
    const b2Db = await prisma.booking.findUnique({ where: { id: booking2.id } });
    expect(b1Db?.status).toBe(BookingStatus.NO_SHOW);
    expect(b2Db?.status).toBe(BookingStatus.NO_SHOW);

    const s1Db = await prisma.parkingSlot.findUnique({ where: { id: slotA1.id } });
    expect(s1Db?.status).toBe(SlotStatus.AVAILABLE);
    expect(s1Db?.source).toBe(SlotSource.APP);

    // 2. Second execution returns 0 (idempotent)
    const count2 = await releaseNoShows();
    expect(count2).toBe(0);
  });

  it('getGuardBoard returns lot and slots with active booking details', async () => {
    const { guardA, lotA, slotA1, regularUser } = await createTestFixture();

    const now = new Date();
    await prisma.booking.create({
      data: {
        userId: regularUser.id,
        slotId: slotA1.id,
        status: BookingStatus.CONFIRMED,
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 50 * 60 * 1000),
        amountPaise: 4000,
        idempotencyKey: 'board-test-key-1',
        bookingCode: 'BOARD1',
        vehicleNumber: 'MH12CD5678',
      },
    });

    const board = await getGuardBoard(guardA.id, lotA.id);
    expect(board.lot.id).toBe(lotA.id);
    expect(board.lot.name).toBe(lotA.name);
    expect(board.slots.length).toBe(2);

    const slot1View = board.slots.find((s) => s.slotId === slotA1.id);
    expect(slot1View?.booking).not.toBeNull();
    expect(slot1View?.booking?.bookingCode).toBe('BOARD1');
    expect(slot1View?.booking?.vehicleNumber).toBe('MH12CD5678');
  });
});
