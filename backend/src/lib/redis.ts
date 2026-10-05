import Redis, { RedisOptions } from 'ioredis';

/**
 * Returns the validated REDIS_URL from process.env without logging sensitive information.
 * Falls back to localhost default if unset (e.g. during unit tests without live services).
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://127.0.0.1:6379';
}

/**
 * Factory for creating fresh Redis client instances.
 * Ensures consistent options and supports rediss:// and passwords.
 */
export function createRedisClient(options: RedisOptions = {}): Redis {
  const url = getRedisUrl();
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    ...options,
  });
  client.on('error', () => {
    // Prevent unhandled error event exceptions during connection retries or teardown
  });
  return client;
}

/**
 * Factory for BullMQ worker and queue Redis connections per Amendment F4.
 * BullMQ requires maxRetriesPerRequest: null and lazyConnect: false/default.
 */
export function createBullMQConnection(options: RedisOptions = {}): Redis {
  const url = getRedisUrl();
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    ...options,
  });
  client.on('error', () => {
    // Prevent unhandled error event exceptions during connection retries or teardown
  });
  return client;
}

/**
 * Factory for Socket.IO Redis adapter pub/sub client pair per Amendment F4.
 * Subscribing connections cannot run regular commands, requiring isolated clients.
 */
export function createSocketIoAdapterConnections(): { pubClient: Redis; subClient: Redis } {
  const pubClient = createRedisClient({ lazyConnect: false });
  const subClient = pubClient.duplicate();
  subClient.on('error', () => {});
  return { pubClient, subClient };
}

/**
 * Shared singleton Redis instance per FROZEN CONTRACT C3
 */
declare global {
  var redisGlobal: Redis | undefined;
}

export const redis: Redis =
  globalThis.redisGlobal ??
  createRedisClient({
    lazyConnect: true,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.redisGlobal = redis;
}

export default redis;
