import { Booking, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import {
  ErrorCode,
  GuardBoard,
  Role,
  SlotStatus,
  SlotSource,
  BookingStatus,
} from '@smart-parking/shared';
import { emitSlotUpdated, emitLotUpdated } from '../sockets/index.js';

/**
 * Service for gate guard operations and no-show releases
 * per FROZEN CONTRACT C3, C7, C9, Security Rule 13, and Amendment F2.
 */

/**
/**
 * Helper to validate user existence and ensure caller is not a regular USER.
 * Role USER receives ForbiddenError.
 */
async function getValidatedGuardUser(
  guardUserId: string
): Promise<{ id: string; role: Role; assignedLotId: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: guardUserId },
    select: { id: true, role: true, assignedLotId: true },
  });

  if (!user) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `User not found: ${guardUserId}`);
  }

  if (user.role === Role.USER) {
    throw new ForbiddenError(
      ErrorCode.FORBIDDEN,
      'Access denied: USER role is not permitted to perform guard operations'
    );
  }

  return user as { id: string; role: Role; assignedLotId: string | null };
}

/**
 * Checks lot authorization:
 * Role GUARD must have assignedLotId equal to lotId.
 * Role ADMIN may act on any lot.
 * Wrong lot gives NotFoundError.
 */
function checkLotAuthorization(
  user: { role: Role; assignedLotId: string | null },
  lotId: string
): void {
  if (user.role === Role.GUARD && user.assignedLotId !== lotId) {
    // Contract: wrong lot gives NotFoundError to prevent information disclosure
    throw new NotFoundError(
      ErrorCode.NOT_FOUND,
      `Parking lot ${lotId} not found or not assigned to guard`
    );
  }
}

/**
 * Returns the guard dashboard for a parking lot per FROZEN CONTRACT C9.
 * One query per concern without N+1.
 */
