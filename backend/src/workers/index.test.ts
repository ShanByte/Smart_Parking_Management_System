import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as reservationsService from '../services/reservations.service.js';
import * as guardService from '../services/guard.service.js';
import * as statsService from '../services/stats.service.js';

interface MockRepeatableJob {
  name: string;
  key: string;
  every?: string;
  pattern?: string;
}

type ProcessorFn = (job: { name: string; data: unknown }) => Promise<unknown>;

// Mock bullmq in unit tests so unit tests do not depend on external Redis connections
const registeredProcessors: Record<string, ProcessorFn> = {};
const registeredRepeatables: Record<string, MockRepeatableJob[]> = {
  'hold-expiry': [],
  'no-show-release': [],
  'booking-completion': [],
  'rollup-trigger': [],
};

vi.mock('bullmq', () => {
  return {
    Queue: class MockQueue {
      name: string;
      constructor(name: string) {
        this.name = name;
        if (!registeredRepeatables[name]) {
          registeredRepeatables[name] = [];
        }
      }
      async getRepeatableJobs(): Promise<MockRepeatableJob[]> {
        return registeredRepeatables[this.name] || [];
      }
      async removeRepeatableByKey(key: string): Promise<void> {
        registeredRepeatables[this.name] = (registeredRepeatables[this.name] || []).filter(
          (j) => j.key !== key
        );
      }
      async add(
        name: string,
        data: unknown,
        opts?: { repeat?: { every?: number; pattern?: string } }
      ) {
        if (opts?.repeat) {
          (registeredRepeatables[this.name] ??= []).push({
            name,
            key: `repeatable_${name}`,
            every: opts.repeat.every ? String(opts.repeat.every) : undefined,
            pattern: opts.repeat.pattern,
          });
        }
        return {
          name,
          data,
          waitUntilFinished: async () => {
            const processor = registeredProcessors[this.name];
            if (processor) {
              return await processor({ name, data });
            }
            return {};
          },
        };
      }
      async close(): Promise<void> {}
    },
    Worker: class MockWorker {
      name: string;
      processor: ProcessorFn;
      constructor(name: string, processor: ProcessorFn) {
        this.name = name;
        this.processor = processor;
        registeredProcessors[name] = processor;
      }
      on(): this {
        return this;
      }
      async close(): Promise<void> {}
    },
    QueueEvents: class MockQueueEvents {
      constructor() {}
      async waitUntilReady(): Promise<void> {}
      async close(): Promise<void> {}
    },
  };
});

// Mock headless socket in unit tests
vi.mock('../sockets/index.js', () => ({
  initHeadlessSocket: vi.fn(),
  closeSocket: vi.fn(),
  emitSlotUpdated: vi.fn(),
  emitLotUpdated: vi.fn(),
}));

import { QueueEvents } from 'bullmq';
import {
  computeFinishedIndiaHourStart,
  startWorkers,
  stopWorkers,
} from './index.js';

