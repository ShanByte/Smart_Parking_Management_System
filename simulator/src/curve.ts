// ==============================================================================
// curve.ts - Member 4: Time-of-day occupancy curve & deterministic seeded PRNG
// Pure functions: Busy 9-11 AM & 5-8 PM IST, moderate afternoon, quiet at night
// ==============================================================================

/**
 * Deterministic 32-bit pseudo-random number generator (Mulberry32).
 * Given the same seed, it produces the exact same sequence of pseudo-random numbers.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 1;
    }
  }

  /**
   * Generates next pseudo-random floating point number in range [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Extracts the India Standard Time (Asia/Kolkata, UTC+5:30) wall-clock hour (0-23)
 */
export function getIndiaHourOfDay(date: Date): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const indiaDate = new Date(date.getTime() + IST_OFFSET_MS);
  return indiaDate.getUTCHours();
}

/**
 * Pure function: Calculates occupancy probability (0.0 to 1.0) based on India time-of-day.
 * - Morning peak: 9:00 AM - 11:59 AM (0.85)
 * - Afternoon moderate: 12:00 PM - 4:59 PM (0.55)
 * - Evening peak: 5:00 PM - 8:59 PM (0.90)
 * - Night / early morning quiet: 9:00 PM - 8:59 AM (0.20)
 */
export function getBaseOccupancyProbability(hourOfDay: number): number {
  if (hourOfDay >= 9 && hourOfDay <= 11) {
    // Morning Rush (9-11 AM)
    return 0.85;
  }
  if (hourOfDay >= 12 && hourOfDay <= 16) {
    // Moderate Afternoon (12-4 PM)
    return 0.55;
  }
  if (hourOfDay >= 17 && hourOfDay <= 20) {
    // Evening Rush (5-8 PM)
    return 0.9;
  }
  // Quiet late evening, night, and early morning (9 PM - 8 AM)
  return 0.2;
}

/**
 * Simulates whether a slot should be OCCUPIED or AVAILABLE based on current probability.
 * Only ever returns 'AVAILABLE' or 'OCCUPIED' (Security Rule 8).
 */
export function simulateSlotStatus(date: Date, rng: SeededRNG): 'AVAILABLE' | 'OCCUPIED' {
  const hour = getIndiaHourOfDay(date);
  const probability = getBaseOccupancyProbability(hour);
  return rng.next() < probability ? 'OCCUPIED' : 'AVAILABLE';
}
