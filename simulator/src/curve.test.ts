// ==============================================================================
// curve.test.ts - Unit tests for Simulator Curve and PRNG Determinism
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  SeededRNG,
  getBaseOccupancyProbability,
  getIndiaHourOfDay,
  simulateSlotStatus,
} from './curve.js';

describe('Simulator Curve - Deterministic Seeded PRNG', () => {
  it('generates the exact same sequence of random numbers for the same seed', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    const sequence1 = Array.from({ length: 10 }, () => rng1.next());
    const sequence2 = Array.from({ length: 10 }, () => rng2.next());

    expect(sequence1).toEqual(sequence2);
  });

  it('generates different sequences for different seeds', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);

    const val1 = rng1.next();
    const val2 = rng2.next();

    expect(val1).not.toBe(val2);
  });

  it('produces numbers strictly in range [0, 1)', () => {
    const rng = new SeededRNG(999);
    for (let i = 0; i < 50; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe('Simulator Curve - India Time of Day Probabilities', () => {
  it('identifies morning peak (9-11 AM IST) with high occupancy probability (0.85)', () => {
    expect(getBaseOccupancyProbability(9)).toBe(0.85);
    expect(getBaseOccupancyProbability(10)).toBe(0.85);
    expect(getBaseOccupancyProbability(11)).toBe(0.85);
  });

  it('identifies moderate afternoon (12-4 PM IST) with moderate probability (0.55)', () => {
    expect(getBaseOccupancyProbability(12)).toBe(0.55);
    expect(getBaseOccupancyProbability(14)).toBe(0.55);
    expect(getBaseOccupancyProbability(16)).toBe(0.55);
  });

  it('identifies evening peak (5-8 PM IST) with highest occupancy probability (0.90)', () => {
    expect(getBaseOccupancyProbability(17)).toBe(0.9);
    expect(getBaseOccupancyProbability(18)).toBe(0.9);
    expect(getBaseOccupancyProbability(20)).toBe(0.9);
  });

  it('identifies quiet late night and early morning (9 PM - 8 AM IST) with low probability (0.20)', () => {
    expect(getBaseOccupancyProbability(21)).toBe(0.2);
    expect(getBaseOccupancyProbability(23)).toBe(0.2);
    expect(getBaseOccupancyProbability(2)).toBe(0.2);
    expect(getBaseOccupancyProbability(7)).toBe(0.2);
  });

  it('correctly converts UTC date to India hour (UTC+5:30)', () => {
    // 03:30 UTC = 09:00 AM IST
    const morningUtc = new Date('2026-10-05T03:30:00.000Z');
    expect(getIndiaHourOfDay(morningUtc)).toBe(9);

    // 12:30 UTC = 18:00 (6:00 PM) IST
    const eveningUtc = new Date('2026-10-05T12:30:00.000Z');
    expect(getIndiaHourOfDay(eveningUtc)).toBe(18);
  });

  it('only ever simulates AVAILABLE or OCCUPIED (Security Rule 8)', () => {
    const rng = new SeededRNG(42);
    const date = new Date();

    for (let i = 0; i < 50; i++) {
      const status = simulateSlotStatus(date, rng);
      expect(['AVAILABLE', 'OCCUPIED']).toContain(status);
    }
  });
});
