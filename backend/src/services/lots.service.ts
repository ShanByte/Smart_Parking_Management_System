import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { ErrorCode, LotWithCount, SlotView, SlotStatus } from '@smart-parking/shared';

/**
 * Service for parking lots and slot availability reads per FROZEN CONTRACT C7 & C9
 */

/**
 * Returns all active parking lots with current real-time free slot count.
 */
export async function getLotsWithFreeCount(): Promise<LotWithCount[]> {
  const lots = await prisma.parkingLot.findMany({
    where: { isActive: true },
    include: {
      slots: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return lots.map((lot) => {
    const freeCount = lot.slots.filter(
      (slot) => slot.status === SlotStatus.AVAILABLE
    ).length;

    return {
      id: lot.id,
      name: lot.name,
      address: lot.address,
      latitude: lot.latitude,
      longitude: lot.longitude,
      totalSlots: lot.totalSlots,
      freeCount,
      pricePerHourPaise: lot.pricePerHourPaise,
    };
  });
}

/**
 * Returns a single parking lot by ID with current free slot count.
 */
export async function getLot(lotId: string): Promise<LotWithCount> {
  const lot = await prisma.parkingLot.findUnique({
    where: { id: lotId },
    include: {
      slots: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!lot || !lot.isActive) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking lot not found: ${lotId}`);
  }

  const freeCount = lot.slots.filter(
    (slot) => slot.status === SlotStatus.AVAILABLE
  ).length;

  return {
    id: lot.id,
    name: lot.name,
    address: lot.address,
    latitude: lot.latitude,
    longitude: lot.longitude,
    totalSlots: lot.totalSlots,
    freeCount,
    pricePerHourPaise: lot.pricePerHourPaise,
  };
}

/**
 * Returns slots for a lot. If a time window (from, to) is provided, calculates
 * the effective availability status for that window against active bookings.
 */
export async function getSlotsByLot(
  lotId: string,
  from?: Date,
  to?: Date
): Promise<SlotView[]> {
  const lot = await prisma.parkingLot.findUnique({
    where: { id: lotId },
    select: { id: true, isActive: true },
  });

  if (!lot || !lot.isActive) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking lot not found: ${lotId}`);
  }

  const slots = await prisma.parkingSlot.findMany({
    where: { parkingLotId: lotId },
    orderBy: { slotNumber: 'asc' },
  });

  // If no time window specified, return real-time status of each slot
  if (!from || !to) {
    return slots.map((s) => ({
      id: s.id,
      slotNumber: s.slotNumber,
      status: s.status as SlotStatus,
    }));
  }

  // Validate time window
  if (from >= to) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid time window: "from" must be before "to"'
    );
  }

  // Find active bookings (HELD or CONFIRMED) overlapping with the window [from, to)
  const activeBookings = await prisma.booking.findMany({
    where: {
      slot: { parkingLotId: lotId },
      status: { in: ['HELD', 'CONFIRMED'] },
      startTime: { lt: to },
      endTime: { gt: from },
    },
    select: {
      slotId: true,
      status: true,
    },
  });

  const bookedSlotMap = new Map<string, string>();
  for (const b of activeBookings) {
    bookedSlotMap.set(b.slotId, b.status);
  }

  const now = new Date();
  const isCurrentWindow = now >= from && now < to;

  return slots.map((s) => {
    const bookingStatus = bookedSlotMap.get(s.id);
    let status: SlotStatus;

    if (bookingStatus === 'HELD') {
      status = SlotStatus.HELD;
    } else if (bookingStatus === 'CONFIRMED') {
      status = SlotStatus.RESERVED;
    } else if (isCurrentWindow && s.status === SlotStatus.OCCUPIED) {
      status = SlotStatus.OCCUPIED;
    } else {
      status = SlotStatus.AVAILABLE;
    }

    return {
      id: s.id,
      slotNumber: s.slotNumber,
      status,
    };
  });
}
