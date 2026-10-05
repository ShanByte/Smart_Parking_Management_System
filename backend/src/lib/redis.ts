import Redis, { RedisOptions } from 'ioredis';

/**
 * Returns the validated REDIS_URL from process.env without logging sensitive information.
 */
function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is required');
  }
  return url;
}

/**
 * Factory for creating fresh Redis client instances.
 * Ensures consistent options and supports rediss:// and passwords.
 */
export function createRedisClient(options: RedisOptions = {}): Redis {
  const url = getRedisUrl();
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    ...options,
  });
}

/**
 * Factory for BullMQ worker and queue Redis connections per Amendment F4.
 * BullMQ requires maxRetriesPerRequest: null and lazyConnect: false/default.
 */
export function createBullMQConnection(options: RedisOptions = {}): Redis {
  const url = getRedisUrl();
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    ...options,
  });
}

/**
 * Factory for Socket.IO Redis adapter pub/sub client pair per Amendment F4.
 * Subscribing connections cannot run regular commands, requiring isolated clients.
 */
export function createSocketIoAdapterConnections(): { pubClient: Redis; subClient: Redis } {
  const pubClient = createRedisClient({ lazyConnect: false });
  const subClient = pubClient.duplicate();
  return { pubClient, subClient };
}

/**
 * Shared singleton Redis instance per FROZEN CONTRACT C3
 */
declare global {
  // eslint-disable-next-line no-var
  var redisGlobal: Redis | undefined;
}

export const redis: Redis =
  globalThis.redisGlobal ??
  createRedisClient({
    lazyConnect: false,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.redisGlobal = redis;
}

export default redis;
