import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { ErrorCode } from '@smart-parking/shared';

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

  it('GET /ready returns 503 NOT_READY while database/redis are uninitialized', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCode.NOT_READY);
    expect(res.body.message).toContain('Readiness check failed');
  });
});
