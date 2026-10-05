import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { ErrorCode, SlotStatus } from '@smart-parking/shared';
import * as lotsService from './services/lots.service.js';
import * as statsService from './services/stats.service.js';
import { prisma } from './lib/prisma.js';
import { NotFoundError } from './lib/errors.js';
import type { ParkingLot } from '@prisma/client';

describe('Parking Lots Endpoints (Stage 3 & C7 & C9)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockLot = {
    id: 'lot_fc_road',
    name: 'FC Road Smart Parking',
    address: 'Fergusson College Rd, Pune',
    latitude: 18.5204,
    longitude: 73.8567,
    totalSlots: 50,
    freeCount: 20,
    pricePerHourPaise: 4000,
  };

  const mockSlots = [
    { id: 'slot_1', slotNumber: 'A1', status: SlotStatus.AVAILABLE },
    { id: 'slot_2', slotNumber: 'A2', status: SlotStatus.OCCUPIED },
  ];

  describe('GET /api/v1/parking-lots', () => {
    it('returns all active parking lots with free slot count', async () => {
      vi.spyOn(lotsService, 'getLotsWithFreeCount').mockResolvedValue([mockLot]);

      const res = await request(app).get('/api/v1/parking-lots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('lot_fc_road');
      expect(res.body.data[0].freeCount).toBe(20);
    });
  });

  describe('GET /api/v1/parking-lots/:id', () => {
    it('returns a single parking lot by ID', async () => {
      vi.spyOn(lotsService, 'getLot').mockResolvedValue(mockLot);

      const res = await request(app).get('/api/v1/parking-lots/lot_fc_road');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('lot_fc_road');
    });

    it('returns 404 NOT_FOUND when lot does not exist', async () => {
      vi.spyOn(lotsService, 'getLot').mockRejectedValue(
        new NotFoundError(ErrorCode.NOT_FOUND, 'Parking lot not found: lot_missing')
      );

      const res = await request(app).get('/api/v1/parking-lots/lot_missing');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('GET /api/v1/parking-lots/:id/slots', () => {
    it('returns slots for a parking lot without date window', async () => {
      vi.spyOn(lotsService, 'getSlotsByLot').mockResolvedValue(mockSlots);

      const res = await request(app).get('/api/v1/parking-lots/lot_fc_road/slots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('passes date window query parameters when specified', async () => {
      const getSlotsSpy = vi.spyOn(lotsService, 'getSlotsByLot').mockResolvedValue(mockSlots);

      const from = '2026-10-05T12:00:00.000Z';
      const to = '2026-10-05T14:00:00.000Z';

      const res = await request(app)
        .get('/api/v1/parking-lots/lot_fc_road/slots')
        .query({ from, to });

      expect(res.status).toBe(200);
      expect(getSlotsSpy).toHaveBeenCalledWith('lot_fc_road', new Date(from), new Date(to));
    });
  });

  describe('GET /api/v1/parking-lots/:id/stats', () => {
    it('returns hourly occupancy statistics via mounted Member 4 statsRouter', async () => {
      vi.spyOn(prisma.parkingLot, 'findUnique').mockResolvedValue({
        id: 'lot_fc_road',
        name: 'FC Road Smart Parking',
        address: 'Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        pricePerHourPaise: 4000,
        totalSlots: 50,
        isActive: true,
      } as unknown as ParkingLot);

      vi.spyOn(statsService, 'getHourlyStats').mockResolvedValue([
        { hourOfDay: 10, averageOccupiedPercent: 40.5, samples: 10 },
      ]);

      const res = await request(app).get('/api/v1/parking-lots/lot_fc_road/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.parkingLotId).toBe('lot_fc_road');
      expect(res.body.data.hours.length).toBe(1);
    });

    it('returns 404 NOT_FOUND if lot not found in stats endpoint', async () => {
      vi.spyOn(prisma.parkingLot, 'findUnique').mockResolvedValue(null);

      const res = await request(app).get('/api/v1/parking-lots/lot_unknown/stats');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });
});
