import { describe, it, expect } from 'vitest';
import {
  ArrivalBand,
  availabilityBand,
  blendArrivalAvailability,
  indiaTimeParts,
  CURRENT_INFLUENCE_MINUTES,
  GetArrivalAvailabilityQuerySchema,
} from './availability.js';

describe('Arrival Availability Pure Functions (Shared)', () => {
  describe('indiaTimeParts()', () => {
    it('converts UTC to India time (UTC+5:30) correctly', () => {
      // 06:00 UTC = 11:30 IST
      const date = new Date('2026-10-06T06:00:00.000Z');
      const parts = indiaTimeParts(date);
      expect(parts.hourOfDay).toBe(11);
      expect(parts.dayOfWeek).toBe(2); // Tuesday
    });

    it('handles UTC midnight crossing into next day IST', () => {
      // Tuesday 20:00 UTC + 5:30 = Wednesday 01:30 IST
      const date = new Date('2026-10-06T20:00:00.000Z');
      const parts = indiaTimeParts(date);
      expect(parts.hourOfDay).toBe(1);
      expect(parts.dayOfWeek).toBe(3); // Wednesday
    });

    it('handles Sunday to Monday boundary crossing', () => {
      // Sunday 21:00 UTC + 5:30 = Monday 02:30 IST
      const date = new Date('2026-10-04T21:00:00.000Z'); // Sunday
      const parts = indiaTimeParts(date);
      expect(parts.hourOfDay).toBe(2);
      expect(parts.dayOfWeek).toBe(1); // Monday
    });
  });

  describe('availabilityBand()', () => {
    it('returns LIMITED_DATA for null or undefined', () => {
      const res = availabilityBand(null);
      expect(res.band).toBe(ArrivalBand.LIMITED_DATA);
      expect(res.headline).toBe('Limited historical data');
    });

    it('strictly checks exact boundaries', () => {
      expect(availabilityBand(0).band).toBe(ArrivalBand.VERY_LOW);
      expect(availabilityBand(24).band).toBe(ArrivalBand.VERY_LOW);
      expect(availabilityBand(25).band).toBe(ArrivalBand.LOW);
      expect(availabilityBand(49).band).toBe(ArrivalBand.LOW);
      expect(availabilityBand(50).band).toBe(ArrivalBand.MODERATE);
      expect(availabilityBand(74).band).toBe(ArrivalBand.MODERATE);
      expect(availabilityBand(75).band).toBe(ArrivalBand.GOOD);
      expect(availabilityBand(89).band).toBe(ArrivalBand.GOOD);
      expect(availabilityBand(90).band).toBe(ArrivalBand.EXCELLENT);
      expect(availabilityBand(100).band).toBe(ArrivalBand.EXCELLENT);
    });
  });

  describe('blendArrivalAvailability()', () => {
    const now = new Date('2026-10-06T12:00:00.000Z');

    it('returns null when histArrival is null', () => {
      const arrival = new Date(now.getTime() + 30 * 60 * 1000);
      const score = blendArrivalAvailability(null, 50, 60, arrival, now);
      expect(score).toBeNull();
    });

    it('equals current availability when arrival is now (decay = 1)', () => {
      const arrival = new Date(now.getTime());
      // When arrival = now, decay = 1:
      // score = histArrival + (currentFreePercent - histNow) * 1
      // If histArrival == histNow, score equals currentFreePercent exactly
      const score = blendArrivalAvailability(60, 60, 85, arrival, now);
      expect(score).toBe(85);
    });

    it('decays current influence to zero at 120+ minutes ahead', () => {
      // 120 minutes ahead -> decay = 0 -> score equals histArrival
      const arrivalAt120 = new Date(now.getTime() + CURRENT_INFLUENCE_MINUTES * 60 * 1000);
      const score120 = blendArrivalAvailability(70, 40, 90, arrivalAt120, now);
      expect(score120).toBe(70);

      // 180 minutes ahead -> decay = 0 -> score equals histArrival
      const arrivalAt180 = new Date(now.getTime() + 180 * 60 * 1000);
      const score180 = blendArrivalAvailability(70, 40, 90, arrivalAt180, now);
      expect(score180).toBe(70);
    });

    it('calculates intermediate blend at 60 minutes ahead (decay = 0.5)', () => {
      const arrival60 = new Date(now.getTime() + 60 * 60 * 1000);
      // histArrival = 60, histNow = 50, currentFreePercent = 70
      // decay = 1 - 60/120 = 0.5
      // score = 60 + (70 - 50) * 0.5 = 60 + 10 = 70
      const score = blendArrivalAvailability(60, 50, 70, arrival60, now);
      expect(score).toBe(70);
    });

    it('handles histNow null fallback path', () => {
      const arrival60 = new Date(now.getTime() + 60 * 60 * 1000);
      // decay = 0.5, histArrival = 80, currentFreePercent = 40
      // score = 0.5 * 40 + (1 - 0.5) * 80 = 20 + 40 = 60
      const score = blendArrivalAvailability(80, null, 40, arrival60, now);
      expect(score).toBe(60);
    });

    it('clamps output strictly between 0 and 100', () => {
      const arrivalNow = new Date(now.getTime());
      // Extreme positive overshoot: histArrival = 95, current = 90, histNow = 20 -> 95 + 70 = 165 -> 100
      expect(blendArrivalAvailability(95, 20, 90, arrivalNow, now)).toBe(100);

      // Extreme negative undershoot: histArrival = 10, current = 5, histNow = 90 -> 10 - 85 = -75 -> 0
      expect(blendArrivalAvailability(10, 90, 5, arrivalNow, now)).toBe(0);
    });
  });

  describe('GetArrivalAvailabilityQuerySchema', () => {
    it('accepts valid UTC ISO timestamp within 7 days', () => {
      const validTime = new Date(Date.now() + 3600 * 1000).toISOString();
      const parsed = GetArrivalAvailabilityQuerySchema.safeParse({ arrivalTime: validTime });
      expect(parsed.success).toBe(true);
    });

    it('rejects timestamp more than 1 minute in the past', () => {
      const pastTime = new Date(Date.now() - 120 * 1000).toISOString();
      const parsed = GetArrivalAvailabilityQuerySchema.safeParse({ arrivalTime: pastTime });
      expect(parsed.success).toBe(false);
    });

    it('rejects timestamp more than 7 days ahead', () => {
      const farTime = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();
      const parsed = GetArrivalAvailabilityQuerySchema.safeParse({ arrivalTime: farTime });
      expect(parsed.success).toBe(false);
    });
  });
});
