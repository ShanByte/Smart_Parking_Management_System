import { Request, Response, NextFunction } from 'express';
import { Role } from '@smart-parking/shared';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyAccessTokenJwt } from '../lib/crypto.js';

// Extend Express Request to include authenticated user identity
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        assignedLotId?: string | null;
      };
    }
  }
}

/**
 * C5 & C9 Hand-off:
 * Member 1 exports verifyAccessToken(token: string): { userId: string; role: Role }
 * Throws UnauthorizedError if invalid or expired.
 */
export function verifyAccessToken(token: string): { userId: string; role: Role } {
  try {
    const payload = verifyAccessTokenJwt(token);
    return {
      userId: payload.sub,
      role: payload.role,
    };
  } catch {
    throw new UnauthorizedError(undefined, 'Invalid or expired access token');
  }
}

/**
 * Require valid Bearer access token on HTTP endpoints
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError(undefined, 'Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7).trim();
  const identity = verifyAccessToken(token);

  req.user = {
    userId: identity.userId,
    role: identity.role,
  };

  next();
}
