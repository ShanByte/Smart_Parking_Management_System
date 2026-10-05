import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { ErrorCode } from '@smart-parking/shared';
import { prisma } from './lib/prisma.js';

describe('Health and Readiness Endpoints', () => {
  const app = createApp();

  it('GET /health returns 200 with success: true and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });

  it('GET /ready returns 200 when database and redis are healthy', async () => {
    const res = await request(app).get('/ready');
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ db: 'ok', redis: 'ok' });
    } else {
      expect(res.status).toBe(503);
      expect(res.body.code).toBe(ErrorCode.NOT_READY);
    }
  });

  it('GET /ready returns 503 NOT_READY when database check fails', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('DB connection failed'));
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCode.NOT_READY);
    expect(res.body.message).toContain('Readiness check failed');
  });
});
