import { io, Socket } from 'socket.io-client';
import {
  SlotUpdatedEvent,
  LotUpdatedEvent,
  LotJoinPayload,
  LotLeavePayload,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/contract';
import { tokenManager } from './tokenManager';
import { refreshAccessToken } from './api';
import { getEnv } from '../config/env';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: AppSocket | null = null;
let isRefreshing = false;

/**
 * Creates and configures a Socket.IO client instance (C8/C9/Security Rule 7).
 * Ensures access token is sent strictly in handshake auth, never in query string or URL.
 */
export function createSocket(customUrl?: string): AppSocket {
  let socketUrl = customUrl;
  if (!socketUrl) {
    try {
      socketUrl = getEnv().VITE_SOCKET_URL;
    } catch {
      socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
    }
  }

  const socket: AppSocket = io(socketUrl, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: (cb) => {
      // Security Rule 7: Pass JWT token strictly in handshake auth, never in URL or query params
      const token = tokenManager.getAccessToken();
      cb({ token });
    },
  });

  // Security Rule 7: Reconnect & single-flight token-refresh handling
  socket.on('connect_error', async (err: Error) => {
    const errMsg = err.message ? err.message.toLowerCase() : '';
    const isAuthError =
      errMsg.includes('unauthorized') ||
      errMsg.includes('jwt') ||
      errMsg.includes('token') ||
      errMsg.includes('auth') ||
      errMsg.includes('forbidden');

    if (isAuthError && !isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          // Update auth payload for next connection attempt and reconnect
          socket.auth = { token: newToken };
          socket.connect();
        } else {
          socket.disconnect();
        }
      } catch {
        socket.disconnect();
      } finally {
        isRefreshing = false;
      }
    }
  });

  return socket;
}

/**
 * Returns the singleton socket client instance.
 */
export function getSocket(): AppSocket {
  if (!socketInstance) {
    socketInstance = createSocket();
  }
  return socketInstance;
}

/**
 * Connects the socket client if not already connected.
 */
export function connectSocket(): AppSocket {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: tokenManager.getAccessToken() };
    s.connect();
  }
  return s;
}

/**
 * Disconnects the socket client.
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
  }
}

/**
 * Test helper to inject mock socket instance.
 */
export function setSocketInstanceForTesting(mockSocket: AppSocket | null): void {
  if (socketInstance && socketInstance !== mockSocket) {
    socketInstance.disconnect();
  }
  socketInstance = mockSocket;
}

// Re-export useLotSocket and types
export { useLotSocket } from '../hooks/useLotSocket';
export type {
  LotSocketEvent,
  LotSocketEventType,
  LotSocketEventHandler,
} from '../hooks/useLotSocket';

export type {
  SlotUpdatedEvent,
  LotUpdatedEvent,
  LotJoinPayload,
  LotLeavePayload,
  ClientToServerEvents,
  ServerToClientEvents,
};
