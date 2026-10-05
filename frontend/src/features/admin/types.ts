import { Booking, User, SlotSource } from '../../types/contract';

export type BookingView = Booking;
export type UserView = User;

export interface DeviceView {
  id: string;
  name: string;
  kind: SlotSource;
  parkingLotId: string | null;
  isActive: boolean;
  revokedAt: string | null;
  createdAt: string;
}

export interface AuditLogView {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
