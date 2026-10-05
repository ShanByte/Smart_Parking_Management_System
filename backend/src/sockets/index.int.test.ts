import http from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Role, SlotStatus } from '@smart-parking/shared';
import '../test/helpers.js';
import { signAccessToken } from '../lib/crypto.js';
import { createSocketIoAdapterConnections } from '../lib/redis.js';
import {
  initSocket,
  closeSocket,
  emitSlotUpdated,
  emitLotUpdated,
  _clearRateLimits,
} from './index.js';

describe('Stage 5 Socket.IO Redis Adapter Integration Tests', () => {
  let server: http.Server;
  let serverPort: number;
  let validTokenUser1: string;
  let validTokenUser2: string;
  let validTokenUser3: string;

  beforeEach(async () => {
    _clearRateLimits();

    validTokenUser1 = signAccessToken({
      sub: 'usr_client_1',
      role: Role.USER,
    });
    validTokenUser2 = signAccessToken({
      sub: 'usr_client_2',
      role: Role.USER,
    });
    validTokenUser3 = signAccessToken({
      sub: 'usr_client_3',
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

  it('broadcasts slot and lot updates to clients in matching rooms via Redis adapter, isolating other rooms', async () => {
    // Initialize Socket.IO with real Redis pub/sub adapter
    initSocket(server, { useRedisAdapter: true });

    // Client 1 connects and joins lot:lot_alpha
    const client1: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: validTokenUser1 },
    });

    // Client 2 connects and joins lot:lot_beta
    const client2: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: validTokenUser2 },
    });

    // Client 3 connects and joins lot:lot_alpha
    const client3: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: validTokenUser3 },
    });

    await Promise.all([
      new Promise<void>((res) => {
        client1.on('connect', () => res());
        client1.connect();
      }),
      new Promise<void>((res) => {
        client2.on('connect', () => res());
        client2.connect();
      }),
      new Promise<void>((res) => {
        client3.on('connect', () => res());
        client3.connect();
      }),
    ]);

    client1.emit('lot:join', { lotId: 'lot_alpha' });
    client2.emit('lot:join', { lotId: 'lot_beta' });
    client3.emit('lot:join', { lotId: 'lot_alpha' });

    // Allow Redis subscriptions and room registrations to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Prepare message collectors
    const c1SlotEvents: Array<{ slotId: string; status: SlotStatus }> = [];
    const c2SlotEvents: Array<{ slotId: string; status: SlotStatus }> = [];
    const c3SlotEvents: Array<{ slotId: string; status: SlotStatus }> = [];

    const c1LotEvents: Array<{ parkingLotId: string; freeCount: number }> = [];
    const c2LotEvents: Array<{ parkingLotId: string; freeCount: number }> = [];
    const c3LotEvents: Array<{ parkingLotId: string; freeCount: number }> = [];

    client1.on('slot:updated', (data) => c1SlotEvents.push(data));
    client2.on('slot:updated', (data) => c2SlotEvents.push(data));
    client3.on('slot:updated', (data) => c3SlotEvents.push(data));

    client1.on('lot:updated', (data) => c1LotEvents.push(data));
    client2.on('lot:updated', (data) => c2LotEvents.push(data));
    client3.on('lot:updated', (data) => c3LotEvents.push(data));

    // Emit updates for lot_alpha
    emitSlotUpdated({
      slotId: 'slot_alpha_1',
      parkingLotId: 'lot_alpha',
      status: SlotStatus.OCCUPIED,
    });

    emitLotUpdated({
      parkingLotId: 'lot_alpha',
      freeCount: 25,
      totalSlots: 50,
    });

    // Wait for Redis pub/sub delivery
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Clients 1 and 3 in lot:lot_alpha should receive the event
    expect(c1SlotEvents.length).toBe(1);
    expect(c1SlotEvents[0]).toEqual({
      slotId: 'slot_alpha_1',
      parkingLotId: 'lot_alpha',
      status: SlotStatus.OCCUPIED,
    });
    expect(c3SlotEvents.length).toBe(1);
    expect(c3SlotEvents[0]).toEqual({
      slotId: 'slot_alpha_1',
      parkingLotId: 'lot_alpha',
      status: SlotStatus.OCCUPIED,
    });

    expect(c1LotEvents.length).toBe(1);
    expect(c1LotEvents[0]).toEqual({
      parkingLotId: 'lot_alpha',
      freeCount: 25,
      totalSlots: 50,
    });
    expect(c3LotEvents.length).toBe(1);
    expect(c3LotEvents[0]).toEqual({
      parkingLotId: 'lot_alpha',
      freeCount: 25,
      totalSlots: 50,
    });

    // Client 2 in lot:lot_beta must NOT have received any events from lot_alpha
    expect(c2SlotEvents.length).toBe(0);
    expect(c2LotEvents.length).toBe(0);

    client1.close();
    client2.close();
    client3.close();
  });

  it('receives cross-process broadcasts from a headless worker node via Redis pub/sub (Amendment F4)', async () => {
    // 1. Initialize API server Socket.IO with Redis adapter
    initSocket(server, { useRedisAdapter: true });

    // 2. Connect client to API server and join lot:lot_gamma
    const client: ClientSocket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: validTokenUser1 },
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
      client.connect();
    });

    client.emit('lot:join', { lotId: 'lot_gamma' });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Simulate a headless worker node running in a separate worker process per Amendment F4
    const workerRedis = createSocketIoAdapterConnections();
    const headlessWorkerIo = new SocketIOServer();
    headlessWorkerIo.adapter(createAdapter(workerRedis.pubClient, workerRedis.subClient));

    // Wait for adapter pub/sub channel subscriptions to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    const receivedSlotPromise = new Promise<{ slotId: string; status: SlotStatus }>((resolve) => {
      client.on('slot:updated', (data) => resolve(data));
    });

    const receivedLotPromise = new Promise<{ parkingLotId: string; freeCount: number }>((resolve) => {
      client.on('lot:updated', (data) => resolve(data));
    });

    // 4. Headless worker emits updates to lot:lot_gamma through its Redis adapter
    headlessWorkerIo.to('lot:lot_gamma').emit('slot:updated', {
      slotId: 'slot_gamma_7',
      parkingLotId: 'lot_gamma',
      status: SlotStatus.AVAILABLE,
    });

    headlessWorkerIo.to('lot:lot_gamma').emit('lot:updated', {
      parkingLotId: 'lot_gamma',
      freeCount: 99,
      totalSlots: 100,
    });

    // 5. Verify the client connected to the HTTP API server receives the broadcasted events
    const slotEvent = await receivedSlotPromise;
    expect(slotEvent).toEqual({
      slotId: 'slot_gamma_7',
      parkingLotId: 'lot_gamma',
      status: SlotStatus.AVAILABLE,
    });

    const lotEvent = await receivedLotPromise;
    expect(lotEvent).toEqual({
      parkingLotId: 'lot_gamma',
      freeCount: 99,
      totalSlots: 100,
    });

    // Clean up worker node
    await Promise.allSettled(
      [...(headlessWorkerIo as unknown as { _nsps: Map<string, { adapter: { close: () => Promise<void> } }> })._nsps.values()].map(
        async (nsp) => {
          await nsp.adapter.close();
        }
      )
    );
    await Promise.allSettled([
      workerRedis.pubClient.quit().catch(() => workerRedis.pubClient.disconnect()),
      workerRedis.subClient.quit().catch(() => workerRedis.subClient.disconnect()),
    ]);
    client.close();
  });
});
