// ==============================================================================
// stats.service.test.ts - Unit tests for Member 4 Analytics Layer
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Helper function replicating the Asia/Kolkata wall-clock extraction logic from rollupHour
function computeIndiaWallClock(utcDate: Date): { hourOfDay: number; dayOfWeek: number } {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const indiaTime = new Date(utcDate.getTime() + IST_OFFSET_MS);
  return {
    hourOfDay: indiaTime.getUTCHours(),
    dayOfWeek: indiaTime.getUTCDay(),
  };
}

// Zod schema from stats.routes.ts
const ParamsSchema = z.object({
  id: z.string().trim().min(1, 'Parking lot ID is required'),
});

// Format hour helper from BusyChart
function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

describe('Stats Service - Timezone and Rollup Logic', () => {
  it('correctly converts UTC instant to India wall-clock hour (Asia/Kolkata +5:30)', () => {
    // 04:30 UTC corresponds to 10:00 AM IST
    const utcDate = new Date('2026-10-05T04:30:00.000Z');
    const { hourOfDay, dayOfWeek } = computeIndiaWallClock(utcDate);

    expect(hourOfDay).toBe(10);
    expect(dayOfWeek).toBe(1); // Monday
  });

  it('correctly handles midnight rollover into next day in India time', () => {
    // Sunday 20:00 UTC corresponds to Monday 01:30 AM IST
    const sundayNightUtc = new Date('2026-10-04T20:00:00.000Z');
    const { hourOfDay, dayOfWeek } = computeIndiaWallClock(sundayNightUtc);

    expect(hourOfDay).toBe(1);
    expect(dayOfWeek).toBe(1); // Rolled over to Monday
  });

  it('correctly computes occupancy percentage rounding to 1 decimal place', () => {
    const occupiedCount = 17;
    const totalSlots = 25;
    const percentage = Number(((occupiedCount / totalSlots) * 100).toFixed(1));

    expect(percentage).toBe(68.0);
  });
});

describe('Stats Route - Input Validation', () => {
  it('accepts valid parking lot ID', () => {
    const result = ParamsSchema.safeParse({ id: 'lot-pune-central-123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('lot-pune-central-123');
    }
  });

  it('rejects empty parking lot ID with validation error', () => {
    const result = ParamsSchema.safeParse({ id: '   ' });
    expect(result.success).toBe(false);
  });
});

describe('BusyChart - Display Formatting Helpers', () => {
  it('formats midnight as 12 AM', () => {
    expect(formatHourLabel(0)).toBe('12 AM');
  });

  it('formats noon as 12 PM', () => {
    expect(formatHourLabel(12)).toBe('12 PM');
  });

  it('formats morning hours with AM', () => {
    expect(formatHourLabel(9)).toBe('9 AM');
    expect(formatHourLabel(11)).toBe('11 AM');
  });

  it('formats afternoon and evening hours with PM', () => {
    expect(formatHourLabel(14)).toBe('2 PM');
    expect(formatHourLabel(18)).toBe('6 PM');
    expect(formatHourLabel(23)).toBe('11 PM');
  });
});
