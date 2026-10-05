import { z } from 'zod';
import {
  ErrorCodeSchema,
  FailureEnvelopeSchema,
  UserViewSchema,
  ParkingLotSchema,
  LotWithCountSchema,
  SlotViewSchema,
  BookingViewSchema,
  DeviceViewSchema,
  AuditLogViewSchema,
  OccupancyHourStatSchema,
  OccupancyStatsSchema,
  GuardBoardBookingSchema,
  GuardBoardSlotSchema,
  GuardBoardSchema,
  RegisterRequestSchema,
  RegisterResponseDataSchema,
  LoginRequestSchema,
  LoginResponseDataSchema,
  RefreshResponseDataSchema,
  LogoutResponseDataSchema,
  MeResponseDataSchema,
  GetLotsResponseDataSchema,
  GetLotResponseDataSchema,
  GetSlotsQuerySchema,
  GetSlotsResponseDataSchema,
  GetStatsResponseDataSchema,
  CreateBookingRequestSchema,
  CreateBookingHeadersSchema,
  CreateBookingResponseDataSchema,
  GetMyBookingsResponseDataSchema,
  CancelBookingResponseDataSchema,
  CreatePaymentOrderRequestSchema,
  CreatePaymentOrderResponseDataSchema,
  VerifyPaymentRequestSchema,
  VerifyPaymentResponseDataSchema,
  RefundPaymentRequestSchema,
  RefundPaymentResponseDataSchema,
  DemoConfirmPaymentRequestSchema,
  DemoConfirmPaymentResponseDataSchema,
  SensorEventHeadersSchema,
  SensorEventRequestSchema,
  SensorEventResponseDataSchema,
  CreateLotRequestSchema,
  UpdateLotRequestSchema,
  DeleteLotResponseDataSchema,
  GenerateSlotsRequestSchema,
  GenerateSlotsResponseDataSchema,
  ReleaseSlotResponseDataSchema,
  AdminBookingsQuerySchema,
  UpdateUserRoleRequestSchema,
  CreateDeviceRequestSchema,
  CreateDeviceResponseDataSchema,
  DeleteDeviceResponseDataSchema,
  AdminAuditLogResponseDataSchema,
  GuardBoardResponseDataSchema,
  GuardCheckInRequestSchema,
  GuardCheckInResponseDataSchema,
  GuardWalkInRequestSchema,
  GuardWalkInResponseDataSchema,
  HealthResponseDataSchema,
  ReadyResponseDataSchema,
} from './schemas.js';

// ==============================================================================
// Envelope Types
// ==============================================================================

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export type FailureEnvelope = z.infer<typeof FailureEnvelopeSchema>;
export type ErrorCodeType = z.infer<typeof ErrorCodeSchema>;

// ==============================================================================
// Entity View Types (C9 exports & core views)
// ==============================================================================

export type UserView = z.infer<typeof UserViewSchema>;
export type ParkingLotView = z.infer<typeof ParkingLotSchema>;
export type LotWithCount = z.infer<typeof LotWithCountSchema>;
export type SlotView = z.infer<typeof SlotViewSchema>;
export type BookingView = z.infer<typeof BookingViewSchema>;
export type DeviceView = z.infer<typeof DeviceViewSchema>;
export type AuditLogView = z.infer<typeof AuditLogViewSchema>;
export type OccupancyHourStat = z.infer<typeof OccupancyHourStatSchema>;
export type OccupancyStats = z.infer<typeof OccupancyStatsSchema>;
export type GuardBoardBooking = z.infer<typeof GuardBoardBookingSchema>;
export type GuardBoardSlot = z.infer<typeof GuardBoardSlotSchema>;
export type GuardBoard = z.infer<typeof GuardBoardSchema>;

// ==============================================================================
// Request & Response Types (C7)
// ==============================================================================

// Auth
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponseData = z.infer<typeof RegisterResponseDataSchema>;

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponseData = z.infer<typeof LoginResponseDataSchema>;

