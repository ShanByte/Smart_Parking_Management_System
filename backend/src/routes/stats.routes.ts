// ==============================================================================
// stats.routes.ts - Member 4: Public Parking Lot Statistics Route
// Contract C4, C7 & C9: GET /:id/stats returning hourly occupancy aggregation
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getHourlyStats } from '../services/stats.service.js';

export const statsRouter = Router();

// Validate route parameter :id (Security Rule 7)
const ParamsSchema = z.object({
  id: z.string().trim().min(1, 'Parking lot ID is required'),
});

/**
 * GET /:id/stats
 * Public endpoint returning hourly occupancy rollup statistics for a parking lot.
 * Mounted by Member 1 at /api/v1/parking-lots.
 */
statsRouter.get(
  '/:id/stats',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Invalid parking lot ID',
        });
        return;
      }

      const { id } = parsed.data;

      // Verify that the lot exists and fetch its total capacity
      const lot = await prisma.parkingLot.findUnique({
        where: { id },
        select: { id: true, totalSlots: true, isActive: true },
      });

      if (!lot || !lot.isActive) {
        res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: `Parking lot with ID '${id}' was not found.`,
        });
        return;
      }

      const hours = await getHourlyStats(id);

      res.status(200).json({
        success: true,
        data: {
          parkingLotId: lot.id,
          totalSlots: lot.totalSlots,
          hours,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
