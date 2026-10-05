/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { getArrivalAvailability } from './services/availability.service.js';
import {
  ErrorCode,
  indiaTimeParts,
  ArrivalAvailabilityResponseDataSchema,
  HISTORY_DAYS,
} from '@smart-parking/shared';

describe('Arrival Availability Service & Route (Feature A)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockLot1 = {
    id: 'lot_fc_road',
    name: 'FC Road Smart Parking',
    address: 'Fergusson College Rd, Pune',
    latitude: 18.5204,
    longitude: 73.8567,
    totalSlots: 10,
    pricePerHourPaise: 4000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLot2 = {
    id: 'lot_kp',
    name: 'Koregaon Park Plaza',
    address: 'North Main Rd, Pune',
    latitude: 18.5362,
    longitude: 73.894,
    totalSlots: 20,
    pricePerHourPaise: 6000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getArrivalAvailability service logic', () => {
    it('uses SAME_WEEKDAY_HOUR basis when >= 3 samples exist for the same day and hour', async () => {
      const targetArrival = new Date(Date.now() + 2 * 3600 * 1000);
      const { dayOfWeek, hourOfDay } = indiaTimeParts(targetArrival);

      // 3 records on same dayOfWeek and hourOfDay: totalSlots = 10, availableCount = 7, 8, 9
      const histRecords = [
        {
          parkingLotId: mockLot1.id,
          dayOfWeek,
          hourOfDay,
          availableCount: 7,
          totalSlots: 10,
        },
        {
          parkingLotId: mockLot1.id,
          dayOfWeek,
          hourOfDay,
          availableCount: 8,
          totalSlots: 10,
        },
        {
          parkingLotId: mockLot1.id,
          dayOfWeek,
          hourOfDay,
          availableCount: 9,
          totalSlots: 10,
        },
      ];

      vi.spyOn(prisma.parkingLot, 'findMany').mockResolvedValue([mockLot1] as any);
      vi.spyOn(prisma.occupancyRecord, 'findMany').mockResolvedValue(histRecords as any);

      const result = await getArrivalAvailability(targetArrival);

      expect(result.lots).toHaveLength(1);
      const lotRes = result.lots[0]!;
      expect(lotRes.parkingLotId).toBe(mockLot1.id);
      expect(lotRes.totalSlots).toBe(10);
      expect(lotRes.historical.status).toBe('OK');
      expect(lotRes.historical.basis).toBe('SAME_WEEKDAY_HOUR');
      expect(lotRes.historical.samples).toBe(3);
      // Avg available = (70% + 80% + 90%) / 3 = 80%
      expect(lotRes.historical.expectedAvailablePercentAtArrival).toBe(80);
      expect(lotRes.pattern).toBeInstanceOf(Array);
    });

    it('falls back to ALL_DAYS_HOUR when same weekday has < 3 samples but all days has >= 3', async () => {
      const targetArrival = new Date(Date.now() + 4 * 3600 * 1000);
      const { dayOfWeek, hourOfDay } = indiaTimeParts(targetArrival);
      const otherDay = (dayOfWeek + 1) % 7;

      const histRecords = [
        {
          parkingLotId: mockLot1.id,
          dayOfWeek,
          hourOfDay,
          availableCount: 6,
          totalSlots: 10,
        },
        {
          parkingLotId: mockLot1.id,
          dayOfWeek: otherDay,
          hourOfDay,
          availableCount: 8,
          totalSlots: 10,
        },
        {
          parkingLotId: mockLot1.id,
          dayOfWeek: otherDay,
          hourOfDay,
          availableCount: 7,
          totalSlots: 10,
        },
      ];

      vi.spyOn(prisma.parkingLot, 'findMany').mockResolvedValue([mockLot1] as any);
      vi.spyOn(prisma.occupancyRecord, 'findMany').mockResolvedValue(histRecords as any);

      const result = await getArrivalAvailability(targetArrival);

      const lotRes = result.lots[0]!;
      expect(lotRes.historical.status).toBe('OK');
      expect(lotRes.historical.basis).toBe('ALL_DAYS_HOUR');
      expect(lotRes.historical.samples).toBe(3);
      // Avg available = (60% + 80% + 70%) / 3 = 70%
      expect(lotRes.historical.expectedAvailablePercentAtArrival).toBe(70);
    });

    it('returns LIMITED_DATA status when total samples for the hour is < 3', async () => {
      const targetArrival = new Date(Date.now() + 1 * 3600 * 1000);
      const { dayOfWeek, hourOfDay } = indiaTimeParts(targetArrival);

      // Only 2 records total
      const histRecords = [
        {
          parkingLotId: mockLot1.id,
          dayOfWeek,
          hourOfDay,
          availableCount: 5,
          totalSlots: 10,
        },
        {
          parkingLotId: mockLot1.id,
          dayOfWeek,
          hourOfDay,
          availableCount: 5,
          totalSlots: 10,
        },
      ];

      vi.spyOn(prisma.parkingLot, 'findMany').mockResolvedValue([mockLot1] as any);
      vi.spyOn(prisma.occupancyRecord, 'findMany').mockResolvedValue(histRecords as any);

      const result = await getArrivalAvailability(targetArrival);

      const lotRes = result.lots[0]!;
      expect(lotRes.historical.status).toBe('LIMITED_DATA');
      expect(lotRes.historical.basis).toBeNull();
      expect(lotRes.historical.samples).toBe(2);
      expect(lotRes.historical.expectedAvailablePercentAtArrival).toBeNull();
    });

    it('ensures prisma query bounds history to 56 days and filters totalSlots > 0 and isActive lots', async () => {
      const targetArrival = new Date(Date.now() + 2 * 3600 * 1000);
      const now = new Date();

      const findManyLots = vi.spyOn(prisma.parkingLot, 'findMany').mockResolvedValue([mockLot1] as any);
      const findManyRecords = vi.spyOn(prisma.occupancyRecord, 'findMany').mockResolvedValue([]);

      await getArrivalAvailability(targetArrival, now);

      // Active lots only
      expect(findManyLots).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );

      // Occupancy records bounded to 56 days, positive totalSlots, and active lots
      const expectedCutoff = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
      expect(findManyRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            hourStart: { gte: expectedCutoff },
            totalSlots: { gt: 0 },
            parkingLot: { isActive: true },
          },
        })
      );
    });
  });

  describe('GET /api/v1/availability/arrival endpoint validation & responses', () => {
    it('returns 400 VALIDATION_ERROR when arrivalTime parameter is missing', async () => {
      const res = await request(app).get('/api/v1/availability/arrival');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns 400 VALIDATION_ERROR when arrivalTime is not a valid ISO date', async () => {
      const res = await request(app).get('/api/v1/availability/arrival?arrivalTime=not-a-date');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns 400 VALIDATION_ERROR when arrivalTime is more than 1 minute in the past', async () => {
      const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
      const res = await request(app).get(`/api/v1/availability/arrival?arrivalTime=${encodeURIComponent(pastTime)}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns 400 VALIDATION_ERROR when arrivalTime is more than 7 days in the future', async () => {
      const farFuture = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();
      const res = await request(app).get(`/api/v1/availability/arrival?arrivalTime=${encodeURIComponent(farFuture)}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('returns 200 with arrival availability data adhering to shared schema with no PII', async () => {
      const validTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

      vi.spyOn(prisma.parkingLot, 'findMany').mockResolvedValue([mockLot1, mockLot2] as any);
      vi.spyOn(prisma.occupancyRecord, 'findMany').mockResolvedValue([]);

      const res = await request(app).get(`/api/v1/availability/arrival?arrivalTime=${encodeURIComponent(validTime)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      // Validate shared schema parsing
      const parsed = ArrivalAvailabilityResponseDataSchema.safeParse(res.body.data);
      expect(parsed.success).toBe(true);

      expect(res.body.data.arrivalTime).toBe(validTime);
      expect(res.body.data.lots).toHaveLength(2);

      // Verify no PII (no user names, emails, phones, vehicle numbers, tokens)
      const rawString = JSON.stringify(res.body.data);
      expect(rawString).not.toMatch(/email|password|token|phone|license|vehicle/i);
    });

    it('returns 429 RATE_LIMITED when request rate limit is exceeded', async () => {
      const validTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
      vi.spyOn(prisma.parkingLot, 'findMany').mockResolvedValue([] as any);
      vi.spyOn(prisma.occupancyRecord, 'findMany').mockResolvedValue([] as any);

      let lastRes;
      for (let i = 0; i < 61; i++) {
        lastRes = await request(app)
          .get(`/api/v1/availability/arrival?arrivalTime=${encodeURIComponent(validTime)}`)
          .set('x-test-rate-limit', 'true');
      }

      expect(lastRes?.status).toBe(429);
      expect(lastRes?.body.code).toBe(ErrorCode.RATE_LIMITED);
    });
  });
});
