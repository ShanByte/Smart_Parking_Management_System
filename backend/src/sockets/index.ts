import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { z } from 'zod';
import {
  SlotStatus,
  ClientToServerEvents,
  ServerToClientEvents,
  Role,
} from '@smart-parking/shared';
import { createSocketIoAdapterConnections } from '../lib/redis.js';
import { verifyAccessToken } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export interface ExtendedServerToClientEvents extends ServerToClientEvents {
  error: (err: { message: string }) => void;
}

export type AppSocketServer = SocketIOServer<
  ClientToServerEvents,
  ExtendedServerToClientEvents,
  Record<string, never>,
  { user?: { userId: string; role: Role } }
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ExtendedServerToClientEvents,
  Record<string, never>,
  { user?: { userId: string; role: Role } }
>;

export const LotIdPayloadSchema = z
  .object({
    lotId: z.string().trim().min(1, 'lotId is required').max(128, 'lotId is too long'),
  })
  .strict();

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

const socketRateLimits = new Map<string, RateLimitTracker>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute

export function checkSocketRateLimit(
  socketId: string,
  limit: number = MAX_REQUESTS_PER_WINDOW,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const current = socketRateLimits.get(socketId);

  if (!current || now > current.resetAt) {
    socketRateLimits.set(socketId, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  return true;
}

export function cleanupSocketRateLimit(socketId: string): void {
  socketRateLimits.delete(socketId);
}

export function _clearRateLimits(): void {
  socketRateLimits.clear();
}

let ioInstance: SocketIOServer | null = null;
let activeRedisClients: { pubClient: Redis; subClient: Redis } | null = null;

export interface InitSocketOptions {
  useRedisAdapter?: boolean;
}

/**
 * Initializes the Socket.IO server with Redis pub/sub adapter (Amendment F4)
 * and handshake authentication (Security Rule 8).
 */
export function initSocket(
  httpServer?: http.Server,
  options: InitSocketOptions = {}
): SocketIOServer {
  const { useRedisAdapter = true } = options;

  const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());

  const ioOptions = {
    cors: {
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          (env.NODE_ENV === 'development' && /^http:\/\/(localhost|127\.0\.0\.1):(517\d|4173)$/.test(origin))
        ) {
          callback(null, true);
        } else {
          callback(new Error('Origin not permitted by CORS policy'));
        }
      },
      credentials: true,
    },
  };

  const io: AppSocketServer = httpServer
    ? new SocketIOServer(httpServer, ioOptions)
    : new SocketIOServer(ioOptions);

  if (useRedisAdapter) {
    try {
      const { pubClient, subClient } = createSocketIoAdapterConnections();
      pubClient.on('error', (err: unknown) => {
        logger.error({ err }, 'Socket.IO Redis pubClient error');
      });
      subClient.on('error', (err: unknown) => {
        logger.error({ err }, 'Socket.IO Redis subClient error');
      });
      io.adapter(createAdapter(pubClient, subClient));
      activeRedisClients = { pubClient, subClient };
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Socket.IO Redis adapter');
      throw err;
    }
  }

  // Security Rule 8: Reject handshake without a valid access token via verifyAccessToken
  io.use((socket, next) => {
    try {
      let token: string | undefined;

      if (socket.handshake.auth && typeof socket.handshake.auth.token === 'string') {
        token = socket.handshake.auth.token.trim();
      } else if (
        socket.handshake.headers.authorization &&
        typeof socket.handshake.headers.authorization === 'string'
      ) {
        const authHeader = socket.handshake.headers.authorization.trim();
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7).trim();
        } else {
          token = authHeader;
        }
      }

      if (!token) {
        logger.warn({ socketId: socket.id }, 'Socket handshake rejected: missing access token');
        return next(new Error('Unauthorized: Missing access token'));
      }

      const identity = verifyAccessToken(token);
      socket.data.user = identity;
      next();
    } catch (err) {
      logger.warn(
        { socketId: socket.id, err },
        'Socket handshake rejected: invalid or expired access token'
      );
      return next(new Error('Unauthorized: Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.data.user?.userId }, 'Socket connected');

    socket.on('lot:join', (payload: unknown) => {
      if (!checkSocketRateLimit(socket.id)) {
        logger.warn({ socketId: socket.id }, 'Socket rate limit exceeded for lot:join');
        socket.emit('error', { message: 'Rate limit exceeded: too many join/leave requests' });
        return;
      }

      const parseResult = LotIdPayloadSchema.safeParse(payload);
      if (!parseResult.success) {
        logger.warn(
          { socketId: socket.id, errors: parseResult.error.issues },
          'Invalid lot:join payload'
        );
        socket.emit('error', { message: 'Invalid payload: lotId required' });
        return;
      }

      const room = `lot:${parseResult.data.lotId}`;
      socket.join(room);
      logger.debug({ socketId: socket.id, room }, 'Socket joined lot room');
    });

    socket.on('lot:leave', (payload: unknown) => {
      if (!checkSocketRateLimit(socket.id)) {
        logger.warn({ socketId: socket.id }, 'Socket rate limit exceeded for lot:leave');
        socket.emit('error', { message: 'Rate limit exceeded: too many join/leave requests' });
        return;
      }

      const parseResult = LotIdPayloadSchema.safeParse(payload);
      if (!parseResult.success) {
        logger.warn(
          { socketId: socket.id, errors: parseResult.error.issues },
          'Invalid lot:leave payload'
        );
        socket.emit('error', { message: 'Invalid payload: lotId required' });
        return;
      }

      const room = `lot:${parseResult.data.lotId}`;
      socket.leave(room);
      logger.debug({ socketId: socket.id, room }, 'Socket left lot room');
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket disconnected');
      cleanupSocketRateLimit(socket.id);
    });
  });

  ioInstance = io as unknown as SocketIOServer;
  return ioInstance;
}

