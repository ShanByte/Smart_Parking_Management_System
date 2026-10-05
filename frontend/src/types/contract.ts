/**
 * FROZEN CONTRACT v1 Enums & Types
 * Authoritative types matching backend and shared contracts exactly.
 */

// C2 ENUMS
export type SlotStatus = 'AVAILABLE' | 'HELD' | 'RESERVED' | 'OCCUPIED';
export type BookingStatus = 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED' | 'NO_SHOW';
export type Role = 'USER' | 'ADMIN' | 'GUARD';
export type PaymentStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
export type SlotSource = 'SIM' | 'SENSOR' | 'APP' | 'GUARD';

// C4 ERROR CODES
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SLOT_UNAVAILABLE'
  | 'BOOKING_NOT_ELIGIBLE'
  | 'RATE_LIMITED'
  | 'NOT_READY'
  | 'INTERNAL_ERROR';

// C7 DTOs & ENTITIES
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedLotId?: string | null;
  createdAt?: string;
}

export interface AuthResponseData {
  accessToken: string;
  expiresInSeconds: number;
  user: User;
}

export interface RefreshResponseData {
  accessToken: string;
  expiresInSeconds: number;
  user?: User;
}

export interface ParkingLot {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalSlots: number;
  freeCount: number;
  pricePerHourPaise: number;
}

export interface SlotView {
  id: string;
  slotNumber: string;
  status: SlotStatus;
}

export interface Booking {
  id: string;
  slotId: string;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  amountPaise: number;
  heldUntil: string | null;
  bookingCode: string;
  vehicleNumber: string | null;
  checkedInAt: string | null;
}

export interface CreateBookingRequest {
  slotId: string;
  startTime: string;
  endTime: string;
  vehicleNumber?: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentRequest {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface HourlyStat {
  hourOfDay: number;
  averageOccupiedPercent: number;
  samples: number;
}

export interface LotStats {
  parkingLotId: string;
  totalSlots: number;
  hours: HourlyStat[];
}

export interface GuardBoardSlot {
  slotId: string;
  slotNumber: string;
  status: SlotStatus;
  source: SlotSource;
  booking: {
    bookingId: string;
    bookingCode: string;
    vehicleNumber: string | null;
    startTime: string;
    endTime: string;
    status: BookingStatus;
    checkedInAt: string | null;
  } | null;
}

export interface GuardBoard {
  lot: {
    id: string;
    name: string;
    totalSlots: number;
  };
  slots: GuardBoardSlot[];
}

// C8 SOCKET EVENTS
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

// C4 HTTP RESPONSE ENVELOPES
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: ErrorCode;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