export async function getGuardBoard(
  guardUserId: string,
  lotId: string
): Promise<GuardBoard> {
  const user = await getValidatedGuardUser(guardUserId);
  checkLotAuthorization(user, lotId);

  // 1. Fetch parking lot metadata
  const lot = await prisma.parkingLot.findUnique({
    where: { id: lotId },
    select: { id: true, name: true, totalSlots: true, isActive: true },
  });

  if (!lot || !lot.isActive) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking lot not found: ${lotId}`);
  }

  // 2. Fetch all slots in the lot
  const slots = await prisma.parkingSlot.findMany({
    where: { parkingLotId: lotId },
    orderBy: { slotNumber: 'asc' },
    select: {
      id: true,
      slotNumber: true,
      status: true,
      source: true,
    },
  });

  // 3. Fetch active bookings (HELD or CONFIRMED covering current or near-current window)
  const now = new Date();
  const activeBookings = await prisma.booking.findMany({
    where: {
      slot: { parkingLotId: lotId },
      status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
      endTime: { gte: now },
      startTime: { lte: new Date(now.getTime() + 60 * 60 * 1000) }, // up to 1 hr ahead
    },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      slotId: true,
      bookingCode: true,
      vehicleNumber: true,
      startTime: true,
      endTime: true,
      status: true,
      checkedInAt: true,
    },
  });

  // Map active bookings by slotId (first match wins since ordered by startTime asc)
  const slotBookingsMap = new Map<string, (typeof activeBookings)[0]>();
  for (const b of activeBookings) {
    if (!slotBookingsMap.has(b.slotId)) {
      slotBookingsMap.set(b.slotId, b);
    }
  }

  // 4. Build GuardBoard response
  return {
    lot: {
      id: lot.id,
      name: lot.name,
      totalSlots: lot.totalSlots,
    },
    slots: slots.map((s) => {
      const activeBooking = slotBookingsMap.get(s.id);
      return {
        slotId: s.id,
        slotNumber: s.slotNumber,
        status: s.status as SlotStatus,
        source: s.source as SlotSource,
        booking: activeBooking
          ? {
              bookingId: activeBooking.id,
              bookingCode: activeBooking.bookingCode,
              vehicleNumber: activeBooking.vehicleNumber,
              startTime: activeBooking.startTime.toISOString(),
              endTime: activeBooking.endTime.toISOString(),
              status: activeBooking.status as BookingStatus,
              checkedInAt: activeBooking.checkedInAt
                ? activeBooking.checkedInAt.toISOString()
                : null,
            }
          : null,
      };
    }),
  };
}

/**
 * Checks in a driver using their 6-character bookingCode per FROZEN CONTRACT C3 & C9.
 * Validates window (15 mins prior to startTime until endTime), CONFIRMED status, and non-duplicate.
 * Locks slot row first, booking row second (F2 Lock Order).
 * Writes an AuditLog row in the same transaction.
 */
export async function checkInBooking(
  guardUserId: string,
  bookingCode: string
): Promise<Booking> {
  if (!bookingCode || typeof bookingCode !== 'string' || bookingCode.trim().length === 0) {
    throw new ValidationError(ErrorCode.VALIDATION_ERROR, 'bookingCode is required');
  }

  // 1. Authorize user role FIRST
  const user = await getValidatedGuardUser(guardUserId);

  const normalizedCode = bookingCode.trim().toUpperCase();

  // 2. Find candidate booking and its lot
  const candidate = await prisma.booking.findUnique({
    where: { bookingCode: normalizedCode },
    include: {
      slot: {
        select: { id: true, parkingLotId: true, slotNumber: true },
      },
    },
  });

  if (!candidate) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking not found: ${normalizedCode}`);
  }

  // 3. Authorize guard for this lot
  checkLotAuthorization(user, candidate.slot.parkingLotId);

  // 3. Execute check-in transaction with F2 slot-first locking
  const checkedInBooking = await prisma.$transaction(
    async (tx) => {
      // Lock slot row FIRST (F2 Lock order)
      const lockedSlots = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "ParkingSlot" WHERE id = ${candidate.slotId} FOR UPDATE
      `;
      if (!lockedSlots || lockedSlots.length === 0) {
        throw new NotFoundError(ErrorCode.NOT_FOUND, 'Parking slot not found');
      }

      // Lock and re-check booking row SECOND (F2 Lock order)
      const lockedBookings = await tx.$queryRaw<
        Array<{
          id: string;
          status: BookingStatus;
          startTime: Date;
          endTime: Date;
          checkedInAt: Date | null;
        }>
      >`
        SELECT id, status, "startTime", "endTime", "checkedInAt"
        FROM "Booking"
        WHERE id = ${candidate.id}
        FOR UPDATE
      `;

      if (!lockedBookings || lockedBookings.length === 0) {
        throw new NotFoundError(ErrorCode.NOT_FOUND, 'Booking not found');
      }

      const booking = lockedBookings[0]!;

      // Verify status is CONFIRMED
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new ConflictError(
          ErrorCode.BOOKING_NOT_ELIGIBLE,
          `Booking cannot be checked in with status ${booking.status}`
        );
      }

      // Verify not already checked in
      if (booking.checkedInAt !== null) {
        throw new ConflictError(
          ErrorCode.BOOKING_NOT_ELIGIBLE,
          'Booking is already checked in'
        );
      }

      // Verify time window: 15 minutes before startTime until endTime per C3
      const now = new Date();
      const minCheckInTime = new Date(booking.startTime.getTime() - 15 * 60 * 1000);
      const maxCheckInTime = booking.endTime;

      if (now < minCheckInTime) {
        throw new ConflictError(
          ErrorCode.BOOKING_NOT_ELIGIBLE,
          'Check-in is too early (opens 15 minutes before booking start time)'
        );
      }

      if (now > maxCheckInTime) {
        throw new ConflictError(
          ErrorCode.BOOKING_NOT_ELIGIBLE,
          'Booking has already ended'
        );
      }

      // Set checkedInAt on booking
      const updated = await tx.booking.update({
        where: { id: candidate.id },
        data: {
          checkedInAt: now,
        },
      });

      // Write AuditLog row GUARD_CHECK_IN in the same transaction
      await tx.auditLog.create({
        data: {
          adminId: guardUserId,
          action: 'GUARD_CHECK_IN',
          targetType: 'BOOKING',
          targetId: candidate.id,
          details: {
            bookingCode: normalizedCode,
            slotId: candidate.slotId,
            checkedInAt: now.toISOString(),
          },
        },
      });

      return updated;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );

  return checkedInBooking;
}

/**
 * Manually marks a slot OCCUPIED (walk-in) or AVAILABLE (freed) per FROZEN CONTRACT C7 & C9.
 * Allowed only when slot is AVAILABLE or OCCUPIED (HELD/RESERVED give SLOT_UNAVAILABLE 409).
 * Sets status and source GUARD (retained even when freeing).
 * Row lock on slot; writes AuditLog row GUARD_WALK_IN in the same transaction.
 */
export async function guardSetSlotStatus(
  guardUserId: string,
  slotId: string,
  status: 'OCCUPIED' | 'AVAILABLE'
): Promise<{ slotId: string; status: SlotStatus; source: SlotSource }> {
  if (status !== 'OCCUPIED' && status !== 'AVAILABLE') {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid status: must be OCCUPIED or AVAILABLE'
    );
  }

  // 1. Authorize user role FIRST
  const user = await getValidatedGuardUser(guardUserId);

  // 2. Find candidate slot to check lot assignment
  const candidateSlot = await prisma.parkingSlot.findUnique({
    where: { id: slotId },
    select: { id: true, parkingLotId: true },
  });

  if (!candidateSlot) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking slot not found: ${slotId}`);
  }

  // 3. Authorize guard for this lot
  checkLotAuthorization(user, candidateSlot.parkingLotId);

  // 3. Execute in transaction with row lock on slot
  const result = await prisma.$transaction(
    async (tx) => {
      const lockedSlots = await tx.$queryRaw<
        Array<{
          id: string;
          parkingLotId: string;
          status: SlotStatus;
          source: SlotSource;
        }>
      >`
        SELECT id, "parkingLotId", status, source
        FROM "ParkingSlot"
        WHERE id = ${slotId}
        FOR UPDATE
      `;

      if (!lockedSlots || lockedSlots.length === 0) {
        throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking slot not found: ${slotId}`);
      }

      const slot = lockedSlots[0]!;

      // HELD or RESERVED slots cannot be touched by guard walk-in (409 SLOT_UNAVAILABLE)
      if (slot.status === SlotStatus.HELD || slot.status === SlotStatus.RESERVED) {
        throw new ConflictError(
          ErrorCode.SLOT_UNAVAILABLE,
          `Cannot modify slot currently in ${slot.status} status`
        );
      }

      // Update slot: status to target, source to GUARD, update timestamp
      await tx.parkingSlot.update({
        where: { id: slotId },
        data: {
          status: status as SlotStatus,
          source: SlotSource.GUARD,
          statusUpdatedAt: new Date(),
        },
      });

      // Write AuditLog row GUARD_WALK_IN
      await tx.auditLog.create({
        data: {
          adminId: guardUserId,
          action: 'GUARD_WALK_IN',
          targetType: 'SLOT',
          targetId: slotId,
          details: {
            status,
            previousStatus: slot.status,
            previousSource: slot.source,
          },
        },
      });

      return {
        slotId: slot.id,
        parkingLotId: slot.parkingLotId,
        status: status as SlotStatus,
        source: SlotSource.GUARD,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );

  // 4. Emit real-time events after commit
  emitSlotUpdated({
    slotId: result.slotId,
    parkingLotId: result.parkingLotId,
    status: result.status,
  });

  const lotStats = await prisma.parkingLot.findUnique({
    where: { id: result.parkingLotId },
    select: {
      totalSlots: true,
      slots: {
        where: { status: SlotStatus.AVAILABLE },
        select: { id: true },
      },
    },
  });

  if (lotStats) {
    emitLotUpdated({
      parkingLotId: result.parkingLotId,
      freeCount: lotStats.slots.length,
      totalSlots: lotStats.totalSlots,
    });
  }

  return {
    slotId: result.slotId,
    status: result.status,
    source: result.source,
  };
}

/**
 * Sweeps CONFIRMED bookings not checked in after NO_SHOW_GRACE_MINUTES past startTime.
 * For each, locks the slot first, locks and re-checks the booking second (F2 Lock Order).
 * Marks booking NO_SHOW, frees the slot to AVAILABLE (source APP, preserving OCCUPIED states).
 * Idempotent and safe to run concurrently; returns the count of released bookings.
 */
export async function releaseNoShows(): Promise<number> {
  const graceMinutes = parseInt(process.env.NO_SHOW_GRACE_MINUTES || '15', 10);
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);

  // Find candidate bookings
  const candidateBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      checkedInAt: null,
      startTime: { lt: cutoff },
    },
    select: {
      id: true,
      slotId: true,
    },
  });

  let releasedCount = 0;
  const affectedLots = new Set<string>();

  for (const candidate of candidateBookings) {
    try {
      const released = await prisma.$transaction(
        async (tx) => {
          // Lock slot row FIRST (F2 Lock order)
          const lockedSlots = await tx.$queryRaw<
            Array<{ id: string; parkingLotId: string; status: SlotStatus }>
          >`
            SELECT id, "parkingLotId", status
            FROM "ParkingSlot"
            WHERE id = ${candidate.slotId}
            FOR UPDATE
          `;

          // Lock and re-check booking row SECOND (F2 Lock order)
          const lockedBookings = await tx.$queryRaw<
            Array<{ id: string; status: BookingStatus; checkedInAt: Date | null; startTime: Date }>
          >`
            SELECT id, status, "checkedInAt", "startTime"
            FROM "Booking"
            WHERE id = ${candidate.id}
            FOR UPDATE
          `;

          if (!lockedBookings || lockedBookings.length === 0) {
            return false;
          }

          const booking = lockedBookings[0]!;

          // Re-verify eligibility inside the lock
          if (
            booking.status === BookingStatus.CONFIRMED &&
            booking.checkedInAt === null &&
            booking.startTime < cutoff
          ) {
            // Update booking to NO_SHOW
            await tx.booking.update({
              where: { id: candidate.id },
              data: {
                status: BookingStatus.NO_SHOW,
              },
            });

            // Free the slot to AVAILABLE (source APP) only if it is not physically OCCUPIED
            if (lockedSlots && lockedSlots.length > 0) {
              const slot = lockedSlots[0]!;
              affectedLots.add(slot.parkingLotId);

              if (slot.status !== SlotStatus.OCCUPIED) {
                await tx.parkingSlot.update({
                  where: { id: slot.id },
                  data: {
                    status: SlotStatus.AVAILABLE,
                    source: SlotSource.APP,
                    heldUntil: null,
                    statusUpdatedAt: new Date(),
                  },
                });

                emitSlotUpdated({
                  slotId: slot.id,
                  parkingLotId: slot.parkingLotId,
                  status: SlotStatus.AVAILABLE,
                });
              }
            }

            return true;
          }

          return false;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        }
      );

      if (released) {
        releasedCount++;
      }
    } catch {
      // Continue processing next candidate on transient lock collision
    }
  }

  // Broadcast updated lot free counts after all commits
  for (const lotId of affectedLots) {
    const lotStats = await prisma.parkingLot.findUnique({
      where: { id: lotId },
      select: {
        totalSlots: true,
        slots: {
          where: { status: SlotStatus.AVAILABLE },
          select: { id: true },
        },
      },
    });

    if (lotStats) {
      emitLotUpdated({
        parkingLotId: lotId,
        freeCount: lotStats.slots.length,
        totalSlots: lotStats.totalSlots,
      });
    }
  }

  return releasedCount;
}
