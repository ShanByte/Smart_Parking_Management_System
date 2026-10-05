/**
 * FROZEN CONTRACT C2 Enums
 * Source of truth for shared enum constants across all services and layers.
 */

export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  RESERVED = 'RESERVED',
  OCCUPIED = 'OCCUPIED',
}

export enum BookingStatus {
  HELD = 'HELD',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  GUARD = 'GUARD',
}

export enum PaymentStatus {
  CREATED = 'CREATED',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum SlotSource {
  SIM = 'SIM',
  SENSOR = 'SENSOR',
  APP = 'APP',
  GUARD = 'GUARD',
}

/**
 * Standard Error Codes per C4 HTTP Specification
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  SLOT_UNAVAILABLE = 'SLOT_UNAVAILABLE',
  BOOKING_NOT_ELIGIBLE = 'BOOKING_NOT_ELIGIBLE',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_READY = 'NOT_READY',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
