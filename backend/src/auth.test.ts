import { describe, it, expect } from 'vitest';
import { verifyAccessToken } from './middleware/auth.js';
import { signAccessToken } from './lib/crypto.js';
import { Role, ErrorCode } from '@smart-parking/shared';
import { UnauthorizedError } from './lib/errors.js';

describe('Authentication Middleware (C5)', () => {
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
