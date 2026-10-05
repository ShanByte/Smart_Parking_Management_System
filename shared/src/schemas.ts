import { z } from 'zod';
import {
  SlotStatus,
  BookingStatus,
  Role,
  PaymentStatus,
  SlotSource,
  ErrorCode,
} from './enums.js';

// ==============================================================================
// Envelopes per C4 HTTP Specification
// ==============================================================================

export const ErrorCodeSchema = z.nativeEnum(ErrorCode);
export const PaymentStatusSchema = z.nativeEnum(PaymentStatus);

export const FailureEnvelopeSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: ErrorCodeSchema,
  requestId: z.string().optional(),
}).strict();

export function createSuccessEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  }).strict();
}

// ==============================================================================
// Core Entity View Schemas
// ==============================================================================

export const UserViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  assignedLotId: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
}).strict();

export const ParkingLotSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  totalSlots: z.number().int().nonnegative(),
  pricePerHourPaise: z.number().int().nonnegative(),
  isActive: z.boolean(),
}).strict();

export const LotWithCountSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  totalSlots: z.number().int().nonnegative(),
  freeCount: z.number().int().nonnegative(),
  pricePerHourPaise: z.number().int().nonnegative(),
}).strict();

export const SlotViewSchema = z.object({
  id: z.string(),
  slotNumber: z.string(),
  status: z.nativeEnum(SlotStatus),
}).strict();

export const BookingViewSchema = z.object({
  id: z.string(),
  slotId: z.string(),
  status: z.nativeEnum(BookingStatus),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  amountPaise: z.number().int().nonnegative(),
  heldUntil: z.string().datetime().nullable(),
  bookingCode: z.string(),
  vehicleNumber: z.string().nullable(),
  checkedInAt: z.string().datetime().nullable(),
}).strict();

export const DeviceViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.nativeEnum(SlotSource),
  parkingLotId: z.string().nullable(),
  isActive: z.boolean(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
}).strict();

export const AuditLogViewSchema = z.object({
  id: z.string(),
  adminId: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  details: z.record(z.unknown()),
  createdAt: z.string().datetime(),
}).strict();

export const OccupancyHourStatSchema = z.object({
  hourOfDay: z.number().int().min(0).max(23),
  averageOccupiedPercent: z.number().min(0).max(100),
  samples: z.number().int().nonnegative(),
}).strict();

export const OccupancyStatsSchema = z.object({
  parkingLotId: z.string(),
  totalSlots: z.number().int().nonnegative(),
  hours: z.array(OccupancyHourStatSchema),
}).strict();

export const GuardBoardBookingSchema = z.object({
  bookingId: z.string(),
  bookingCode: z.string(),
  vehicleNumber: z.string().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z.nativeEnum(BookingStatus),
  checkedInAt: z.string().datetime().nullable(),
}).strict();

export const GuardBoardSlotSchema = z.object({
  slotId: z.string(),
  slotNumber: z.string(),
  status: z.nativeEnum(SlotStatus),
  source: z.nativeEnum(SlotSource),
  booking: GuardBoardBookingSchema.nullable(),
}).strict();

export const GuardBoardSchema = z.object({
  lot: z.object({
    id: z.string(),
    name: z.string(),
    totalSlots: z.number().int().nonnegative(),
  }).strict(),
  slots: z.array(GuardBoardSlotSchema),
}).strict();

// ==============================================================================
// C7 API Request / Response Schemas
// ==============================================================================

// Auth
export const RegisterRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(10, 'Password must be at least 10 characters'),
}).strict();

export const RegisterResponseDataSchema = z.object({
  user: UserViewSchema,
}).strict();

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
}).strict();

export const LoginResponseDataSchema = z.object({
  accessToken: z.string(),
  expiresInSeconds: z.number().int().positive(),
  user: UserViewSchema,
}).strict();

export const RefreshResponseDataSchema = z.object({
  accessToken: z.string(),
  expiresInSeconds: z.number().int().positive(),
  user: UserViewSchema.optional(),
}).strict();

export const LogoutResponseDataSchema = z.object({
  status: z.literal('ok'),
}).strict();

export const MeResponseDataSchema = z.object({
  user: UserViewSchema,
}).strict();

// Parking Lots
export const GetLotsResponseDataSchema = z.array(LotWithCountSchema);
export const GetLotResponseDataSchema = LotWithCountSchema;

export const GetSlotsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();

export const GetSlotsResponseDataSchema = z.array(SlotViewSchema);
export const GetStatsResponseDataSchema = OccupancyStatsSchema;

// Bookings
export const CreateBookingHeadersSchema = z.object({
  'idempotency-key': z.string().min(8).max(64),
}).passthrough();

