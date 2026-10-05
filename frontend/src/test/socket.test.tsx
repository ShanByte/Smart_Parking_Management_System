import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import http from 'http';
import { Server as SocketIOServer, Socket as ServerSocket } from 'socket.io';
import type { AddressInfo } from 'net';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  createSocket,
  setSocketInstanceForTesting,
  disconnectSocket,
} from '../services/socket';
import { useLotSocket, LotSocketEvent } from '../hooks/useLotSocket';
import { tokenManager } from '../services/tokenManager';
import * as apiModule from '../services/api';
import { SlotView, ParkingLot } from '../types/contract';

describe('WebSocket & useLotSocket Hook (C8, C9, Security Rule 7)', () => {
  let httpServer: http.Server;
  let ioServer: SocketIOServer;
  let serverPort: number;
  let serverUrl: string;
  let serverSockets: ServerSocket[] = [];

  beforeEach(async () => {
    serverSockets = [];

    // Spin up local fake Socket.IO server on random free port
    await new Promise<void>((resolve) => {
      httpServer = http.createServer();
      ioServer = new SocketIOServer(httpServer, {
        cors: { origin: '*' },
      });

      ioServer.on('connection', (socket) => {
        serverSockets.push(socket);
      });

      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        serverPort = addr.port;
        serverUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });

    tokenManager.setAccessToken('initial_valid_jwt_token');
  });

  afterEach(async () => {
    disconnectSocket();
    setSocketInstanceForTesting(null);
    vi.restoreAllMocks();

    await new Promise<void>((resolve) => {
      ioServer.close(() => {
        httpServer.close(() => {
          resolve();
        });
      });
    });
  });

  function createWrapper(queryClient: QueryClient) {
    return function QueryWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  }

  // --------------------------------------------------------------------------
  // 1. Connection & Handshake Authentication (Security Rule 7)
  // --------------------------------------------------------------------------
  it('connects to local fake socket server and transmits token in handshake auth', async () => {
    let receivedAuth: Record<string, unknown> = {};

    ioServer.use((socket, next) => {
      receivedAuth = socket.handshake.auth;
      next();
    });

    const clientSocket = createSocket(serverUrl);
    setSocketInstanceForTesting(clientSocket);

    clientSocket.connect();

    await waitFor(() => {
      expect(clientSocket.connected).toBe(true);
    });

    // Verify token was sent in handshake.auth, not in URL query parameters
    expect(receivedAuth.token).toBe('initial_valid_jwt_token');
    expect(clientSocket.io.opts.query).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 2. Room Join & Leave on Mount / Unmount
  // --------------------------------------------------------------------------
  it('emits lot:join on mount and lot:leave on unmount', async () => {
    const joinedLots: string[] = [];
    const leftLots: string[] = [];

    ioServer.on('connection', (socket) => {
      socket.on('lot:join', (payload: { lotId: string }) => {
        joinedLots.push(payload.lotId);
      });
      socket.on('lot:leave', (payload: { lotId: string }) => {
        leftLots.push(payload.lotId);
      });
    });

    const clientSocket = createSocket(serverUrl);
    setSocketInstanceForTesting(clientSocket);

    const queryClient = new QueryClient();
    const { unmount } = renderHook(() => useLotSocket('lot-42'), {
      wrapper: createWrapper(queryClient),
    });

    // Verify lot:join was emitted
    await waitFor(() => {
      expect(joinedLots).toContain('lot-42');
    });

    // Unmount hook to trigger cleanup
    act(() => {
      unmount();
    });

    // Verify lot:leave was emitted
    await waitFor(() => {
      expect(leftLots).toContain('lot-42');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Merging slot:updated into React Query Cache (C9)
  // --------------------------------------------------------------------------
  it('merges slot:updated event into React Query cache and notifies onEvent', async () => {
    const clientSocket = createSocket(serverUrl);
    setSocketInstanceForTesting(clientSocket);

    const queryClient = new QueryClient();
    const initialSlots: SlotView[] = [
      { id: 'slot-1', slotNumber: 'A1', status: 'AVAILABLE' },
      { id: 'slot-2', slotNumber: 'A2', status: 'AVAILABLE' },
    ];

    queryClient.setQueryData(['parking-slots', 'lot-pune-1'], initialSlots);

    const receivedEvents: LotSocketEvent[] = [];
    renderHook(
      () =>
        useLotSocket('lot-pune-1', (event) => {
          receivedEvents.push(event);
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(clientSocket.connected).toBe(true);
    });

    // Simulate backend socket server emitting slot:updated
    act(() => {
      ioServer.emit('slot:updated', {
        slotId: 'slot-1',
        parkingLotId: 'lot-pune-1',
        status: 'OCCUPIED',
      });
    });

    // Verify React Query cache was merged with new slot status
    await waitFor(() => {
      const cached = queryClient.getQueryData<SlotView[]>(['parking-slots', 'lot-pune-1']);
      expect(cached?.[0].status).toBe('OCCUPIED');
      expect(cached?.[1].status).toBe('AVAILABLE');
    });

    // Verify callback was triggered
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]).toEqual({
      type: 'slot:updated',
      data: {
        slotId: 'slot-1',
        parkingLotId: 'lot-pune-1',
        status: 'OCCUPIED',
      },
    });
  });

  // --------------------------------------------------------------------------
  // 4. Updating Map Pins on lot:updated in React Query Cache (C9)
  // --------------------------------------------------------------------------
  it('updates map pins in React Query cache on lot:updated event', async () => {
    const clientSocket = createSocket(serverUrl);
    setSocketInstanceForTesting(clientSocket);

    const queryClient = new QueryClient();
    const initialLots: ParkingLot[] = [
      {
        id: 'lot-1',
        name: 'FC Road',
        address: 'Pune',
        latitude: 18.52,
        longitude: 73.84,
        totalSlots: 20,
        freeCount: 15,
        pricePerHourPaise: 4000,
      },
      {
        id: 'lot-2',
        name: 'JM Road',
        address: 'Pune',
        latitude: 18.53,
        longitude: 73.85,
        totalSlots: 30,
        freeCount: 20,
        pricePerHourPaise: 5000,
      },
    ];

    queryClient.setQueryData(['parking-lots'], initialLots);
    queryClient.setQueryData(['parking-lot', 'lot-1'], initialLots[0]);

    const receivedEvents: LotSocketEvent[] = [];
    renderHook(
      () =>
        useLotSocket('lot-1', (event) => {
          receivedEvents.push(event);
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(clientSocket.connected).toBe(true);
    });

    // Server emits lot:updated
    act(() => {
      ioServer.emit('lot:updated', {
        parkingLotId: 'lot-1',
        freeCount: 3,
        totalSlots: 20,
      });
    });

    // Verify list cache updated
    await waitFor(() => {
      const lotsCache = queryClient.getQueryData<ParkingLot[]>(['parking-lots']);
      expect(lotsCache?.[0].freeCount).toBe(3);
      expect(lotsCache?.[1].freeCount).toBe(20);
    });

    // Verify single lot cache updated
    const singleLotCache = queryClient.getQueryData<ParkingLot>(['parking-lot', 'lot-1']);
    expect(singleLotCache?.freeCount).toBe(3);

    // Verify callback
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('lot:updated');
  });

  // --------------------------------------------------------------------------
  // 5. Reconnection & Token-Refresh Handling (Security Rule 7)
  // --------------------------------------------------------------------------
  it('triggers token refresh and reconnects with refreshed token upon auth failure', async () => {
    let authAttempts = 0;

    // Server rejects first attempt with unauthorized error, accepts second with refreshed token
    ioServer.use((socket, next) => {
      authAttempts++;
      const token = socket.handshake.auth?.token;
      if (token === 'expired_token') {
        return next(new Error('unauthorized'));
      }
      next();
    });

    tokenManager.setAccessToken('expired_token');

    // Spy on single-flight refreshAccessToken
    const refreshSpy = vi
      .spyOn(apiModule, 'refreshAccessToken')
      .mockImplementation(async () => {
        tokenManager.setAccessToken('refreshed_jwt_token_999');
        return 'refreshed_jwt_token_999';
      });

    const clientSocket = createSocket(serverUrl);
    setSocketInstanceForTesting(clientSocket);

    clientSocket.connect();

    // Verify client refreshed token and reconnected successfully
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
      expect(clientSocket.connected).toBe(true);
      expect(authAttempts).toBeGreaterThanOrEqual(2);
    });

    expect(tokenManager.getAccessToken()).toBe('refreshed_jwt_token_999');
  });
});