/**
 * Headless Worker Emitter per Amendment F4:
 * Workers run in a separate process without an HTTP server.
 * Instantiates a headless Socket.IO server connected to the Redis adapter
 * to publish slot:updated and lot:updated events across processes.
 */
export function initHeadlessSocket(options: InitSocketOptions = {}): SocketIOServer {
  return initSocket(undefined, options);
}

/**
 * Gracefully shuts down Socket.IO server and closes Redis pub/sub connections.
 */
export async function closeSocket(): Promise<void> {
  if (ioInstance) {
    const io = ioInstance;
    ioInstance = null;
    try {
      if (io.engine) {
        await new Promise<void>((resolve) => {
          io.close(() => resolve());
        });
      } else {
        await Promise.allSettled(
          [...io._nsps.values()].map(async (nsp) => {
            await nsp.adapter.close();
          })
        );
      }
    } catch {
      // Ignore if engine was not attached in headless mode
    }
  }
  if (activeRedisClients) {
    const { pubClient, subClient } = activeRedisClients;
    activeRedisClients = null;
    await Promise.allSettled([
      pubClient.quit().catch(() => pubClient.disconnect()),
      subClient.quit().catch(() => subClient.disconnect()),
    ]);
  }
  _clearRateLimits();
}

/**
 * Emits a real-time slot update to the lot's room.
 * Safe no-op if Socket.IO server is not yet initialized in this process.
 */
export function emitSlotUpdated(p: {
  slotId: string;
  parkingLotId: string;
  status: SlotStatus;
}): void {
  if (!ioInstance) return;
  ioInstance.to(`lot:${p.parkingLotId}`).emit('slot:updated', {
    slotId: p.slotId,
    parkingLotId: p.parkingLotId,
    status: p.status,
  });
}

/**
 * Emits a real-time lot occupancy / freeCount update to the lot's room.
 * Safe no-op if Socket.IO server is not yet initialized in this process.
 */
export function emitLotUpdated(p: {
  parkingLotId: string;
  freeCount: number;
  totalSlots: number;
}): void {
  if (!ioInstance) return;
  ioInstance.to(`lot:${p.parkingLotId}`).emit('lot:updated', {
    parkingLotId: p.parkingLotId,
    freeCount: p.freeCount,
    totalSlots: p.totalSlots,
  });
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function setIO(io: SocketIOServer | null): void {
  ioInstance = io;
}
