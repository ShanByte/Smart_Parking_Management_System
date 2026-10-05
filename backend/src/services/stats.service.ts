// ==============================================================================
// stats.service.ts - Member 4: Occupancy Rollup and Stats Service
// Contract C6 & C9 compliant: Parameterized $queryRaw only (Security Rule 6)
// ==============================================================================

import { prisma } from '../lib/prisma.js';

export interface HourlyStat {
  hourOfDay: number;
  averageOccupiedPercent: number;
  samples: number;
}

/**
 * Rollup hourly occupancy snapshot into OccupancyRecord table.
 * Idempotent: Executing multiple times for the same hourStart will update existing
 * records without creating duplicates, using unique key (parkingLotId, hourStart).
 *
 * @param hourStart The UTC instant at which the India (Asia/Kolkata) hour begins.
 */
export async function rollupHour(hourStart: Date): Promise<void> {
  // Asia/Kolkata is UTC+5:30 wall-clock time
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const indiaTime = new Date(hourStart.getTime() + IST_OFFSET_MS);

  const hourOfDay = indiaTime.getUTCHours(); // 0 to 23
  const dayOfWeek = indiaTime.getUTCDay(); // 0 (Sunday) to 6 (Saturday)

  // Parameterized tagged-template query only (Security Rule 6).
  // Idempotent upsert via ON CONFLICT ("parkingLotId", "hourStart").
  await prisma.$executeRaw`
    INSERT INTO "OccupancyRecord" (
      "id",
      "parkingLotId",
      "hourStart",
      "hourOfDay",
      "dayOfWeek",
      "occupiedCount",
      "availableCount",
      "totalSlots",
      "createdAt"
    )
    SELECT
      gen_random_uuid()::text AS "id",
      pl."id" AS "parkingLotId",
      ${hourStart}::timestamp with time zone AS "hourStart",
      ${hourOfDay}::integer AS "hourOfDay",
      ${dayOfWeek}::integer AS "dayOfWeek",
      COUNT(ps."id") FILTER (WHERE ps."status" != 'AVAILABLE')::integer AS "occupiedCount",
      COUNT(ps."id") FILTER (WHERE ps."status" = 'AVAILABLE')::integer AS "availableCount",
      pl."totalSlots" AS "totalSlots",
      NOW() AS "createdAt"
    FROM "ParkingLot" pl
    LEFT JOIN "ParkingSlot" ps ON ps."parkingLotId" = pl."id"
    WHERE pl."isActive" = true
    GROUP BY pl."id", pl."totalSlots"
    ON CONFLICT ("parkingLotId", "hourStart")
    DO UPDATE SET
      "occupiedCount" = EXCLUDED."occupiedCount",
      "availableCount" = EXCLUDED."availableCount",
      "totalSlots" = EXCLUDED."totalSlots";
  `;
}

/**
 * Retrieve aggregated occupancy statistics grouped by hourOfDay for a specific parking lot.
 * Returns only hours that have data, sorted ascending by hourOfDay.
 *
 * @param lotId The unique identifier of the parking lot.
 */
export async function getHourlyStats(lotId: string): Promise<HourlyStat[]> {
  // Tagged-template parameterized query ONLY (Security Rule 6). Never string concatenation.
  const rows = await prisma.$queryRaw<
    Array<{
      hourOfDay: number;
      averageOccupiedPercent: number | string;
      samples: number | bigint;
    }>
  >`
    SELECT
      "hourOfDay",
      ROUND(AVG(
        CASE
          WHEN "totalSlots" > 0 THEN ("occupiedCount"::numeric / "totalSlots"::numeric) * 100.0
          ELSE 0.0
        END
      ), 1)::float AS "averageOccupiedPercent",
      COUNT(*)::integer AS "samples"
    FROM "OccupancyRecord"
    WHERE "parkingLotId" = ${lotId}
    GROUP BY "hourOfDay"
    ORDER BY "hourOfDay" ASC;
  `;

  return rows.map((row) => ({
    hourOfDay: Number(row.hourOfDay),
    averageOccupiedPercent: Number(row.averageOccupiedPercent),
    samples: Number(row.samples),
  }));
}
