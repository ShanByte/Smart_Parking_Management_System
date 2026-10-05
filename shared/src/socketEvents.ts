import { SlotStatus } from './enums.js';

/**
 * Socket.IO event payloads per FROZEN CONTRACT C8 & C9
 */

export interface SlotUpdatedEvent {
  slotId: string;
  parkingLotId: string;
  status: SlotStatus;
}

export interface LotUpdatedEvent {
  parkingLotId: string;
  freeCount: number;
  totalSlots: number;
}

export interface LotJoinPayload {
  lotId: string;
}

export interface LotLeavePayload {
  lotId: string;
}

export interface ClientToServerEvents {
  'lot:join': (payload: LotJoinPayload) => void;
  'lot:leave': (payload: LotLeavePayload) => void;
}

export interface ServerToClientEvents {
  'slot:updated': (payload: SlotUpdatedEvent) => void;
  'lot:updated': (payload: LotUpdatedEvent) => void;
}
