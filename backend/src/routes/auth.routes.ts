import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  Role,
  UserView,
  LoginResponseData,
  RegisterResponseData,
  RefreshResponseData,
  LogoutResponseData,
  MeResponseData,
} from '@smart-parking/shared';

export const authRouter = Router();

const mockUser: UserView = {
  id: 'usr_stub_001',
  name: 'Demo User',
  email: 'demo@example.com',
  role: Role.USER,
  assignedLotId: null,
  createdAt: '2026-10-05T00:00:00.000Z',
};

// POST /api/v1/auth/register
// STUB: replace in Stage 2
authRouter.post(
  '/register',
  validate({ body: RegisterRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 2
    const data: RegisterResponseData = {
      user: {
        ...mockUser,
        name: req.body.name,
        email: req.body.email,
      },
    };
    sendSuccess(res, data, 201);
  }
);

// POST /api/v1/auth/login
// STUB: replace in Stage 2
authRouter.post(
  '/login',
  validate({ body: LoginRequestSchema }),
  (req: Request, res: Response) => {
    // STUB: replace in Stage 2
    const data: LoginResponseData = {
      accessToken: 'stub.jwt.access.token',
      expiresInSeconds: 900,
      user: {
        ...mockUser,
        email: req.body.email,
      },
    };
    sendSuccess(res, data, 200);
  }
);

// POST /api/v1/auth/refresh
// STUB: replace in Stage 2
authRouter.post('/refresh', (_req: Request, res: Response) => {
  // STUB: replace in Stage 2
  const data: RefreshResponseData = {
    accessToken: 'stub.jwt.access.token.refreshed',
    expiresInSeconds: 900,
    user: mockUser,
  };
  sendSuccess(res, data, 200);
});

// POST /api/v1/auth/logout
// STUB: replace in Stage 2
authRouter.post('/logout', (_req: Request, res: Response) => {
  // STUB: replace in Stage 2
  const data: LogoutResponseData = {
    status: 'ok',
  };
  sendSuccess(res, data, 200);
});

// GET /api/v1/auth/me
// STUB: replace in Stage 2
authRouter.get('/me', (_req: Request, res: Response) => {
  // STUB: replace in Stage 2
  const data: MeResponseData = {
    user: mockUser,
  };
  sendSuccess(res, data, 200);
});
