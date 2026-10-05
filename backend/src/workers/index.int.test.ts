import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueEvents, Queue, Worker } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { resetDb } from '../test/helpers.js';
import { createBullMQConnection } from '../lib/redis.js';
import { startWorkers, stopWorkers } from './index.js';
import { SlotStatus, BookingStatus } from '@smart-parking/shared';

describe('Stage 6 BullMQ Workers Integration Tests (PostgreSQL & Redis)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await stopWorkers();
  });

  it('holdExpiry worker sweeps expired holds in database and frees slots to AVAILABLE', async () => {
    // 1. Seed user, lot, slot, and an expired held booking
    const user = await prisma.user.create({
      data: {
        email: 'hold_worker_test@example.com',
        name: 'Hold Worker User',
        passwordHash: 'dummy_hash',
      },
    });

    const lot = await prisma.parkingLot.create({
      data: {
        name: 'Worker Test Lot A',
        address: '123 Test St',
        latitude: 18.5204,
        longitude: 73.8567,
        totalSlots: 1,
        pricePerHourPaise: 5000,
      },
    });

    const slot = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lot.id,
        slotNumber: 'A-01',
        status: SlotStatus.HELD,
        heldUntil: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
      },
    });

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        slotId: slot.id,
        bookingCode: 'HLD001',
        idempotencyKey: 'idem_hld_001',
        status: BookingStatus.HELD,
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        amountPaise: 5000,
        heldUntil: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
      },
    });

    // 2. Start workers
    const context = await startWorkers();
    const events = new QueueEvents('hold-expiry', {
      connection: createBullMQConnection(),
    });
    await events.waitUntilReady();

    try {
      // 3. Trigger hold-expiry job
      const job = await context.queues.holdExpiryQueue.add('int-test-hold-expiry', {});
      const result = await job.waitUntilFinished(events);

      expect(result.expiredCount).toBeGreaterThanOrEqual(1);

      // 4. Verify database state
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking?.status).toBe(BookingStatus.EXPIRED);
      expect(updatedBooking?.heldUntil).toBeNull();

      const updatedSlot = await prisma.parkingSlot.findUnique({
        where: { id: slot.id },
      });
      expect(updatedSlot?.status).toBe(SlotStatus.AVAILABLE);
      expect(updatedSlot?.heldUntil).toBeNull();
    } finally {
      await events.close();
    }
  });

  it('noShowRelease worker marks un-checked-in past bookings as NO_SHOW and frees slots', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'noshow_worker_test@example.com',
        name: 'NoShow Worker User',
        passwordHash: 'dummy_hash',
      },
    });

    const lot = await prisma.parkingLot.create({
      data: {
        name: 'Worker Test Lot B',
        address: '456 Test St',
        latitude: 18.5204,
        longitude: 73.8567,
        totalSlots: 1,
        pricePerHourPaise: 5000,
      },
    });

    const slot = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lot.id,
        slotNumber: 'B-01',
        status: SlotStatus.AVAILABLE,
      },
    });

    // Booking started 30 mins ago, no-show grace is 15 mins
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        slotId: slot.id,
        bookingCode: 'NOSH01',
        idempotencyKey: 'idem_nosh_001',
        status: BookingStatus.CONFIRMED,
        startTime: new Date(Date.now() - 30 * 60 * 1000),
        endTime: new Date(Date.now() + 30 * 60 * 1000),
        amountPaise: 5000,
        checkedInAt: null,
      },
    });

    const context = await startWorkers();
    const events = new QueueEvents('no-show-release', {
      connection: createBullMQConnection(),
    });
    await events.waitUntilReady();

    try {
      const job = await context.queues.noShowQueue.add('int-test-no-show', {});
      const result = await job.waitUntilFinished(events);

      expect(result.releasedCount).toBeGreaterThanOrEqual(1);

      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking?.status).toBe(BookingStatus.NO_SHOW);

      const updatedSlot = await prisma.parkingSlot.findUnique({
        where: { id: slot.id },
      });
      expect(updatedSlot?.status).toBe(SlotStatus.AVAILABLE);
    } finally {
      await events.close();
    }
  });

  it('bookingCompletion worker transitions past CONFIRMED bookings to COMPLETED', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'completion_worker_test@example.com',
        name: 'Completion Worker User',
        passwordHash: 'dummy_hash',
      },
    });

    const lot = await prisma.parkingLot.create({
      data: {
        name: 'Worker Test Lot C',
        address: '789 Test St',
        latitude: 18.5204,
        longitude: 73.8567,
        totalSlots: 1,
        pricePerHourPaise: 5000,
      },
    });

    const slot = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lot.id,
        slotNumber: 'C-01',
        status: SlotStatus.AVAILABLE,
      },
    });

    // Booking ended 15 mins ago
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        slotId: slot.id,
        bookingCode: 'CMPL01',
        idempotencyKey: 'idem_cmpl_001',
        status: BookingStatus.CONFIRMED,
        startTime: new Date(Date.now() - 75 * 60 * 1000),
        endTime: new Date(Date.now() - 15 * 60 * 1000),
        amountPaise: 5000,
        checkedInAt: new Date(Date.now() - 70 * 60 * 1000),
      },
    });

    const context = await startWorkers();
    const events = new QueueEvents('booking-completion', {
      connection: createBullMQConnection(),
    });
    await events.waitUntilReady();

    try {
      const job = await context.queues.bookingCompletionQueue.add('int-test-completion', {});
      const result = await job.waitUntilFinished(events);

      expect(result.completedCount).toBeGreaterThanOrEqual(1);

      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking?.status).toBe(BookingStatus.COMPLETED);

      const updatedSlot = await prisma.parkingSlot.findUnique({
        where: { id: slot.id },
      });
      expect(updatedSlot?.status).toBe(SlotStatus.AVAILABLE);
    } finally {
      await events.close();
    }
  });

  it('rollupTrigger worker records hourly occupancy rollup in OccupancyRecord table', async () => {
    const lot = await prisma.parkingLot.create({
      data: {
        name: 'Rollup Test Lot',
        address: '999 Rollup St',
        latitude: 18.5204,
        longitude: 73.8567,
        totalSlots: 2,
        pricePerHourPaise: 5000,
        isActive: true,
      },
    });

    await prisma.parkingSlot.createMany({
      data: [
        {
          parkingLotId: lot.id,
          slotNumber: 'R-01',
          status: SlotStatus.AVAILABLE,
        },
        {
          parkingLotId: lot.id,
          slotNumber: 'R-02',
          status: SlotStatus.OCCUPIED,
        },
      ],
    });

    const context = await startWorkers();
    const events = new QueueEvents('rollup-trigger', {
      connection: createBullMQConnection(),
    });
    await events.waitUntilReady();

    try {
      const job = await context.queues.rollupQueue.add('int-test-rollup', {});
      const result = await job.waitUntilFinished(events);

      expect(result).toHaveProperty('hourStart');

      // Verify that OccupancyRecord table contains an entry for this lot
      const records = await prisma.occupancyRecord.findMany({
        where: { parkingLotId: lot.id },
      });

      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0]?.totalSlots).toBe(2);
      expect(records[0]?.availableCount).toBe(1);
      expect(records[0]?.occupiedCount).toBe(1);
    } finally {
      await events.close();
    }
  });

  it('retries failed jobs up to configured attempts on transient failures', async () => {
    // Test that BullMQ retry mechanics function properly with configured attempts
    const retryQueueName = 'retry-test-queue';
    const retryQueue = new Queue(retryQueueName, {
      connection: createBullMQConnection(),
    });

    let executionCount = 0;
    const retryWorker = new Worker(
      retryQueueName,
      async () => {
        executionCount++;
        if (executionCount < 2) {
          throw new Error('Simulated transient error on attempt 1');
        }
        return { success: true, attemptsTaken: executionCount };
      },
      {
        connection: createBullMQConnection(),
      }
    );

    const events = new QueueEvents(retryQueueName, {
      connection: createBullMQConnection(),
    });
    await events.waitUntilReady();

    try {
      const job = await retryQueue.add(
        'retry-job',
        {},
        {
          attempts: 3,
          backoff: { type: 'fixed', delay: 100 },
        }
      );

      const result = await job.waitUntilFinished(events);
      expect(result).toEqual({ success: true, attemptsTaken: 2 });
      expect(executionCount).toBe(2);
    } finally {
      await retryWorker.close();
      await retryQueue.close();
      await events.close();
    }
  });
});
