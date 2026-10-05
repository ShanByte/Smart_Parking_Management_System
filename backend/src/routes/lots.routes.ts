import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import { GetSlotsQuerySchema } from '@smart-parking/shared';
import { getLotsWithFreeCount, getLot, getSlotsByLot } from '../services/lots.service.js';
import { statsRouter } from './stats.routes.js';

export const lotsRouter = Router();

// Mount statsRouter from Member 4 for GET /api/v1/parking-lots/:id/stats per C9
lotsRouter.use('/', statsRouter);

// GET /api/v1/parking-lots
lotsRouter.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getLotsWithFreeCount();
    sendSuccess(res, data, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/parking-lots/:id
lotsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
    const data = await getLot(id);
    sendSuccess(res, data, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/parking-lots/:id/slots?from=&to=
lotsRouter.get(
  '/:id/slots',
  validate({ query: GetSlotsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : (req.params.id ?? '');
      const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
      const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;
      const data = await getSlotsByLot(id, from, to);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);
