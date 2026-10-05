import { z } from 'zod';

/**
 * Shared Booking Zod Validation Schemas (C3, C4, C7 Frozen Contract)
 */

// Vehicle number: 4-15 uppercase alphanumeric characters (optional)
export const vehicleNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (val) => val === '' || /^[A-Z0-9]{4,15}$/.test(val),
    {
      message: 'Vehicle number must be 4-15 uppercase alphanumeric characters (e.g. MH12AB1234)',
    }
  );

// Time window duration: 15 minutes to 24 hours (C3 Rules)
export const timeWindowDurationSchema = z
  .number()
  .min(0.25, 'Minimum parking duration is 15 minutes')
  .max(24, 'Maximum parking duration is 24 hours');

// Idempotency-Key header: 8 to 64 characters (C4/C7)
export const idempotencyKeySchema = z
  .string()
  .min(8, 'Idempotency key must be at least 8 characters')
  .max(64, 'Idempotency key cannot exceed 64 characters');

// Full booking creation request schema (C7)
export const createBookingRequestSchema = z
  .object({
    slotId: z.string().min(1, 'Please select a slot'),
    startTime: z.string().datetime({ message: 'Start time must be a valid UTC ISO-8601 string' }),
    endTime: z.string().datetime({ message: 'End time must be a valid UTC ISO-8601 string' }),
    vehicleNumber: z
      .string()
      .regex(/^[A-Z0-9]{4,15}$/, 'Vehicle number must be 4-15 uppercase alphanumeric characters')
      .optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime).getTime();
      const end = new Date(data.endTime).getTime();
      const durationMs = end - start;
      const minDurationMs = 15 * 60 * 1000; // 15 mins
      const maxDurationMs = 24 * 60 * 60 * 1000; // 24 hours
      return durationMs >= minDurationMs && durationMs <= maxDurationMs;
    },
    {
      message: 'Booking duration must be between 15 minutes and 24 hours',
      path: ['endTime'],
    }
  );

export type CreateBookingInput = z.infer<typeof createBookingRequestSchema>;

/**
 * Helper to validate vehicle registration numbers
 */
export function validateVehicleNumber(val: string): { isValid: boolean; error?: string } {
  if (!val || val.trim() === '') {
    return { isValid: true };
  }
  const normalized = val.trim().toUpperCase();
  if (/^[A-Z0-9]{4,15}$/.test(normalized)) {
    return { isValid: true };
  }
  return {
    isValid: false,
    error: 'Vehicle number must be 4-15 uppercase alphanumeric characters (e.g. MH12AB1234)',
  };
}
