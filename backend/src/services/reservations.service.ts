import { Booking, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../lib/errors.js';
import { ErrorCode, SlotStatus } from '@smart-parking/shared';
import crypto from 'node:crypto';

const BOOKING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_TRANSACTION_RETRIES = 5;
const CURRENT_WINDOW_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour arrival window

/**
 * Generates a 6-character random booking code from the FROZEN CONTRACT C3 alphabet.
 * Excludes ambiguous characters (0, O, 1, I).
 */
function generateBookingCode(): string {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      code += BOOKING_CODE_ALPHABET[byte % BOOKING_CODE_ALPHABET.length]!;
    }
  }
  return code;
}

/**
 * Executes a database operation within a whole-transaction retry loop per Amendment F2.
 * If a unique violation occurs (collision on bookingCode or idempotencyKey race),
 * retries the entire transaction up to 5 times.
 */
async function executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (attempts < MAX_TRANSACTION_RETRIES) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempts++;
      const isUniqueViolation =
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') ||
        (err instanceof Error &&
          (err.message.includes('unique constraint') ||
            err.message.includes('Unique constraint') ||
            err.message.includes('23505')));

      if (isUniqueViolation && attempts < MAX_TRANSACTION_RETRIES) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Transaction failed after maximum retries');
}

/**
 * Holds a parking slot for 5 minutes per FROZEN CONTRACT C3, C9, and Amendment F2.
 * Uses a row lock (SELECT FOR UPDATE) on the slot and whole-transaction retry on collision.
 * Correctly distinguishes current window holds from valid non-overlapping future reservations.
 */
