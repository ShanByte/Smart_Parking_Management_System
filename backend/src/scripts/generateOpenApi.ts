import fs from 'fs';
import path from 'path';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  RegisterRequestSchema,
  RegisterResponseDataSchema,
  LoginRequestSchema,
  LoginResponseDataSchema,
  RefreshResponseDataSchema,
  LogoutResponseDataSchema,
  MeResponseDataSchema,
  GetLotsResponseDataSchema,
  GetLotResponseDataSchema,
  GetSlotsResponseDataSchema,
  GetStatsResponseDataSchema,
  CreateBookingRequestSchema,
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
  SensorEventRequestSchema,
  SensorEventResponseDataSchema,
  CreateLotRequestSchema,
  UpdateLotRequestSchema,
  DeleteLotResponseDataSchema,
  GenerateSlotsRequestSchema,
  GenerateSlotsResponseDataSchema,
  ReleaseSlotResponseDataSchema,
  AdminAuditLogResponseDataSchema,
  GuardBoardResponseDataSchema,
  GuardCheckInRequestSchema,
  GuardCheckInResponseDataSchema,
  GuardWalkInRequestSchema,
  GuardWalkInResponseDataSchema,
  HealthResponseDataSchema,
  ReadyResponseDataSchema,
  createSuccessEnvelopeSchema,
} from '@smart-parking/shared';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// Health
registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Unversioned health check',
  responses: {
    200: {
      description: 'System healthy',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(HealthResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/ready',
  summary: 'Unversioned readiness check',
  responses: {
    200: {
      description: 'System ready',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(ReadyResponseDataSchema) } },
    },
    503: { description: 'System not ready' },
  },
});