describe('Stage 6 BullMQ Background Workers Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(registeredRepeatables)) {
      registeredRepeatables[key] = [];
    }
  });

  afterEach(async () => {
    await stopWorkers();
  });

  describe('computeFinishedIndiaHourStart (Amendment F4)', () => {
    it('computes exact UTC hour start for finished India hour when called at minute 30 UTC', () => {
      // 14:30 UTC corresponds to 20:00 (8:00 PM) in India (UTC+5:30)
      // The finished India hour was 19:00 - 20:00 IST (13:30 - 14:30 UTC)
      // Therefore, the start of that finished hour was 13:30 UTC
      const now = new Date('2026-10-06T14:30:00.000Z');
      const hourStart = computeFinishedIndiaHourStart(now);

      expect(hourStart.toISOString()).toBe('2026-10-06T13:30:00.000Z');
      expect(hourStart.getUTCMinutes()).toBe(30);
      expect(hourStart.getUTCSeconds()).toBe(0);
      expect(hourStart.getUTCMilliseconds()).toBe(0);
    });

    it('computes exact UTC hour start even with non-zero seconds and milliseconds', () => {
      const now = new Date('2026-10-06T09:35:42.789Z');
      const hourStart = computeFinishedIndiaHourStart(now);

      expect(hourStart.toISOString()).toBe('2026-10-06T08:30:00.000Z');
    });

    it('handles midnight / day boundary rollups correctly', () => {
      // 00:30 UTC -> finished hour started at 23:30 UTC previous day
      const now = new Date('2026-10-06T00:30:00.000Z');
      const hourStart = computeFinishedIndiaHourStart(now);

      expect(hourStart.toISOString()).toBe('2026-10-05T23:30:00.000Z');
    });
  });

  describe('startWorkers and repeatable job registration', () => {
    it('registers all 4 queues and repeatable jobs exactly once', async () => {
      const context = await startWorkers();

      expect(context.queues.holdExpiryQueue).toBeDefined();
      expect(context.queues.noShowQueue).toBeDefined();
      expect(context.queues.bookingCompletionQueue).toBeDefined();
      expect(context.queues.rollupQueue).toBeDefined();

      expect(context.workers.holdExpiryWorker).toBeDefined();
      expect(context.workers.noShowWorker).toBeDefined();
      expect(context.workers.bookingCompletionWorker).toBeDefined();
      expect(context.workers.rollupWorker).toBeDefined();

      // Check repeatable jobs registered in each queue
      const holdRepeatables = await context.queues.holdExpiryQueue.getRepeatableJobs();
      expect(holdRepeatables.length).toBe(1);
      expect(holdRepeatables[0]?.name).toBe('hold-expiry-job');
      expect(holdRepeatables[0]?.every).toBe('30000');

      const noShowRepeatables = await context.queues.noShowQueue.getRepeatableJobs();
      expect(noShowRepeatables.length).toBe(1);
      expect(noShowRepeatables[0]?.name).toBe('no-show-release-job');
      expect(noShowRepeatables[0]?.every).toBe('60000');

      const completionRepeatables = await context.queues.bookingCompletionQueue.getRepeatableJobs();
      expect(completionRepeatables.length).toBe(1);
      expect(completionRepeatables[0]?.name).toBe('booking-completion-job');
      expect(completionRepeatables[0]?.every).toBe('30000');

      const rollupRepeatables = await context.queues.rollupQueue.getRepeatableJobs();
      expect(rollupRepeatables.length).toBe(1);
      expect(rollupRepeatables[0]?.name).toBe('rollup-trigger-job');
      expect(rollupRepeatables[0]?.pattern).toBe('30 * * * *');

      // Calling startWorkers again must return the active context without creating duplicates
      const secondContext = await startWorkers();
      expect(secondContext).toBe(context);

      const holdRepeatablesAfter = await context.queues.holdExpiryQueue.getRepeatableJobs();
      expect(holdRepeatablesAfter.length).toBe(1);
    });

    it('stopWorkers gracefully closes all workers, queues, and headless socket', async () => {
      const context = await startWorkers();
      expect(context).toBeDefined();

      await stopWorkers();

      // Verify second stopWorkers call is safe no-op
      await expect(stopWorkers()).resolves.toBeUndefined();
    });
  });

  describe('Worker job invocation & idempotency', () => {
    it('holdExpiry worker invokes expireHolds service', async () => {
      const expireHoldsSpy = vi.spyOn(reservationsService, 'expireHolds').mockResolvedValue(3);

      const context = await startWorkers();
      const events = new QueueEvents('hold-expiry');
      const job = await context.queues.holdExpiryQueue.add('test-hold-expiry', {});
      const result = await job.waitUntilFinished(events);

      expect(result).toEqual({ expiredCount: 3 });
      expect(expireHoldsSpy).toHaveBeenCalled();
    });

    it('noShowRelease worker invokes releaseNoShows service', async () => {
      const releaseNoShowsSpy = vi.spyOn(guardService, 'releaseNoShows').mockResolvedValue(2);

      const context = await startWorkers();
      const events = new QueueEvents('no-show-release');
      const job = await context.queues.noShowQueue.add('test-no-show', {});
      const result = await job.waitUntilFinished(events);

      expect(result).toEqual({ releasedCount: 2 });
      expect(releaseNoShowsSpy).toHaveBeenCalled();
    });

    it('bookingCompletion worker invokes completePastBookings service', async () => {
      const completeBookingsSpy = vi
        .spyOn(reservationsService, 'completePastBookings')
        .mockResolvedValue(5);

      const context = await startWorkers();
      const events = new QueueEvents('booking-completion');
      const job = await context.queues.bookingCompletionQueue.add('test-completion', {});
      const result = await job.waitUntilFinished(events);

      expect(result).toEqual({ completedCount: 5 });
      expect(completeBookingsSpy).toHaveBeenCalled();
    });

    it('rollupTrigger worker invokes rollupHour service with computed hourStart', async () => {
      const rollupHourSpy = vi.spyOn(statsService, 'rollupHour').mockResolvedValue();

      const context = await startWorkers();
      const events = new QueueEvents('rollup-trigger');
      const job = await context.queues.rollupQueue.add('test-rollup', {});
      const result = await job.waitUntilFinished(events);

      expect(result).toHaveProperty('hourStart');
      expect(rollupHourSpy).toHaveBeenCalled();
    });
  });
});
