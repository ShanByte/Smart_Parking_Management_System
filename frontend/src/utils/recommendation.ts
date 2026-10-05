import { ParkingLot } from '../types/contract';

export interface LotWithArrivalScore {
  lot: ParkingLot;
  score: number | null; // Blended arrival availability score (0-100 or null if LIMITED_DATA)
  distanceKm?: number | null;
}

export interface RecommendationResult {
  recommendedLotId: string | null;
  recommendedReason: string | null;
  isAllLimited: boolean;
  mostSpacesLotId: string | null;
  noEligibleNote: string | null;
}

/**
 * Calculates great-circle distance between two GPS coordinates using Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Deterministic recommendation function ("Best choice for your arrival").
 *
 * Rules per specification:
 * - Eligible lots: have a score (not LIMITED_DATA), score >= 50, and (if arrival is Now) freeCount > 0.
 * - Score with distance: 0.50*score + 0.20*currentFreePercent + 0.20*distanceScore + 0.10*capacityScore
 * - Score without distance: 0.60*score + 0.25*currentFreePercent + 0.15*capacityScore
 *   where:
 *     distanceScore = 100 * (1 - min(distanceKm, 5) / 5)
 *     capacityScore = 100 * totalSlots / maxTotalSlotsAmongLots
 * - Ties: higher score, then nearer (smaller distance), then lot id (alphabetical).
 * - NEVER recommend a lot purely because it has highest current availability.
 * - If no lot is eligible: show note "Availability looks tight around <formattedTime>. Consider another time."
 * - If ALL lots are LIMITED_DATA: no Recommended badge; the lot with most free spaces gets "Most spaces right now".
 */
export function computeRecommendation(
  lots: LotWithArrivalScore[],
  isArrivalNow: boolean,
  formattedArrivalTime: string
): RecommendationResult {
  if (lots.length === 0) {
    return {
      recommendedLotId: null,
      recommendedReason: null,
      isAllLimited: false,
      mostSpacesLotId: null,
      noEligibleNote: null,
    };
  }

  const allLimited = lots.every((item) => item.score === null);

  if (allLimited) {
    // Find lot with most free spaces
    let bestLot = lots[0]!;
    for (const item of lots) {
      if (item.lot.freeCount > bestLot.lot.freeCount) {
        bestLot = item;
      }
    }
    return {
      recommendedLotId: null,
      recommendedReason: null,
      isAllLimited: true,
      mostSpacesLotId: bestLot.lot.id,
      noEligibleNote: null,
    };
  }

  // Filter eligible lots
  const eligible = lots.filter((item) => {
    if (item.score === null) return false;
    if (item.score < 50) return false;
    if (isArrivalNow && item.lot.freeCount <= 0) return false;
    return true;
  });

  if (eligible.length === 0) {
    return {
      recommendedLotId: null,
      recommendedReason: null,
      isAllLimited: false,
      mostSpacesLotId: null,
      noEligibleNote: `Availability looks tight around ${formattedArrivalTime}. Consider another time.`,
    };
  }

  const maxTotalSlots = Math.max(...lots.map((l) => l.lot.totalSlots), 1);

  // Score each eligible lot
  interface ScoredLot {
    item: LotWithArrivalScore;
    recommendationScore: number;
    rawScore: number;
    distanceKm: number | null;
  }

  const scored: ScoredLot[] = eligible.map((item) => {
    const rawScore = item.score!;
    const currentFreePercent =
      item.lot.totalSlots > 0 ? (100 * item.lot.freeCount) / item.lot.totalSlots : 0;
    const capacityScore = 100 * (item.lot.totalSlots / maxTotalSlots);

    let recScore: number;
    const dist = typeof item.distanceKm === 'number' ? item.distanceKm : null;

    if (dist !== null) {
      const distanceScore = 100 * (1 - Math.min(dist, 5) / 5);
      recScore =
        0.5 * rawScore +
        0.2 * currentFreePercent +
        0.2 * distanceScore +
        0.1 * capacityScore;
    } else {
      recScore =
        0.6 * rawScore +
        0.25 * currentFreePercent +
        0.15 * capacityScore;
    }

    return {
      item,
      recommendationScore: recScore,
      rawScore,
      distanceKm: dist,
    };
  });

  // Sort by recommendationScore desc, then rawScore desc, then nearer dist, then lot ID asc
  scored.sort((a, b) => {
    if (Math.abs(b.recommendationScore - a.recommendationScore) > 0.0001) {
      return b.recommendationScore - a.recommendationScore;
    }
    if (b.rawScore !== a.rawScore) {
      return b.rawScore - a.rawScore;
    }
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return a.item.lot.id.localeCompare(b.item.lot.id);
  });

  const best = scored[0]!;
  const reason = `${best.rawScore}% estimated availability, ${best.item.lot.freeCount} spaces free now${
    best.distanceKm !== null ? ` (${best.distanceKm.toFixed(1)} km away)` : ''
  }`;

  return {
    recommendedLotId: best.item.lot.id,
    recommendedReason: reason,
    isAllLimited: false,
    mostSpacesLotId: null,
    noEligibleNote: null,
  };
}
