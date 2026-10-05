import { prisma } from '../lib/prisma.js';
import {
  MIN_SAMPLES,
  HISTORY_DAYS,
  indiaTimeParts,
  ArrivalAvailabilityResponseData,
  LotAvailabilityItem,
  AvailabilityHourPatternItem,
} from '@smart-parking/shared';

interface RawRecord {
  parkingLotId: string;
  hourOfDay: number;
  dayOfWeek: number;
  availableCount: number;
  totalSlots: number;
}

/**
 * Calculates deterministic historical arrival availability for all active parking lots
 * per FROZEN CONTRACT and Feature A specifications.
 *
 * Uses a single batch database query bounded to the last 56 days.
 *
 * @param arrivalDate Target arrival timestamp (UTC Date)
 * @param now Reference current timestamp (defaults to current system time)
 */
export async function getArrivalAvailability(
  arrivalDate: Date,
  now: Date = new Date()
): Promise<ArrivalAvailabilityResponseData> {
  const arrivalParts = indiaTimeParts(arrivalDate);
  const nowParts = indiaTimeParts(now);

  const cutoff = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  // 1. Fetch all active parking lots
  const activeLots = await prisma.parkingLot.findMany({
    where: { isActive: true },
    select: {
      id: true,
      totalSlots: true,
    },
    orderBy: { name: 'asc' },
  });

  // 2. Single batch query for occupancy records across all active lots within HISTORY_DAYS
  const records = await prisma.occupancyRecord.findMany({
    where: {
      hourStart: { gte: cutoff },
      totalSlots: { gt: 0 },
      parkingLot: { isActive: true },
    },
    select: {
      parkingLotId: true,
      hourOfDay: true,
      dayOfWeek: true,
      availableCount: true,
      totalSlots: true,
    },
  });

  // 3. Index records by lotId for in-memory constant-time access
  const recordsByLot = new Map<string, RawRecord[]>();
  for (const lot of activeLots) {
    recordsByLot.set(lot.id, []);
  }
  for (const rec of records) {
    const list = recordsByLot.get(rec.parkingLotId);
    if (list) {
      list.push(rec);
    }
  }

  // 4. Compute arrival metrics for each lot
  const lotsResult: LotAvailabilityItem[] = [];

  for (const lot of activeLots) {
    const lotRecords = recordsByLot.get(lot.id) || [];

    // Helper to calculate historical availability for a given hour and weekday
    const calcStatsForHour = (h: number, d: number) => {
      const hourRows = lotRecords.filter((r) => r.hourOfDay === h && r.totalSlots > 0);
      const weekdayRows = hourRows.filter((r) => r.dayOfWeek === d);

      if (weekdayRows.length >= MIN_SAMPLES) {
        const sum = weekdayRows.reduce(
          (acc, r) => acc + (100 * r.availableCount) / r.totalSlots,
          0
        );
        return {
          basis: 'SAME_WEEKDAY_HOUR' as const,
          samples: weekdayRows.length,
          value: Math.min(100, Math.max(0, Math.round((sum / weekdayRows.length) * 10) / 10)),
        };
      } else if (hourRows.length >= MIN_SAMPLES) {
        const sum = hourRows.reduce(
          (acc, r) => acc + (100 * r.availableCount) / r.totalSlots,
          0
        );
        return {
          basis: 'ALL_DAYS_HOUR' as const,
          samples: hourRows.length,
          value: Math.min(100, Math.max(0, Math.round((sum / hourRows.length) * 10) / 10)),
        };
      } else {
        return {
          basis: null,
          samples: hourRows.length,
          value: null,
        };
      }
    };

    // Calculate arrival hour metric
    const arrivalMetric = calcStatsForHour(arrivalParts.hourOfDay, arrivalParts.dayOfWeek);

    // Calculate current hour metric (for blending live availability)
    const nowMetric = calcStatsForHour(nowParts.hourOfDay, nowParts.dayOfWeek);

    const isOk = arrivalMetric.value !== null;

    // Calculate 6-hour pattern window around arrival: arrivalHour - 2 to arrivalHour + 3 (wrapping 0-23)
    const pattern: AvailabilityHourPatternItem[] = [];
    for (let offset = -2; offset <= 3; offset++) {
      const targetHour = ((arrivalParts.hourOfDay + offset) % 24 + 24) % 24;
      const targetDay =
        arrivalParts.dayOfWeek +
        (arrivalParts.hourOfDay + offset < 0 ? -1 : arrivalParts.hourOfDay + offset >= 24 ? 1 : 0);
      const normDay = ((targetDay % 7) + 7) % 7;

      const hourStat = calcStatsForHour(targetHour, normDay);
      if (hourStat.value !== null) {
        pattern.push({
          hourOfDay: targetHour,
          expectedAvailablePercent: Math.round(hourStat.value),
        });
      }
    }

    lotsResult.push({
      parkingLotId: lot.id,
      totalSlots: lot.totalSlots,
      historical: {
        status: isOk ? 'OK' : 'LIMITED_DATA',
        basis: arrivalMetric.basis,
        samples: arrivalMetric.samples,
        expectedAvailablePercentAtArrival: arrivalMetric.value,
        expectedAvailablePercentNow: nowMetric.value,
      },
      pattern,
    });
  }

  return {
    arrivalTime: arrivalDate.toISOString(),
    generatedAt: now.toISOString(),
    lots: lotsResult,
  };
}