export async function holdSlot(
  userId: string,
  slotId: string,
  startTime: Date,
  endTime: Date,
  idempotencyKey: string,
  vehicleNumber?: string
): Promise<Booking> {
  const now = new Date();

  // 1. Validation per C3
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 64) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Idempotency-Key must be between 8 and 64 characters'
    );
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  const minDurationMs = 15 * 60 * 1000; // 15 mins
  const maxDurationMs = 24 * 60 * 60 * 1000; // 24 hours

  if (durationMs < minDurationMs || durationMs > maxDurationMs) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Booking duration must be between 15 minutes and 24 hours'
    );
  }

  // startTime may be at most 1 minute in the past and at most 7 days ahead
  const minStartTime = new Date(now.getTime() - 60 * 1000);
  const maxStartTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (startTime < minStartTime) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'startTime may be at most 1 minute in the past'
    );
  }

  if (startTime > maxStartTime) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'startTime may be at most 7 days in the future'
    );
  }

  if (vehicleNumber !== undefined && vehicleNumber !== null && vehicleNumber.trim() !== '') {
    if (!/^[A-Z0-9]{4,15}$/.test(vehicleNumber)) {
      throw new ValidationError(
        ErrorCode.VALIDATION_ERROR,
        'vehicleNumber must be 4-15 uppercase alphanumeric characters'
      );
    }
  } else {
    vehicleNumber = undefined;
  }

  // 2. Fast-path idempotency check: if already processed for this user, return existing
  const existingBooking = await prisma.booking.findUnique({
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey,
      },
    },
  });

  if (existingBooking) {
    return existingBooking;
  }

  // 3. Execute hold transaction with row locking and retry on unique collision (F2)
  return await executeWithRetry(async () => {
    return await prisma.$transaction(
      async (tx) => {
        // Idempotency check inside transaction
        const innerExisting = await tx.booking.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey,
            },
          },
        });
        if (innerExisting) {
          return innerExisting;
        }

        // Lock slot row FIRST (F2 Lock order) using parameterized tagged template
        const lockedSlots = await tx.$queryRaw<
          Array<{
            id: string;
            parkingLotId: string;
            status: SlotStatus;
            pricePerHourPaise: number;
          }>
        >`
          SELECT s.id, s."parkingLotId", s.status, l."pricePerHourPaise"
          FROM "ParkingSlot" s
          JOIN "ParkingLot" l ON s."parkingLotId" = l.id
          WHERE s.id = ${slotId} AND l."isActive" = true
          FOR UPDATE OF s
        `;

        if (!lockedSlots || lockedSlots.length === 0) {
          throw new NotFoundError(
            ErrorCode.NOT_FOUND,
            `Parking slot ${slotId} not found or parking lot is inactive`
          );
        }

        const slot = lockedSlots[0];
        if (!slot) {
          throw new NotFoundError(
            ErrorCode.NOT_FOUND,
            `Parking slot ${slotId} not found or parking lot is inactive`
          );
        }
        const currentTime = new Date();
        const isCurrentWindow = startTime <= new Date(currentTime.getTime() + CURRENT_WINDOW_THRESHOLD_MS);

        // For immediate / current window reservations, the physical slot must be AVAILABLE right now.
        // For non-overlapping future reservations, current physical occupancy does not block booking.
        if (isCurrentWindow && slot.status !== SlotStatus.AVAILABLE) {
          throw new ConflictError(
            ErrorCode.SLOT_UNAVAILABLE,
            `Slot ${slotId} is currently ${slot.status} and cannot be held for the current window`
          );
        }

        // Check overlapping active bookings (HELD or CONFIRMED) using PostgreSQL range overlap
        const overlappingBookings = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Booking"
          WHERE "slotId" = ${slotId}
            AND status IN ('HELD', 'CONFIRMED')
            AND tstzrange("startTime", "endTime") && tstzrange(${startTime}, ${endTime})
          LIMIT 1
        `;

        if (overlappingBookings.length > 0) {
          throw new ConflictError(
            ErrorCode.SLOT_UNAVAILABLE,
            `Slot ${slotId} is already reserved or held for this time window`
          );
        }

        // Calculate amountPaise = ceil(hours * pricePerHourPaise) per C3
        const durationHours = durationMs / (1000 * 60 * 60);
        const amountPaise = Math.ceil(durationHours * slot.pricePerHourPaise);

        // Hold lasts 5 minutes per C3
        const heldUntil = new Date(Date.now() + 5 * 60 * 1000);
        const bookingCode = generateBookingCode();

        // Update slot status to HELD only if the booking covers the current active window
        if (isCurrentWindow) {
          await tx.parkingSlot.update({
            where: { id: slotId },
            data: {
              status: 'HELD',
              source: 'APP',
              heldUntil,
              statusUpdatedAt: new Date(),
            },
          });
        }

        // Create booking with status HELD
        const booking = await tx.booking.create({
          data: {
            userId,
            slotId,
            status: 'HELD',
            startTime,
            endTime,
            amountPaise,
            heldUntil,
            idempotencyKey,
            bookingCode,
            vehicleNumber: vehicleNumber ?? null,
          },
        });

        return booking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      }
    );
  });
}

/**
 * Confirms a held booking after payment verification per FROZEN CONTRACT C3, C9, and Amendment F2.
 * Validates order, amount, payment identity, and hold eligibility.
 * Idempotent: calling twice for a booking already CONFIRMED with the same payment ID returns it.
 */
export async function confirmBooking(
  bookingId: string,
  payment: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amountPaise: number;
  }
): Promise<Booking> {
  // Validate payment input
  if (!payment.razorpayOrderId || !payment.razorpayOrderId.trim()) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'razorpayOrderId is required'
    );
  }

  if (!payment.razorpayPaymentId || !payment.razorpayPaymentId.trim()) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'razorpayPaymentId is required'
    );
  }

  if (
    typeof payment.amountPaise !== 'number' ||
    payment.amountPaise <= 0 ||
    !Number.isInteger(payment.amountPaise)
  ) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'amountPaise must be a positive integer in paise'
    );
  }

  return await executeWithRetry(async () => {
    return await prisma.$transaction(
      async (tx) => {
        // Find existing booking to get slotId and details
        const existing = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { payments: true },
        });

        if (!existing) {
          throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking not found: ${bookingId}`);
        }

        // F2: Idempotent return if already CONFIRMED with the same razorpayPaymentId
        if (existing.status === 'CONFIRMED') {
          const matchingPayment = existing.payments.find(
            (p) => p.razorpayPaymentId === payment.razorpayPaymentId
          );
          if (matchingPayment) {
            return existing;
          }
          throw new ConflictError(
            ErrorCode.CONFLICT,
            'Booking is already confirmed with a different payment ID'
          );
        }

        // Validate hold eligibility
        if (existing.status !== 'HELD') {
          throw new ConflictError(
            ErrorCode.BOOKING_NOT_ELIGIBLE,
            `Cannot confirm booking in ${existing.status} status`
          );
        }

        // Validate hold has not expired
        const now = new Date();
        if (existing.heldUntil && existing.heldUntil < now) {
          throw new ConflictError(
            ErrorCode.BOOKING_NOT_ELIGIBLE,
            'Booking hold has expired and cannot be confirmed'
          );
        }

        // Validate payment amount integrity
        if (payment.amountPaise !== existing.amountPaise) {
          throw new ValidationError(
            ErrorCode.VALIDATION_ERROR,
            `Payment amount (${payment.amountPaise}) does not match booking amount (${existing.amountPaise})`
          );
        }

        // Lock slot row FIRST, booking row SECOND per Amendment F2
        await tx.$queryRaw`
          SELECT id FROM "ParkingSlot" WHERE id = ${existing.slotId} FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE
        `;

        // Re-check booking state after acquiring locks
        const reloadedBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { payments: true },
        });

        if (!reloadedBooking) {
          throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking not found: ${bookingId}`);
        }

        if (reloadedBooking.status === 'CONFIRMED') {
          const matchingPayment = reloadedBooking.payments.find(
            (p) => p.razorpayPaymentId === payment.razorpayPaymentId
          );
          if (matchingPayment) {
            return reloadedBooking;
          }
          throw new ConflictError(
            ErrorCode.CONFLICT,
            'Booking is already confirmed with a different payment ID'
          );
        }

        if (reloadedBooking.status !== 'HELD') {
          throw new ConflictError(
            ErrorCode.BOOKING_NOT_ELIGIBLE,
            `Cannot confirm booking in ${reloadedBooking.status} status`
          );
        }

        if (reloadedBooking.heldUntil && reloadedBooking.heldUntil < new Date()) {
          throw new ConflictError(
            ErrorCode.BOOKING_NOT_ELIGIBLE,
            'Booking hold has expired and cannot be confirmed'
          );
        }

        // Record payment
        await tx.payment.create({
          data: {
            bookingId,
            razorpayOrderId: payment.razorpayOrderId,
            razorpayPaymentId: payment.razorpayPaymentId,
            amountPaise: payment.amountPaise,
            paymentStatus: 'PAID',
          },
        });

        // Update slot to RESERVED if the booking is currently active or starting soon
        const isCurrentOrSoon = reloadedBooking.startTime <= new Date(Date.now() + CURRENT_WINDOW_THRESHOLD_MS);
        if (isCurrentOrSoon) {
          await tx.parkingSlot.update({
            where: { id: existing.slotId },
            data: {
              status: 'RESERVED',
              heldUntil: null,
              statusUpdatedAt: new Date(),
            },
          });
        }

        // Update booking to CONFIRMED
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CONFIRMED',
            heldUntil: null,
          },
        });

        return updatedBooking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      }
    );
  });
}

/**
 * Cancels a booking per FROZEN CONTRACT C3, C7, C9.
 * Must belong to the calling user and be in HELD or CONFIRMED status.
 * Preserves physical slot state if slot is currently occupied or has other active bookings.
 */
export async function cancelBooking(
  userId: string,
  bookingId: string
): Promise<Booking> {
  return await executeWithRetry(async () => {
    return await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
        });

        if (!booking) {
          throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking not found: ${bookingId}`);
        }

        if (booking.userId !== userId) {
          throw new ForbiddenError(
            ErrorCode.FORBIDDEN,
            'You are not authorized to cancel this booking'
          );
        }

        if (booking.status !== 'HELD' && booking.status !== 'CONFIRMED') {
          throw new ConflictError(
            ErrorCode.BOOKING_NOT_ELIGIBLE,
            `Cannot cancel booking with status ${booking.status}`
          );
        }

        // Lock slot row FIRST, booking row SECOND per Amendment F2
        await tx.$queryRaw`
          SELECT id FROM "ParkingSlot" WHERE id = ${booking.slotId} FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE
        `;

        // Re-check booking status after acquiring lock
        const reloaded = await tx.booking.findUnique({
          where: { id: bookingId },
        });

        if (!reloaded || (reloaded.status !== 'HELD' && reloaded.status !== 'CONFIRMED')) {
          throw new ConflictError(
            ErrorCode.BOOKING_NOT_ELIGIBLE,
            'Booking status changed before cancellation could complete'
          );
        }

        // Update booking status to CANCELLED
        const cancelledBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CANCELLED',
            heldUntil: null,
          },
        });

        // Release the slot to AVAILABLE only if it is not physically OCCUPIED
        // and no other active booking currently covers the current time.
        const currentSlot = await tx.parkingSlot.findUnique({
          where: { id: booking.slotId },
        });

        if (currentSlot && currentSlot.status !== SlotStatus.OCCUPIED) {
          const now = new Date();
          const otherCurrentActiveBooking = await tx.booking.findFirst({
            where: {
              slotId: booking.slotId,
              id: { not: bookingId },
              status: { in: ['HELD', 'CONFIRMED'] },
              startTime: { lte: now },
              endTime: { gt: now },
            },
          });

          if (!otherCurrentActiveBooking) {
            await tx.parkingSlot.update({
              where: { id: booking.slotId },
              data: {
                status: 'AVAILABLE',
                source: 'APP',
                heldUntil: null,
                statusUpdatedAt: new Date(),
              },
            });
          }
        }

        return cancelledBooking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      }
    );
  });
}

