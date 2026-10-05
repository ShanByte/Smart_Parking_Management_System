import { Request, Response, NextFunction } from 'express';
import { Role, ErrorCode } from '@smart-parking/shared';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { verifyAccessTokenJwt } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';

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
    throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Invalid or expired access token');
  }
}

/**
 * Require valid Bearer access token on HTTP endpoints
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7).trim();
  const identity = verifyAccessToken(token);

  req.user = {
    userId: identity.userId,
    role: identity.role,
  };

  next();
}

/**
 * Require specific role, re-checking the database on every call (Security Rules 5 & 14)
 */
export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }

      // Re-check role and assignedLotId directly in the database (Rules 5 & 14)
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, role: true, assignedLotId: true },
      });

      if (!dbUser) {
        throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'User account no longer exists');
      }

      const currentRole = dbUser.role as unknown as Role;
      req.user.role = currentRole;
      req.user.assignedLotId = dbUser.assignedLotId;

      if (!allowedRoles.includes(currentRole)) {
        throw new ForbiddenError(
          ErrorCode.FORBIDDEN,
          `Access denied. Role ${currentRole} is not permitted.`
        );
      }

      // Guard check: GUARD role is restricted to their assigned lot (Rule 14)
      if (currentRole === Role.GUARD) {
        const lotIdParam = req.params.lotId;
        if (lotIdParam && dbUser.assignedLotId !== lotIdParam) {
          throw new ForbiddenError(
            ErrorCode.FORBIDDEN,
            'Guard is not authorized for this parking lot'
          );
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
