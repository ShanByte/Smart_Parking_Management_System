import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../lib/respond.js';
import { env } from '../config/env.js';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  ErrorCode,
} from '@smart-parking/shared';
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  logoutUser,
  getCurrentUser,
} from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { ValidationError, UnauthorizedError } from '../lib/errors.js';

export const authRouter = Router();

function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    path: '/api/v1/auth',
    secure: env.NODE_ENV === 'production',
    sameSite: env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

// POST /api/v1/auth/register
authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: RegisterRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password } = req.body;
      const result = await registerUser(name, email, password);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/login
authRouter.post(
  '/login',
  authRateLimiter,
  validate({ body: LoginRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const { authData, rawRefreshToken } = await loginUser(email, password);

      res.cookie('refresh_token', rawRefreshToken, getRefreshTokenCookieOptions());
      sendSuccess(res, authData, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh
authRouter.post(
  '/refresh',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // C5: Require X-Requested-With: XMLHttpRequest
      const requestedWith = req.headers['x-requested-with'];
      if (requestedWith !== 'XMLHttpRequest') {
        throw new ValidationError(
          ErrorCode.VALIDATION_ERROR,
          'Missing or invalid X-Requested-With header'
        );
      }

      const rawRefreshToken = req.cookies?.refresh_token;
      if (!rawRefreshToken) {
        throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'No refresh token provided');
      }

      const { authData, rawRefreshToken: newRawRefreshToken } =
        await rotateRefreshToken(rawRefreshToken);

      res.cookie('refresh_token', newRawRefreshToken, getRefreshTokenCookieOptions());
      sendSuccess(res, authData, 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/logout
authRouter.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // C5: Require X-Requested-With: XMLHttpRequest
      const requestedWith = req.headers['x-requested-with'];
      if (requestedWith !== 'XMLHttpRequest') {
        throw new ValidationError(
          ErrorCode.VALIDATION_ERROR,
          'Missing or invalid X-Requested-With header'
        );
      }

      const rawRefreshToken = req.cookies?.refresh_token;
      await logoutUser(rawRefreshToken);

      res.clearCookie('refresh_token', {
        httpOnly: true,
        path: '/api/v1/auth',
        secure: env.NODE_ENV === 'production',
        sameSite: env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
        domain: env.COOKIE_DOMAIN,
      });

      sendSuccess(res, { status: 'ok' as const }, 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/auth/me
authRouter.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
      }
      const user = await getCurrentUser(req.user.userId);
      sendSuccess(res, { user }, 200);
    } catch (err) {
      next(err);
    }
  }
);
