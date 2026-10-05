import http from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Role, SlotStatus } from '@smart-parking/shared';
import { signAccessToken } from '../lib/crypto.js';
import {
  initSocket,
  closeSocket,
  emitSlotUpdated,
  emitLotUpdated,
  getIO,
  setIO,
  checkSocketRateLimit,
  cleanupSocketRateLimit,
  _clearRateLimits,
} from './index.js';

describe('Stage 5 Socket.IO Server Unit Tests', () => {
  let server: http.Server;
  let serverPort: number;
  let validToken: string;

  beforeEach(async () => {
    _clearRateLimits();
    validToken = signAccessToken({
      sub: 'usr_test_123',
      role: Role.USER,
    });

    server = http.createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await closeSocket();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('emitter functions are safe no-ops when ioInstance is not initialized', () => {
    setIO(null);
    expect(getIO()).toBeNull();

    // Must not throw
    expect(() => {
      emitSlotUpdated({
        slotId: 'slot_1',
        parkingLotId: 'lot_1',
        status: SlotStatus.AVAILABLE,
      });
    }).not.toThrow();

    expect(() => {
      emitLotUpdated({
        parkingLotId: 'lot_1',
        freeCount: 10,
        totalSlots: 20,
      });
    }).not.toThrow();
  });

  it('rejects connection if handshake auth token is missing', async () => {
    initSocket(server, { useRedisAdapter: false });

    const client: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
    });

    const connectErrorPromise = new Promise<Error>((resolve) => {
      client.on('connect_error', (err) => resolve(err));
    });

    client.connect();
    const err = await connectErrorPromise;
    expect(err.message).toMatch(/Unauthorized: Missing access token/);
    client.close();
  });

  it('rejects connection if handshake auth token is invalid', async () => {
    initSocket(server, { useRedisAdapter: false });

    const client: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: 'invalid.jwt.token' },
    });

    const connectErrorPromise = new Promise<Error>((resolve) => {
      client.on('connect_error', (err) => resolve(err));
    });

    client.connect();
    const err = await connectErrorPromise;
    expect(err.message).toMatch(/Unauthorized: Invalid or expired access token/);
    client.close();
  });

  it('accepts connection with valid token in auth.token and joins lot room', async () => {
    initSocket(server, { useRedisAdapter: false });

    const client: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: validToken },
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
      client.connect();
    });

    expect(client.connected).toBe(true);

    // Join lot room
    client.emit('lot:join', { lotId: 'lot_central_station' });

    // Wait briefly for server event loop
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify room membership on server
    const io = getIO()!;
    const sockets = await io.in('lot:lot_central_station').fetchSockets();
    expect(sockets.length).toBe(1);
    expect(sockets[0]?.id).toBe(client.id);

    // Leave room
    client.emit('lot:leave', { lotId: 'lot_central_station' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updatedSockets = await io.in('lot:lot_central_station').fetchSockets();
    expect(updatedSockets.length).toBe(0);

    client.close();
  });

  it('accepts connection with valid token in Authorization Bearer header', async () => {
    initSocket(server, { useRedisAdapter: false });

    const client: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      extraHeaders: {
        authorization: `Bearer ${validToken}`,
      },
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
      client.connect();
    });

    expect(client.connected).toBe(true);
    client.close();
  });

  it('rejects malformed lot:join and lot:leave payloads with error event', async () => {
    initSocket(server, { useRedisAdapter: false });

    const client: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: validToken },
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
      client.connect();
    });

    const errorPromise = new Promise<{ message: string }>((resolve) => {
      client.on('error', (err: { message: string }) => resolve(err));
    });

    // Send invalid payload (missing lotId)
    client.emit('lot:join', { invalid: 'payload' } as unknown as { lotId: string });

    const err = await errorPromise;
    expect(err.message).toMatch(/Invalid payload: lotId required/);

    client.close();
  });

  it('enforces per-socket rate limiting for excessive join/leave operations', async () => {
    const socketId = 'sock_rate_limit_test';
    _clearRateLimits();

    // Limit to 3 requests
    const limit = 3;
    const windowMs = 60000;

    expect(checkSocketRateLimit(socketId, limit, windowMs)).toBe(true);
    expect(checkSocketRateLimit(socketId, limit, windowMs)).toBe(true);
    expect(checkSocketRateLimit(socketId, limit, windowMs)).toBe(true);
    // 4th request exceeds limit
    expect(checkSocketRateLimit(socketId, limit, windowMs)).toBe(false);

    cleanupSocketRateLimit(socketId);
    // After cleanup, should be permitted again
    expect(checkSocketRateLimit(socketId, limit, windowMs)).toBe(true);
  });

  it('emitSlotUpdated and emitLotUpdated deliver events to room members', async () => {
    initSocket(server, { useRedisAdapter: false });

    const client: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: validToken },
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
      client.connect();
    });

    client.emit('lot:join', { lotId: 'lot_broadcast_test' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const slotEventPromise = new Promise<{ slotId: string; status: SlotStatus }>((resolve) => {
      client.on('slot:updated', (data) => resolve(data));
    });

    const lotEventPromise = new Promise<{ parkingLotId: string; freeCount: number }>((resolve) => {
      client.on('lot:updated', (data) => resolve(data));
    });

    // Emit slot and lot updates
    emitSlotUpdated({
      slotId: 'slot_99',
      parkingLotId: 'lot_broadcast_test',
      status: SlotStatus.OCCUPIED,
    });

    emitLotUpdated({
      parkingLotId: 'lot_broadcast_test',
      freeCount: 14,
      totalSlots: 20,
    });

    const slotData = await slotEventPromise;
    expect(slotData).toEqual({
      slotId: 'slot_99',
      parkingLotId: 'lot_broadcast_test',
      status: SlotStatus.OCCUPIED,
    });

    const lotData = await lotEventPromise;
    expect(lotData).toEqual({
      parkingLotId: 'lot_broadcast_test',
      freeCount: 14,
      totalSlots: 20,
    });

    client.close();
  });
});
