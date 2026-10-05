import { describe, it, expect } from 'vitest';
import {
  computeRecommendation,
  haversineDistanceKm,
  LotWithArrivalScore,
} from './recommendation';
import { ParkingLot } from '../types/contract';

describe('Arrival Recommendation Engine (computeRecommendation)', () => {
  const createMockLot = (
    id: string,
    name: string,
    totalSlots: number,
    freeCount: number,
    lat = 18.5204,
    lng = 73.8567
  ): ParkingLot => ({
    id,
    name,
    address: `${name} Address`,
    latitude: lat,
    longitude: lng,
    totalSlots,
    freeCount,
    pricePerHourPaise: 4000,
  });

  describe('haversineDistanceKm', () => {
    it('calculates distance between two points accurately', () => {
      // Pune to Mumbai is ~120-150 km
      const puneLat = 18.5204;
      const puneLng = 73.8567;
      const mumbaiLat = 18.922;
      const mumbaiLng = 72.8347;
      const dist = haversineDistanceKm(puneLat, puneLng, mumbaiLat, mumbaiLng);
      expect(dist).toBeGreaterThan(110);
      expect(dist).toBeLessThan(140);
    });

    it('returns 0 for identical coordinates', () => {
      expect(haversineDistanceKm(18.5, 73.8, 18.5, 73.8)).toBe(0);
    });
  });

  describe('Eligibility rules', () => {
    it('excludes lots with null score (LIMITED_DATA)', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Lot 1', 20, 10), score: null },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBeNull();
      expect(res.isAllLimited).toBe(true);
    });

    it('excludes lots with score < 50', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Lot 1', 20, 10), score: 48 },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBeNull();
      expect(res.noEligibleNote).toContain('Availability looks tight around 7:00 PM');
    });

    it('excludes lot with freeCount = 0 when arrival is Now', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Full Lot', 20, 0), score: 85 },
      ];
      const res = computeRecommendation(lots, true, 'Now');
      expect(res.recommendedLotId).toBeNull();
      expect(res.noEligibleNote).toBeDefined();
    });

    it('allows lot with freeCount = 0 when arrival is in future if score >= 50', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Currently Full Lot', 20, 0), score: 85 },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBe('lot-1');
      expect(res.recommendedReason).toContain('85% estimated availability');
    });

    it('NEVER recommends a lot purely because it has high current availability if score < 50', () => {
      const lots: LotWithArrivalScore[] = [
        // Lot 1 has 100% current availability (20/20 free) but low arrival score (30)
        { lot: createMockLot('lot-1', 'Empty Now', 20, 20), score: 30 },
        // Lot 2 has 40% current availability (8/20 free) and good arrival score (75)
        { lot: createMockLot('lot-2', 'Moderate Now', 20, 8), score: 75 },
      ];

      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBe('lot-2');
    });
  });

  describe('Tie-breaks and distance weighting', () => {
    it('prefers higher arrival score on tie when distances are identical', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Lot 1', 20, 10), score: 80, distanceKm: 1 },
        { lot: createMockLot('lot-2', 'Lot 2', 20, 10), score: 90, distanceKm: 1 },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBe('lot-2');
    });

    it('prefers nearer lot when scores and capacities are similar', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-far', 'Far Lot', 20, 10), score: 80, distanceKm: 4.5 },
        { lot: createMockLot('lot-near', 'Near Lot', 20, 10), score: 80, distanceKm: 0.5 },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBe('lot-near');
      expect(res.recommendedReason).toContain('0.5 km away');
    });

    it('breaks exact ties deterministically using alphabetical lot ID', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-z', 'Lot Z', 20, 10), score: 80, distanceKm: 1 },
        { lot: createMockLot('lot-a', 'Lot A', 20, 10), score: 80, distanceKm: 1 },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBe('lot-a');
    });

    it('computes correctly without distance data (silently omits distance in reason)', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Lot 1', 20, 10), score: 85, distanceKm: null },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.recommendedLotId).toBe('lot-1');
      expect(res.recommendedReason).not.toContain('km away');
      expect(res.recommendedReason).toBe('85% estimated availability, 10 spaces free now');
    });
  });

  describe('All-limited fallback and no-eligible cases', () => {
    it('identifies lot with most spaces right now when all lots have LIMITED_DATA', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Lot 1', 20, 5), score: null },
        { lot: createMockLot('lot-2', 'Lot 2', 50, 25), score: null },
        { lot: createMockLot('lot-3', 'Lot 3', 30, 12), score: null },
      ];
      const res = computeRecommendation(lots, false, '7:00 PM');
      expect(res.isAllLimited).toBe(true);
      expect(res.recommendedLotId).toBeNull();
      expect(res.mostSpacesLotId).toBe('lot-2'); // 25 free spaces
    });

    it('returns calm note when no lot meets eligibility threshold (all score < 50)', () => {
      const lots: LotWithArrivalScore[] = [
        { lot: createMockLot('lot-1', 'Lot 1', 20, 5), score: 40 },
        { lot: createMockLot('lot-2', 'Lot 2', 30, 2), score: 25 },
      ];
      const res = computeRecommendation(lots, false, '8:00 PM');
      expect(res.recommendedLotId).toBeNull();
      expect(res.noEligibleNote).toBe('Availability looks tight around 8:00 PM. Consider another time.');
    });
  });
});
