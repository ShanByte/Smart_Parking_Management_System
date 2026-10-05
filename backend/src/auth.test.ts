import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import type { User, RefreshToken } from '@prisma/client';
import { hashPassword, signAccessToken, generateRefreshToken, hashToken } from './lib/crypto.js';
import { Role, ErrorCode } from '@smart-parking/shared';
import { verifyAccessToken, requireAuth, requireRole } from './middleware/auth.js';
import { UnauthorizedError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import express, { Request, Response } from 'express';

describe('Stage 2 Authentication & Authorization Tests', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('JWT Token & Verification (C5)', () => {
    it('verifyAccessToken extracts userId and role from valid token', () => {
      const token = signAccessToken({ sub: 'usr_valid_123', role: Role.USER });
      const result = verifyAccessToken(token);

      expect(result.userId).toBe('usr_valid_123');
      expect(result.role).toBe(Role.USER);
    });

    it('verifyAccessToken throws UnauthorizedError on forged/tampered token', () => {
      expect(() => verifyAccessToken('forged.invalid.token')).toThrow(UnauthorizedError);
      try {
        verifyAccessToken('forged.invalid.token');
      } catch (err: unknown) {
        const authErr = err as UnauthorizedError;
        expect(authErr.code).toBe(ErrorCode.UNAUTHORIZED);
        expect(authErr.statusCode).toBe(401);
      }
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('successfully registers a user with lowercased email and hashed password', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'usr_reg_001',
        name: 'Alice Driver',
        email: 'alice@example.com',
        passwordHash: 'hashedPassword',
        role: 'USER',
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      } as unknown as User);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice Driver',
          email: 'ALICE@EXAMPLE.COM',
          password: 'superSecretPassword123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.user.id).toBe('usr_reg_001');
    });

    it('rejects registration with duplicate email with 409 CONFLICT', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_existing',
      } as unknown as User);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice Driver',
          email: 'alice@example.com',
          password: 'superSecretPassword123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
    });

    it('rejects registration with password shorter than 10 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice Driver',
          email: 'alice@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('successfully logs in, sets refresh cookie, and returns access token', async () => {
      const passwordHash = await hashPassword('correctPassword123');
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_login_001',
        name: 'Bob User',
        email: 'bob@example.com',
        passwordHash,
        role: 'USER',
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      } as unknown as User);

      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({} as unknown as RefreshToken);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'correctPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('bob@example.com');
      // Verify refresh cookie set
      const cookies = res.headers['set-cookie'] as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies![0]).toContain('refresh_token=');
      expect(cookies![0]).toContain('HttpOnly');
    });

    it('rejects login with wrong password with 401 UNAUTHORIZED', async () => {
      const passwordHash = await hashPassword('correctPassword123');
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_login_001',
        name: 'Bob User',
        email: 'bob@example.com',
        passwordHash,
        role: 'USER',
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      } as unknown as User);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'wrongPassword456',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects login with unknown email with identical message (timing-protected)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'anyPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/refresh (Rotation & Reuse Detection)', () => {
    it('rejects refresh without X-Requested-With header per C5', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refresh_token=sampletoken']);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('successfully rotates refresh token and issues new access token', async () => {
      const rawToken = generateRefreshToken();
      const mockUser = {
        id: 'usr_refresh_001',
        name: 'Carol Driver',
        email: 'carol@example.com',
        role: 'USER',
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      };

      vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue({
        id: 'tok_001',
        userId: 'usr_refresh_001',
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: mockUser,
      } as unknown as (RefreshToken & { user: User }));

      vi.spyOn(prisma.refreshToken, 'update').mockResolvedValue({} as unknown as RefreshToken);
      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({} as unknown as RefreshToken);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', [`refresh_token=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('detects reused refresh token and revokes ALL user sessions per Rule 5', async () => {
      const rawToken = generateRefreshToken();
      const updateManySpy = vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValue({ count: 3 });

      // Token already revoked!
      vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue({
        id: 'tok_revoked',
        userId: 'usr_stolen_account',
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date('2026-10-05T01:00:00.000Z'),
        user: { id: 'usr_stolen_account' },
      } as unknown as (RefreshToken & { user: User }));

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', [`refresh_token=${rawToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('All active sessions terminated');
      // Verifies all tokens for that user were revoked
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'usr_stolen_account' }),
        })
      );
    });

    it('rejects expired refresh token', async () => {
      const rawToken = generateRefreshToken();
      vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue({
        id: 'tok_expired',
        userId: 'usr_001',
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() - 10000), // Expired!
        revokedAt: null,
        user: { id: 'usr_001' },
      } as unknown as (RefreshToken & { user: User }));
      vi.spyOn(prisma.refreshToken, 'update').mockResolvedValue({} as unknown as RefreshToken);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', [`refresh_token=${rawToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('expired');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes refresh token and clears cookie', async () => {
      const rawToken = generateRefreshToken();
      const updateManySpy = vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', [`refresh_token=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(updateManySpy).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns profile of authenticated user', async () => {
      const token = signAccessToken({ sub: 'usr_me_001', role: Role.USER });
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_me_001',
        name: 'Me User',
        email: 'me@example.com',
        role: 'USER',
        assignedLotId: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      } as unknown as User);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('me@example.com');
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });

  describe('Authorization: requireRole Middleware (Security Rules 5 & 14)', () => {
    const testApp = express();
    testApp.use(express.json());

    // Test endpoints with role guards
    testApp.get('/admin-only', requireAuth, requireRole(Role.ADMIN), (_req: Request, res: Response) => {
      res.json({ success: true, message: 'admin ok' });
    });

    testApp.get(
      '/guard-lot/:lotId',
      requireAuth,
      requireRole(Role.GUARD, Role.ADMIN),
      (_req: Request, res: Response) => {
        res.json({ success: true, message: 'guard ok' });
      }
    );
    testApp.use(errorHandler);

    it('forbids USER role on admin-only route with 403 FORBIDDEN', async () => {
      const userToken = signAccessToken({ sub: 'usr_driver', role: Role.USER });
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_driver',
        role: 'USER',
        assignedLotId: null,
      } as unknown as User);

      const res = await request(testApp)
        .get('/admin-only')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('allows ADMIN role on admin-only route', async () => {
      const adminToken = signAccessToken({ sub: 'usr_admin', role: Role.ADMIN });
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_admin',
        role: 'ADMIN',
        assignedLotId: null,
      } as unknown as User);

      const res = await request(testApp)
        .get('/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('admin ok');
    });

    it('allows GUARD role on their assigned lot', async () => {
      const guardToken = signAccessToken({ sub: 'usr_guard', role: Role.GUARD });
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_guard',
        role: 'GUARD',
        assignedLotId: 'lot_fc_road',
      } as unknown as User);

      const res = await request(testApp)
        .get('/guard-lot/lot_fc_road')
        .set('Authorization', `Bearer ${guardToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('guard ok');
    });

    it('forbids GUARD role on a lot they are not assigned to (Security Rule 14)', async () => {
      const guardToken = signAccessToken({ sub: 'usr_guard', role: Role.GUARD });
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'usr_guard',
        role: 'GUARD',
        assignedLotId: 'lot_fc_road',
      } as unknown as User);

      const res = await request(testApp)
        .get('/guard-lot/lot_other_station')
        .set('Authorization', `Bearer ${guardToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(res.body.message).toContain('not authorized for this parking lot');
    });
  });
});