export type RefreshResponseData = z.infer<typeof RefreshResponseDataSchema>;
export type LogoutResponseData = z.infer<typeof LogoutResponseDataSchema>;
export type MeResponseData = z.infer<typeof MeResponseDataSchema>;

// Parking Lots
export type GetLotsResponseData = z.infer<typeof GetLotsResponseDataSchema>;
export type GetLotResponseData = z.infer<typeof GetLotResponseDataSchema>;
export type GetSlotsQuery = z.infer<typeof GetSlotsQuerySchema>;
export type GetSlotsResponseData = z.infer<typeof GetSlotsResponseDataSchema>;
export type GetStatsResponseData = z.infer<typeof GetStatsResponseDataSchema>;

// Bookings
export type CreateBookingHeaders = z.infer<typeof CreateBookingHeadersSchema>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type CreateBookingResponseData = z.infer<typeof CreateBookingResponseDataSchema>;
export type GetMyBookingsResponseData = z.infer<typeof GetMyBookingsResponseDataSchema>;
export type CancelBookingResponseData = z.infer<typeof CancelBookingResponseDataSchema>;

// Payments
export type CreatePaymentOrderRequest = z.infer<typeof CreatePaymentOrderRequestSchema>;
export type CreatePaymentOrderResponseData = z.infer<typeof CreatePaymentOrderResponseDataSchema>;

export type VerifyPaymentRequest = z.infer<typeof VerifyPaymentRequestSchema>;
export type VerifyPaymentResponseData = z.infer<typeof VerifyPaymentResponseDataSchema>;

export type RefundPaymentRequest = z.infer<typeof RefundPaymentRequestSchema>;
export type RefundPaymentResponseData = z.infer<typeof RefundPaymentResponseDataSchema>;

export type DemoConfirmPaymentRequest = z.infer<typeof DemoConfirmPaymentRequestSchema>;
export type DemoConfirmPaymentResponseData = z.infer<typeof DemoConfirmPaymentResponseDataSchema>;

// Sensors
export type SensorEventHeaders = z.infer<typeof SensorEventHeadersSchema>;
export type SensorEventRequest = z.infer<typeof SensorEventRequestSchema>;
export type SensorEventResponseData = z.infer<typeof SensorEventResponseDataSchema>;

// Admin
export type CreateLotRequest = z.infer<typeof CreateLotRequestSchema>;
export type UpdateLotRequest = z.infer<typeof UpdateLotRequestSchema>;
export type DeleteLotResponseData = z.infer<typeof DeleteLotResponseDataSchema>;

export type GenerateSlotsRequest = z.infer<typeof GenerateSlotsRequestSchema>;
export type GenerateSlotsResponseData = z.infer<typeof GenerateSlotsResponseDataSchema>;

export type ReleaseSlotResponseData = z.infer<typeof ReleaseSlotResponseDataSchema>;
export type AdminBookingsQuery = z.infer<typeof AdminBookingsQuerySchema>;

export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleRequestSchema>;
export type CreateDeviceRequest = z.infer<typeof CreateDeviceRequestSchema>;
export type CreateDeviceResponseData = z.infer<typeof CreateDeviceResponseDataSchema>;
export type DeleteDeviceResponseData = z.infer<typeof DeleteDeviceResponseDataSchema>;
export type AdminAuditLogResponseData = z.infer<typeof AdminAuditLogResponseDataSchema>;

// Guard
export type GuardBoardResponseData = z.infer<typeof GuardBoardResponseDataSchema>;
export type GuardCheckInRequest = z.infer<typeof GuardCheckInRequestSchema>;
export type GuardCheckInResponseData = z.infer<typeof GuardCheckInResponseDataSchema>;
export type GuardWalkInRequest = z.infer<typeof GuardWalkInRequestSchema>;
export type GuardWalkInResponseData = z.infer<typeof GuardWalkInResponseDataSchema>;

// Health
export type HealthResponseData = z.infer<typeof HealthResponseDataSchema>;
export type ReadyResponseData = z.infer<typeof ReadyResponseDataSchema>;
