import { Server as SocketIOServer } from 'socket.io';
import { SlotStatus } from '@smart-parking/shared';

/**
 * Socket.IO server & emitter utilities per FROZEN CONTRACT C8 & C9
 */

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function setIO(io: SocketIOServer | null): void {
  ioInstance = io;
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