// Auth
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register new user',
  request: { body: { content: { 'application/json': { schema: RegisterRequestSchema } } } },
  responses: {
    201: {
      description: 'User registered',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(RegisterResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Log in with credentials',
  request: { body: { content: { 'application/json': { schema: LoginRequestSchema } } } },
  responses: {
    200: {
      description: 'Login successful',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(LoginResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  summary: 'Refresh access token',
  responses: {
    200: {
      description: 'Token refreshed',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(RefreshResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'Revoke refresh token and log out',
  responses: {
    200: {
      description: 'Logged out',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(LogoutResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Get current user profile',
  responses: {
    200: {
      description: 'Current user profile',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(MeResponseDataSchema) } },
    },
  },
});

// Parking Lots
registry.registerPath({
  method: 'get',
  path: '/api/v1/parking-lots',
  summary: 'List all active parking lots with free slot count',
  responses: {
    200: {
      description: 'List of parking lots',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GetLotsResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/parking-lots/{id}',
  summary: 'Get parking lot details',
  responses: {
    200: {
      description: 'Parking lot details',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GetLotResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/parking-lots/{id}/slots',
  summary: 'Get slots for a lot within time window',
  responses: {
    200: {
      description: 'Slots list',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GetSlotsResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/parking-lots/{id}/stats',
  summary: 'Get historical occupancy hourly statistics',
  responses: {
    200: {
      description: 'Occupancy statistics',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GetStatsResponseDataSchema) } },
    },
  },
});

// Bookings
registry.registerPath({
  method: 'post',
  path: '/api/v1/bookings',
  summary: 'Create and hold a parking slot booking',
  request: { body: { content: { 'application/json': { schema: CreateBookingRequestSchema } } } },
  responses: {
    201: {
      description: 'Booking held',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(CreateBookingResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bookings/my',
  summary: 'Get bookings for current user',
  responses: {
    200: {
      description: 'User bookings',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GetMyBookingsResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/bookings/{id}',
  summary: 'Cancel active booking',
  responses: {
    200: {
      description: 'Booking cancelled',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(CancelBookingResponseDataSchema) } },
    },
  },
});

// Payments
registry.registerPath({
  method: 'post',
  path: '/api/v1/payments/create-order',
  summary: 'Create Razorpay order for booking',
  request: { body: { content: { 'application/json': { schema: CreatePaymentOrderRequestSchema } } } },
  responses: {
    200: {
      description: 'Order created',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(CreatePaymentOrderResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/payments/verify',
  summary: 'Verify Razorpay payment signature',
  request: { body: { content: { 'application/json': { schema: VerifyPaymentRequestSchema } } } },
  responses: {
    200: {
      description: 'Payment verified and booking confirmed',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(VerifyPaymentResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/payments/webhook',
  summary: 'Razorpay webhook intake',
  responses: {
    200: { description: 'Webhook acknowledged' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/payments/refund',
  summary: 'Refund payment (Admin only)',
  request: { body: { content: { 'application/json': { schema: RefundPaymentRequestSchema } } } },
  responses: {
    200: {
      description: 'Payment refunded',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(RefundPaymentResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/payments/demo-confirm',
  summary: 'Demo payment confirmation (dev only)',
  request: { body: { content: { 'application/json': { schema: DemoConfirmPaymentRequestSchema } } } },
  responses: {
    200: {
      description: 'Demo payment confirmed',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(DemoConfirmPaymentResponseDataSchema) } },
    },
  },
});

// Sensors
registry.registerPath({
  method: 'post',
  path: '/api/v1/sensors/events',
  summary: 'Ingest sensor status event',
  request: { body: { content: { 'application/json': { schema: SensorEventRequestSchema } } } },
  responses: {
    200: {
      description: 'Event processed',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(SensorEventResponseDataSchema) } },
    },
  },
});

// Admin
registry.registerPath({
  method: 'post',
  path: '/api/v1/admin/lots',
  summary: 'Create parking lot',
  request: { body: { content: { 'application/json': { schema: CreateLotRequestSchema } } } },
  responses: {
    201: { description: 'Parking lot created' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/admin/lots/{id}',
  summary: 'Update parking lot',
  request: { body: { content: { 'application/json': { schema: UpdateLotRequestSchema } } } },
  responses: {
    200: { description: 'Parking lot updated' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/admin/lots/{id}',
  summary: 'Deactivate parking lot',
  responses: {
    200: {
      description: 'Parking lot deactivated',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(DeleteLotResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/admin/lots/{id}/generate-slots',
  summary: 'Generate slots for lot',
  request: { body: { content: { 'application/json': { schema: GenerateSlotsRequestSchema } } } },
  responses: {
    201: {
      description: 'Slots generated',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GenerateSlotsResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/admin/slots/{id}/release',
  summary: 'Manually release slot',
  responses: {
    200: {
      description: 'Slot released',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(ReleaseSlotResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/admin/audit-log',
  summary: 'Fetch admin audit logs',
  responses: {
    200: {
      description: 'Audit logs',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(AdminAuditLogResponseDataSchema) } },
    },
  },
});

// Guard
registry.registerPath({
  method: 'get',
  path: '/api/v1/guard/lots/{lotId}/board',
  summary: 'Get live guard gate board for assigned lot',
  responses: {
    200: {
      description: 'Guard board data',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GuardBoardResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/guard/check-in',
  summary: 'Check in a booking by booking code',
  request: { body: { content: { 'application/json': { schema: GuardCheckInRequestSchema } } } },
  responses: {
    200: {
      description: 'Booking checked in',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GuardCheckInResponseDataSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/guard/slots/{slotId}/walk-in',
  summary: 'Toggle walk-in status on slot',
  request: { body: { content: { 'application/json': { schema: GuardWalkInRequestSchema } } } },
  responses: {
    200: {
      description: 'Walk-in status updated',
      content: { 'application/json': { schema: createSuccessEnvelopeSchema(GuardWalkInResponseDataSchema) } },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const openApiDoc = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Smart Parking Management System API',
    version: '1.0.0',
    description: 'REST API contract for Smart Parking Management System per Frozen Contract V1',
  },
  servers: [{ url: 'http://127.0.0.1:4000' }],
});

const outputPath = path.resolve(process.cwd(), '../shared/openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2), 'utf-8');
console.log(`[OpenAPI] Successfully generated OpenAPI specification at ${outputPath}`);