export const CreateBookingRequestSchema = z
  .object({
    slotId: z.string().min(1, 'slotId is required'),
    startTime: z.string().datetime('startTime must be UTC ISO-8601 string'),
    endTime: z.string().datetime('endTime must be UTC ISO-8601 string'),
    vehicleNumber: z
      .string()
      .regex(/^[A-Z0-9]{4,15}$/, 'vehicleNumber must be 4-15 uppercase alphanumeric characters')
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      const start = new Date(data.startTime).getTime();
      const end = new Date(data.endTime).getTime();
      const durationMs = end - start;
      const minDurationMs = 15 * 60 * 1000;
      const maxDurationMs = 24 * 60 * 60 * 1000;
      return durationMs >= minDurationMs && durationMs <= maxDurationMs;
    },
    {
      message: 'Booking duration must be between 15 minutes and 24 hours',
      path: ['endTime'],
    }
  );

export const CreateBookingResponseDataSchema = BookingViewSchema;
export const GetMyBookingsResponseDataSchema = z.array(BookingViewSchema);
export const CancelBookingResponseDataSchema = BookingViewSchema;

// Payments
export const CreatePaymentOrderRequestSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
}).strict();

export const CreatePaymentOrderResponseDataSchema = z.object({
  orderId: z.string(),
  amountPaise: z.number().int().positive(),
  currency: z.literal('INR'),
  keyId: z.string(),
}).strict();

export const VerifyPaymentRequestSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
}).strict();

export const VerifyPaymentResponseDataSchema = BookingViewSchema;

export const RefundPaymentRequestSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
}).strict();

export const RefundPaymentResponseDataSchema = z.object({
  status: z.literal('REFUNDED'),
  bookingId: z.string(),
  amountPaise: z.number().int().positive(),
}).strict();

export const DemoConfirmPaymentRequestSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
}).strict();

export const DemoConfirmPaymentResponseDataSchema = BookingViewSchema;

// Sensors
export const SensorEventHeadersSchema = z.object({
  'x-device-key': z.string().min(1, 'x-device-key is required'),
}).passthrough();

export const SensorEventRequestSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  status: z.enum(['AVAILABLE', 'OCCUPIED']),
  timestamp: z.string().datetime('timestamp must be UTC ISO-8601 string'),
}).strict();

export const SensorEventResponseDataSchema = z.object({
  applied: z.boolean(),
}).strict();

// Admin
export const CreateLotRequestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  address: z.string().min(1, 'address is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  totalSlots: z.number().int().positive('totalSlots must be positive'),
  pricePerHourPaise: z.number().int().positive('pricePerHourPaise must be positive'),
}).strict();

export const UpdateLotRequestSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  totalSlots: z.number().int().positive().optional(),
  pricePerHourPaise: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const DeleteLotResponseDataSchema = z.object({
  deactivated: z.boolean(),
  lotId: z.string(),
}).strict();

export const GenerateSlotsRequestSchema = z.object({
  count: z.number().int().positive().max(500),
}).strict();

export const GenerateSlotsResponseDataSchema = z.object({
  count: z.number().int(),
  slots: z.array(SlotViewSchema),
}).strict();

export const ReleaseSlotResponseDataSchema = z.object({
  released: z.boolean(),
  slotId: z.string(),
}).strict();

export const AdminBookingsQuerySchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
}).strict();

export const UpdateUserRoleRequestSchema = z.object({
  role: z.nativeEnum(Role),
  assignedLotId: z.string().nullable().optional(),
}).strict().refine(
  (data) => {
    if (data.role === Role.GUARD) {
      return typeof data.assignedLotId === 'string' && data.assignedLotId.trim().length > 0;
    }
    return true;
  },
  {
    message: 'assignedLotId is required when role is GUARD',
    path: ['assignedLotId'],
  }
);

export const CreateDeviceRequestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  kind: z.nativeEnum(SlotSource).refine(
    (k) => k === SlotSource.SIM || k === SlotSource.SENSOR,
    { message: 'kind must be SIM or SENSOR' }
  ),
  parkingLotId: z.string().nullable().optional(),
}).strict();

export const CreateDeviceResponseDataSchema = z.object({
  device: DeviceViewSchema,
  rawKey: z.string(),
}).strict();

export const DeleteDeviceResponseDataSchema = z.object({
  revoked: z.boolean(),
  deviceId: z.string(),
}).strict();

export const AdminAuditLogResponseDataSchema = z.array(AuditLogViewSchema);

// Guard
export const GuardBoardResponseDataSchema = GuardBoardSchema;

export const GuardCheckInRequestSchema = z.object({
  bookingCode: z.string().regex(
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
    'bookingCode must be 6 characters from the C3 alphabet'
  ),
}).strict();

export const GuardCheckInResponseDataSchema = BookingViewSchema;

export const GuardWalkInRequestSchema = z.object({
  status: z.enum(['OCCUPIED', 'AVAILABLE']),
}).strict();

export const GuardWalkInResponseDataSchema = z.object({
  slotId: z.string(),
  status: z.nativeEnum(SlotStatus),
  source: z.literal(SlotSource.GUARD),
}).strict();

// Health
export const HealthResponseDataSchema = z.object({
  status: z.literal('ok'),
}).strict();

export const ReadyResponseDataSchema = z.object({
  db: z.literal('ok'),
  redis: z.literal('ok'),
}).strict();
