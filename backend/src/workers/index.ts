import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { createBullMQConnection } from '../lib/redis.js';
import { initHeadlessSocket, closeSocket } from '../sockets/index.js';
import { expireHolds, completePastBookings } from '../services/reservations.service.js';
import { releaseNoShows } from '../services/guard.service.js';
import { rollupHour } from '../services/stats.service.js';
import { logger } from '../lib/logger.js';

export interface WorkerContext {
  queues: {
    holdExpiryQueue: Queue;
    noShowQueue: Queue;
    bookingCompletionQueue: Queue;
    rollupQueue: Queue;
  };
  workers: {
    holdExpiryWorker: Worker;
    noShowWorker: Worker;
    bookingCompletionWorker: Worker;
    rollupWorker: Worker;
  };
}

let activeContext: WorkerContext | null = null;
let activeConnections: Redis[] = [];

/**
 * Computes the start instant (in UTC) of the finished Indian Standard Time (IST) hour.
 * India is UTC+5:30 wall-clock time. Every India hour ends at minute 30 UTC.
 * When called at (or after) minute 30 of hour H (UTC), the hour that finished started at minute 30 of hour H-1 (UTC).
 */
export function computeFinishedIndiaHourStart(now: Date = new Date()): Date {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  oneHourAgo.setUTCMinutes(30, 0, 0);
  return oneHourAgo;
}

/**
 * Safely registers a repeatable job, removing any prior repeatable configuration
 * to ensure that repeatable jobs register exactly once (idempotent setup).
 */
async function scheduleRepeatableJob(
  queue: Queue,
  jobName: string,
  repeatOpts: { every?: number; pattern?: string; tz?: string }
): Promise<void> {
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === jobName) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  await queue.add(jobName, {}, {
    repeat: repeatOpts,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 50,
  });
}

/**
 * Starts all BullMQ background workers and initializes the headless Socket.IO emitter
 * per FROZEN CONTRACT C9 and Amendment F4.
 */
export async function startWorkers(): Promise<WorkerContext> {
  if (activeContext) {
    return activeContext;
  }

  logger.info('Initializing background workers and headless Socket.IO emitter...');

  // 1. Initialize headless Socket.IO server with Redis adapter for cross-process broadcasting
  initHeadlessSocket();

  // 2. Create dedicated BullMQ Redis connections per Amendment F4
  const createTrackedConnection = () => {
    const conn = createBullMQConnection();
    activeConnections.push(conn);
    return conn;
  };

  // 3. Queues
  const holdExpiryQueue = new Queue('hold-expiry', {
    connection: createTrackedConnection(),
  });
  const noShowQueue = new Queue('no-show-release', {
    connection: createTrackedConnection(),
  });
  const bookingCompletionQueue = new Queue('booking-completion', {
    connection: createTrackedConnection(),
  });
  const rollupQueue = new Queue('rollup-trigger', {
    connection: createTrackedConnection(),
  });

  // 4. Register repeatable schedules
  // - holdExpiry: every 30 seconds
  await scheduleRepeatableJob(holdExpiryQueue, 'hold-expiry-job', {
    every: 30000,
  });

  // - noShowRelease: every 60 seconds (1 minute)
  await scheduleRepeatableJob(noShowQueue, 'no-show-release-job', {
    every: 60000,
  });

  // - bookingCompletion: every 30 seconds
  await scheduleRepeatableJob(bookingCompletionQueue, 'booking-completion-job', {
    every: 30000,
  });

  // - rollupTrigger: minute 30 UTC every hour per Amendment F4
  await scheduleRepeatableJob(rollupQueue, 'rollup-trigger-job', {
    pattern: '30 * * * *',
    tz: 'UTC',
  });

  // 5. Workers
  const holdExpiryWorker = new Worker(
    'hold-expiry',
    async (job: Job) => {
      logger.debug({ jobId: job.id }, 'Processing holdExpiry job');
      const expiredCount = await expireHolds();
      logger.info({ expiredCount }, 'holdExpiry completed');
      return { expiredCount };
    },
    {
      connection: createTrackedConnection(),
    }
  );

  const noShowWorker = new Worker(
    'no-show-release',
    async (job: Job) => {
      logger.debug({ jobId: job.id }, 'Processing noShowRelease job');
      const releasedCount = await releaseNoShows();
      logger.info({ releasedCount }, 'noShowRelease completed');
      return { releasedCount };
    },
    {
      connection: createTrackedConnection(),
    }
  );

  const bookingCompletionWorker = new Worker(
    'booking-completion',
    async (job: Job) => {
      logger.debug({ jobId: job.id }, 'Processing bookingCompletion job');
      const completedCount = await completePastBookings();
      logger.info({ completedCount }, 'bookingCompletion completed');
      return { completedCount };
    },
    {
      connection: createTrackedConnection(),
    }
  );

  const rollupWorker = new Worker(
    'rollup-trigger',
    async (job: Job) => {
      logger.debug({ jobId: job.id }, 'Processing rollupTrigger job');
      const hourStart = computeFinishedIndiaHourStart();
      await rollupHour(hourStart);
      logger.info({ hourStart: hourStart.toISOString() }, 'rollupTrigger completed');
      return { hourStart: hourStart.toISOString() };
    },
    {
      connection: createTrackedConnection(),
    }
  );

  // Attach error listeners
  const workerList = [holdExpiryWorker, noShowWorker, bookingCompletionWorker, rollupWorker];
  for (const w of workerList) {
    w.on('error', (err) => {
      logger.error({ err, workerName: w.name }, 'Worker error occurred');
    });
    w.on('failed', (job, err) => {
      logger.error({ err, jobId: job?.id, workerName: w.name }, 'Job execution failed');
    });
  }

  activeContext = {
    queues: {
      holdExpiryQueue,
      noShowQueue,
      bookingCompletionQueue,
      rollupQueue,
    },
    workers: {
      holdExpiryWorker,
      noShowWorker,
      bookingCompletionWorker,
      rollupWorker,
    },
  };

  logger.info('Background workers started successfully');
  return activeContext;
}

/**
 * Gracefully shuts down all workers, closes queues, terminates headless socket emitter,
 * and disconnects dedicated BullMQ Redis clients.
 */
export async function stopWorkers(): Promise<void> {
  if (activeContext) {
    const { workers, queues } = activeContext;
    activeContext = null;

    logger.info('Stopping background workers and queues...');

    // 1. Close workers to stop accepting jobs
    await Promise.allSettled(Object.values(workers).map((w) => w.close()));

    // 2. Close queues
    await Promise.allSettled(Object.values(queues).map((q) => q.close()));
  }

  // 3. Close headless Socket.IO server and adapter
  await closeSocket();

  // 4. Disconnect dedicated BullMQ Redis connections
  if (activeConnections.length > 0) {
    const conns = [...activeConnections];
    activeConnections = [];
    await Promise.allSettled(
      conns.map((c) => c.quit().catch(() => c.disconnect()))
    );
  }

  logger.info('Background workers cleanly stopped');
}
