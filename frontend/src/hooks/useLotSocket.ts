import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, connectSocket, AppSocket } from '../services/socket';
import {
  SlotUpdatedEvent,
  LotUpdatedEvent,
  SlotView,
  ParkingLot,
  GuardBoard,
} from '../types/contract';

export type LotSocketEventType = 'slot:updated' | 'lot:updated';

export type LotSocketEvent =
  | { type: 'slot:updated'; data: SlotUpdatedEvent }
  | { type: 'lot:updated'; data: LotUpdatedEvent };

export type LotSocketEventHandler = (event: LotSocketEvent) => void;

/**
 * useLotSocket(lotId, onEvent)
 * Authoritative hook per C9 and Security Rule 7.
 * Connects to the lot's socket room, maintains realtime cache consistency
 * for slots and map pins, calls onEvent for consumers (e.g. Guard Console),
 * and handles reconnects/token refresh.
 */
export function useLotSocket(
  lotId?: string | null,
  onEvent?: LotSocketEventHandler
): {
  socket: AppSocket;
  isConnected: boolean;
} {
  const queryClient = useQueryClient();
  const socket = getSocket();
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // Connect socket if not connected
    connectSocket();

    const handleConnect = () => {
      setIsConnected(true);
      if (lotId) {
        socket.emit('lot:join', { lotId });
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // 1. Merge slot:updated into React Query cache (C9)
    const handleSlotUpdated = (payload: SlotUpdatedEvent) => {
      if (!lotId || payload.parkingLotId === lotId) {
        // Update slots query cache for this lot: ['parking-slots', lotId, ...]
        queryClient.setQueriesData<SlotView[]>(
          {
            predicate: (query) =>
              query.queryKey[0] === 'parking-slots' &&
              query.queryKey[1] === payload.parkingLotId,
          },
          (oldSlots) => {
            if (!oldSlots) return oldSlots;
            return oldSlots.map((slot) =>
              slot.id === payload.slotId ? { ...slot, status: payload.status } : slot
            );
          }
        );

        // Update guard board query cache for Member 1 Guard Console: ['guard-board', lotId]
        queryClient.setQueriesData<GuardBoard>(
          {
            predicate: (query) =>
              query.queryKey[0] === 'guard-board' &&
              query.queryKey[1] === payload.parkingLotId,
          },
          (oldBoard) => {
            if (!oldBoard) return oldBoard;
            return {
              ...oldBoard,
              slots: oldBoard.slots.map((s) =>
                s.slotId === payload.slotId
                  ? { ...s, status: payload.status }
                  : s
              ),
            };
          }
        );

        onEventRef.current?.({ type: 'slot:updated', data: payload });
      }
    };

    // 2. Update pins on lot:updated in React Query cache (C9)
    const handleLotUpdated = (payload: LotUpdatedEvent) => {
      // Update full parking lots array: ['parking-lots']
      queryClient.setQueriesData<ParkingLot[]>(
        { queryKey: ['parking-lots'] },
        (oldLots) => {
          if (!oldLots) return oldLots;
          return oldLots.map((lot) =>
            lot.id === payload.parkingLotId
              ? {
                  ...lot,
                  freeCount: payload.freeCount,
                  totalSlots: payload.totalSlots,
                }
              : lot
          );
        }
      );

      // Update individual parking lot cache: ['parking-lot', parkingLotId]
      queryClient.setQueriesData<ParkingLot>(
        { queryKey: ['parking-lot', payload.parkingLotId] },
        (oldLot) => {
          if (!oldLot) return oldLot;
          return {
            ...oldLot,
            freeCount: payload.freeCount,
            totalSlots: payload.totalSlots,
          };
        }
      );

      onEventRef.current?.({ type: 'lot:updated', data: payload });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('slot:updated', handleSlotUpdated);
    socket.on('lot:updated', handleLotUpdated);

    // If socket is already connected when effect runs, join room immediately
    if (socket.connected && lotId) {
      setIsConnected(true);
      socket.emit('lot:join', { lotId });
    }

    // Cleanup: leave lot room and remove event handlers
    return () => {
      if (lotId && socket.connected) {
        socket.emit('lot:leave', { lotId });
      }
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('slot:updated', handleSlotUpdated);
      socket.off('lot:updated', handleLotUpdated);
    };
  }, [lotId, socket, queryClient]);

  return { socket, isConnected };
}

export default useLotSocket;