/**
 * Sweeps and expires all holds whose heldUntil has passed per FROZEN CONTRACT C9.
 * Frees the associated slots to AVAILABLE (if HELD) and sets booking status to EXPIRED.
 */
export async function expireHolds(): Promise<number> {
  const now = new Date();

  // Find all candidate expired holds
  const expiredHoldCandidates = await prisma.booking.findMany({
    where: {
      status: 'HELD',
      heldUntil: { lt: now },
    },
    select: {
      id: true,
      slotId: true,
    },
  });

  let expiredCount = 0;

  for (const candidate of expiredHoldCandidates) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // Lock slot row FIRST, booking row SECOND per Amendment F2
          await tx.$queryRaw`
            SELECT id FROM "ParkingSlot" WHERE id = ${candidate.slotId} FOR UPDATE
          `;
          await tx.$queryRaw`
            SELECT id FROM "Booking" WHERE id = ${candidate.id} FOR UPDATE
          `;

          // Re-verify that booking is still HELD and expired
          const booking = await tx.booking.findUnique({
            where: { id: candidate.id },
          });

          if (booking && booking.status === 'HELD' && booking.heldUntil && booking.heldUntil < now) {
            await tx.booking.update({
              where: { id: candidate.id },
              data: {
                status: 'EXPIRED',
                heldUntil: null,
              },
            });

            // Only release slot to AVAILABLE if it is currently in HELD status (preserves OCCUPIED)
            const slot = await tx.parkingSlot.findUnique({
              where: { id: candidate.slotId },
            });

            if (slot && slot.status === 'HELD') {
              await tx.parkingSlot.update({
                where: { id: candidate.slotId },
                data: {
                  status: 'AVAILABLE',
                  source: 'APP',
                  heldUntil: null,
                  statusUpdatedAt: new Date(),
                },
              });
            }

            expiredCount++;
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        }
      );
    } catch (err) {
      console.error(`Failed to expire hold for booking ${candidate.id}:`, err);
    }
  }

  return expiredCount;
}
