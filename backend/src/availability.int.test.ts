import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { getTestPrisma, resetDb } from './test/helpers.js';
import { getArrivalAvailability } from './services/availability.service.js';
import { indiaTimeParts, ArrivalAvailabilityResponseDataSchema } from '@smart-parking/shared';

describe('Availability Service & Route Integration Tests (Real Database)', () => {
  const prisma = getTestPrisma();
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('correctly filters >56-day records, inactive lots, totalSlots 0 records in real DB', async () => {
    const now = new Date();
    // Choose target arrival 2 hours from now
    const targetArrival = new Date(now.getTime() + 2 * 3600 * 1000);
    const { dayOfWeek, hourOfDay } = indiaTimeParts(targetArrival);

    // 1. Create active lot
    const activeLot = await prisma.parkingLot.create({
      data: {
        name: 'Active Test Lot',
        address: '123 Main St, Pune',
        latitude: 18.52,
        longitude: 73.85,
        totalSlots: 10,
        pricePerHourPaise: 4000,
        isActive: true,
      },
    });

    // 2. Create inactive lot
    const inactiveLot = await prisma.parkingLot.create({
      data: {
        name: 'Inactive Lot',
        address: '456 Side St, Pune',
        latitude: 18.53,
        longitude: 73.86,
        totalSlots: 20,
        pricePerHourPaise: 5000,
        isActive: false,
      },
    });

    // 3. Add 3 valid occupancy records for active lot (7, 14, 21 days ago)
    for (const daysAgo of [7, 14, 21]) {
      const recTime = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
      await prisma.occupancyRecord.create({
        data: {
          parkingLotId: activeLot.id,
          hourStart: recTime,
          dayOfWeek,
          hourOfDay,
          totalSlots: 10,
          occupiedCount: 2,
          availableCount: 8,
        },
      });
    }

    // 4. Add record older than 56 days (60 days ago) -> MUST BE IGNORED
    const oldRecTime = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
    await prisma.occupancyRecord.create({
      data: {
        parkingLotId: activeLot.id,
        hourStart: oldRecTime,
        dayOfWeek,
        hourOfDay,
        totalSlots: 10,
        occupiedCount: 10,
        availableCount: 0,
      },
    });

    // 5. Add record with totalSlots = 0 -> MUST BE SKIPPED
    const zeroSlotRecTime = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
    await prisma.occupancyRecord.create({
      data: {
        parkingLotId: activeLot.id,
        hourStart: zeroSlotRecTime,
        dayOfWeek,
        hourOfDay,
        totalSlots: 0,
        occupiedCount: 0,
        availableCount: 0,
      },
    });

    // 6. Add record for inactive lot -> MUST BE EXCLUDED
    await prisma.occupancyRecord.create({
      data: {
        parkingLotId: inactiveLot.id,
        hourStart: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
        dayOfWeek,
        hourOfDay,
        totalSlots: 20,
        occupiedCount: 5,
        availableCount: 15,
      },
    });

    // Run service calculation with real DB
    const serviceResult = await getArrivalAvailability(targetArrival, now);

    // Verify only active lot is returned
    expect(serviceResult.lots).toHaveLength(1);
    const lotData = serviceResult.lots[0]!;
    expect(lotData.parkingLotId).toBe(activeLot.id);
    expect(lotData.totalSlots).toBe(10);
    expect(lotData.historical.status).toBe('OK');
    expect(lotData.historical.basis).toBe('SAME_WEEKDAY_HOUR');
    expect(lotData.historical.samples).toBe(3); // exactly the 3 valid records, not the >56d or totalSlots 0 record
    expect(lotData.historical.expectedAvailablePercentAtArrival).toBe(80); // (8/10)*100 = 80%

    // Test API route with real DB
    const res = await request(app).get(
      `/api/v1/availability/arrival?arrivalTime=${encodeURIComponent(targetArrival.toISOString())}`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const parsed = ArrivalAvailabilityResponseDataSchema.safeParse(res.body.data);
    expect(parsed.success).toBe(true);
    expect(res.body.data.lots).toHaveLength(1);
    expect(res.body.data.lots[0].parkingLotId).toBe(activeLot.id);
    expect(res.body.data.lots[0].historical.expectedAvailablePercentAtArrival).toBe(80);
  });
});
