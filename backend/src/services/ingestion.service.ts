import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { ErrorCode, SlotStatus, SlotSource } from '@smart-parking/shared';
import { emitSlotUpdated, emitLotUpdated } from '../sockets/index.js';

/**
 * Service for ingesting IoT/sensor events per FROZEN CONTRACT C9,
 * Security Rule 11, and Amendment F3.
 */

/**
 * Ingests a hardware sensor, camera, or simulator event.
 *
 * Rules:
 * 1. Ignores timestamps more than 60 seconds in the future.
 * 2. Device must exist and be active.
 * 3. Ignores devices bound to a different lot (device with no lot may send for any lot).
 * 4. Ignores events for slots that are HELD or RESERVED.
 * 5. Ignores events older than or equal to slot.statusUpdatedAt (stale events).
 * 6. Amendment F3: Ignores events only when slot.source is GUARD and slot.status is OCCUPIED.
 *    When guard frees slot (status AVAILABLE), sensor events apply again and set source from Device.kind.
 * 7. Ingestion changes only AVAILABLE <-> OCCUPIED and sets source from Device.kind.
 * 8. Emits slotUpdated and lotUpdated events after database commit.
 */
export async function ingestSensorEvent(
  deviceId: string,
  slotId: string,
  status: 'AVAILABLE' | 'OCCUPIED',
  timestamp: Date
): Promise<{ applied: boolean }> {
  // 1. Validate inputs
  if (status !== 'AVAILABLE' && status !== 'OCCUPIED') {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid status: must be AVAILABLE or OCCUPIED'
    );
  }

  if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
    throw new ValidationError(ErrorCode.VALIDATION_ERROR, 'Invalid timestamp');
  }

  // 2. Ignore timestamps more than 60 seconds in the future
  const now = new Date();
  if (timestamp.getTime() > now.getTime() + 60 * 1000) {
    return { applied: false };
  }

  // 3. Validate device
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device || !device.isActive || device.revokedAt !== null) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Device not found or inactive: ${deviceId}`);
  }

  // 4. Execute slot update in a transaction with row lock
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      // Row lock on slot
      const lockedSlots = await tx.$queryRaw<
        Array<{
          id: string;
          parkingLotId: string;
          status: SlotStatus;
          source: SlotSource;
          statusUpdatedAt: Date;
        }>
      >`
        SELECT id, "parkingLotId", status, source, "statusUpdatedAt"
        FROM "ParkingSlot"
        WHERE id = ${slotId}
        FOR UPDATE
      `;

      if (!lockedSlots || lockedSlots.length === 0) {
        throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking slot not found: ${slotId}`);
      }

      const slot = lockedSlots[0]!;

      // Rule: Ignore devices bound to a different lot (device with no lot may send for any lot)
      if (device.parkingLotId && device.parkingLotId !== slot.parkingLotId) {
        return { applied: false, lotId: slot.parkingLotId };
      }

      // Rule: Ignore events for slots that are HELD or RESERVED
      if (slot.status === SlotStatus.HELD || slot.status === SlotStatus.RESERVED) {
        return { applied: false, lotId: slot.parkingLotId };
      }

      // Amendment F3: Ignore event only when slot source is GUARD and status is OCCUPIED
      if (slot.source === SlotSource.GUARD && slot.status === SlotStatus.OCCUPIED) {
        return { applied: false, lotId: slot.parkingLotId };
      }

      // Rule: Ignore events older than or equal to slot's statusUpdatedAt (stale events)
      if (timestamp.getTime() <= slot.statusUpdatedAt.getTime()) {
        return { applied: false, lotId: slot.parkingLotId };
      }

      // Apply the sensor event: transition between AVAILABLE and OCCUPIED, set source from Device.kind
      await tx.parkingSlot.update({
        where: { id: slotId },
        data: {
          status: status as SlotStatus,
          source: device.kind,
          statusUpdatedAt: timestamp,
        },
      });

      return { applied: true, lotId: slot.parkingLotId };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );

  // 5. Emit real-time socket events after transaction commit
  if (transactionResult.applied) {
    emitSlotUpdated({
      slotId,
      parkingLotId: transactionResult.lotId,
      status: status as SlotStatus,
    });

    // Query updated free count for the parking lot and broadcast
    const lotStats = await prisma.parkingLot.findUnique({
      where: { id: transactionResult.lotId },
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
        parkingLotId: transactionResult.lotId,
        freeCount: lotStats.slots.length,
        totalSlots: lotStats.totalSlots,
      });
    }
  }

  return { applied: transactionResult.applied };
}
