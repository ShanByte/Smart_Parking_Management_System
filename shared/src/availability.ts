import { z } from 'zod';

export const MIN_SAMPLES = 3;
export const HISTORY_DAYS = 56;
export const CURRENT_INFLUENCE_MINUTES = 120;

export enum ArrivalBand {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  MODERATE = 'MODERATE',
  LOW = 'LOW',
  VERY_LOW = 'VERY_LOW',
  LIMITED_DATA = 'LIMITED_DATA',
}

export interface AvailabilityBandMeta {
  band: ArrivalBand;
  label: string;
  headline: string;
}

/**
 * Converts any UTC date to India Standard Time (Asia/Kolkata, UTC+5:30) hourOfDay (0-23)
 * and dayOfWeek (0=Sunday to 6=Saturday) without external date libraries.
 */
export function indiaTimeParts(date: Date): { hourOfDay: number; dayOfWeek: number } {
  // Asia/Kolkata is UTC+5:30 (+330 minutes) wall-clock time
  const istDate = new Date(date.getTime() + 330 * 60 * 1000);
  return {
    hourOfDay: istDate.getUTCHours(),
    dayOfWeek: istDate.getUTCDay(),
  };
}

/**
 * Maps an arrival score (0-100 or null) to the corresponding availability band
 * and accessible user-facing labels.
 */
export function availabilityBand(score: number | null): AvailabilityBandMeta {
  if (score === null || typeof score !== 'number') {
    return {
      band: ArrivalBand.LIMITED_DATA,
      label: 'Limited historical data',
      headline: 'Limited historical data',
    };
  }

  if (score >= 90) {
    return {
      band: ArrivalBand.EXCELLENT,
      label: 'Excellent availability likelihood',
      headline: 'Excellent chance of finding a space',
    };
  }
  if (score >= 75) {
    return {
      band: ArrivalBand.GOOD,
      label: 'Good availability likelihood',
      headline: 'Good chance of finding a space',
    };
  }
  if (score >= 50) {
    return {
      band: ArrivalBand.MODERATE,
      label: 'Moderate availability likelihood',
      headline: 'Moderate chance of finding a space',
    };
  }
  if (score >= 25) {
    return {
      band: ArrivalBand.LOW,
      label: 'Low availability likelihood',
      headline: 'Low chance of finding a space',
    };
  }
  return {
    band: ArrivalBand.VERY_LOW,
    label: 'Very low availability likelihood',
    headline: 'Very low chance of finding a space',
  };
}

/**
 * Blends historical expected availability with live current availability.
 * Pure deterministic function shared across backend and frontend.
 *
 * @param histArrival Historical availability percent at target arrival time (0-100 or null)
 * @param histNow Historical availability percent at current time (0-100 or null)
 * @param currentFreePercent Live free slots percent (0-100)
 * @param arrival Target arrival instant
 * @param now Current instant
 * @returns Blended arrival score clamped to 0-100, or null if insufficient historical data
 */
export function blendArrivalAvailability(
  histArrival: number | null,
  histNow: number | null,
  currentFreePercent: number,
  arrival: Date,
  now: Date
): number | null {
  if (histArrival === null) {
    return null;
  }

  const minutesAhead = Math.max(0, (arrival.getTime() - now.getTime()) / (60 * 1000));
  const decay = Math.max(0, 1 - minutesAhead / CURRENT_INFLUENCE_MINUTES);

  let score: number;
  if (histNow !== null) {
    score = Math.round(histArrival + (currentFreePercent - histNow) * decay);
  } else {
    score = Math.round(decay * currentFreePercent + (1 - decay) * histArrival);
  }

  return Math.min(100, Math.max(0, score));
}

// ============================================================================
// Schemas for GET /api/v1/availability/arrival
// ============================================================================

export const GetArrivalAvailabilityQuerySchema = z
  .object({
    arrivalTime: z.string().datetime({ message: 'arrivalTime must be a valid UTC ISO-8601 string' }),
  })
  .strict()
  .refine(
    (data) => {
      const t = new Date(data.arrivalTime).getTime();
      const now = Date.now();
      const minTime = now - 60 * 1000; // at most 1 minute in past
      const maxTime = now + 7 * 24 * 60 * 60 * 1000; // at most 7 days ahead
      return t >= minTime && t <= maxTime;
    },
    {
      message: 'arrivalTime must be between 1 minute in the past and 7 days ahead',
      path: ['arrivalTime'],
    }
  );

export const HistoricalAvailabilitySchema = z
  .object({
    status: z.enum(['OK', 'LIMITED_DATA']),
    basis: z.enum(['SAME_WEEKDAY_HOUR', 'ALL_DAYS_HOUR']).nullable(),
    samples: z.number().int().nonnegative(),
    expectedAvailablePercentAtArrival: z.number().nullable(),
    expectedAvailablePercentNow: z.number().nullable(),
  })
  .strict();

export const AvailabilityHourPatternItemSchema = z
  .object({
    hourOfDay: z.number().int().min(0).max(23),
    expectedAvailablePercent: z.number().min(0).max(100),
  })
  .strict();

export const LotAvailabilityItemSchema = z
  .object({
    parkingLotId: z.string(),
    totalSlots: z.number().int().positive(),
    historical: HistoricalAvailabilitySchema,
    pattern: z.array(AvailabilityHourPatternItemSchema),
  })
  .strict();

export const ArrivalAvailabilityResponseDataSchema = z
  .object({
    arrivalTime: z.string(),
    generatedAt: z.string(),
    lots: z.array(LotAvailabilityItemSchema),
  })
  .strict();

export type GetArrivalAvailabilityQuery = z.infer<typeof GetArrivalAvailabilityQuerySchema>;
export type HistoricalAvailability = z.infer<typeof HistoricalAvailabilitySchema>;
export type AvailabilityHourPatternItem = z.infer<typeof AvailabilityHourPatternItemSchema>;
export type LotAvailabilityItem = z.infer<typeof LotAvailabilityItemSchema>;
export type ArrivalAvailabilityResponseData = z.infer<typeof ArrivalAvailabilityResponseDataSchema>;
