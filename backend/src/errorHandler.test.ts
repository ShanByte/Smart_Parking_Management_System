import { describe, it, expect } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from './middleware/errorHandler.js';
import { ErrorCode } from '@smart-parking/shared';

describe('Central Error Handler (errorHandler.ts)', () => {
  it('maps ZodError directly to HTTP 400 with code VALIDATION_ERROR', async () => {
    const app = express();

    // Route that triggers a raw ZodError
    app.get('/test-zod-error', (_req: Request, _res: Response, next: NextFunction) => {
      try {
        z.object({ name: z.string() }).parse({});
      } catch (err) {
        next(err);
      }
    });

    app.use(errorHandler);

    const res = await request(app).get('/test-zod-error');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.message).toContain('name: Required');
  });

  it('maps unhandled errors to HTTP 500 without leaking stack traces', async () => {
    const app = express();

    app.get('/test-unknown-error', (_req: Request, _res: Response, next: NextFunction) => {
      next(new Error('Sensitive database connection failed'));
    });

    app.use(errorHandler);

    const res = await request(app).get('/test-unknown-error');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(res.body.message).toBe('Internal server error');
    expect(res.body.stack).toBeUndefined();
  });
});
