import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessTokenJwt,
  DUMMY_PASSWORD_HASH,
} from './lib/crypto.js';
import { Role } from '@smart-parking/shared';

describe('Cryptographic Utilities (Security Rules 4 & 5)', () => {
  it('hashes and verifies passwords correctly with bcrypt cost 12', async () => {
    const password = 'mySuperSecurePassword123';
    const hash = await hashPassword(password);
    expect(hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$')).toBe(true);

    const isMatch = await comparePassword(password, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await comparePassword('wrongPassword123', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('runs dummy password comparison for timing attack mitigation', async () => {
    const isMatch = await comparePassword('anyPasswordAttempt', DUMMY_PASSWORD_HASH);
    expect(isMatch).toBe(false);
  });

  it('generates 48-byte base64url refresh token and hashes via SHA-256', () => {
    const token = generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(64);

    const hash = hashToken(token);
    expect(hash).toHaveLength(64); // 256-bit hex string is 64 characters
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('signs and verifies access JWT tokens', () => {
    const payload = { sub: 'usr_12345', role: Role.USER };
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessTokenJwt(token);
    expect(decoded.sub).toBe('usr_12345');
    expect(decoded.role).toBe(Role.USER);
  });

  it('rejects tampered JWT tokens', () => {
    const token = signAccessToken({ sub: 'usr_12345', role: Role.USER });
    const tampered = token + 'tamper';
    expect(() => verifyAccessTokenJwt(tampered)).toThrow();
  });
});
