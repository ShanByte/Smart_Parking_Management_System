import { describe, it, expect } from 'vitest';
import { validateEnv } from './env';

describe('Environment Validator (C10)', () => {
  it('rejects when VITE_API_BASE_URL is missing', () => {
    expect(() => {
      validateEnv({
        VITE_SOCKET_URL: 'http://localhost:4000',
      });
    }).toThrow(/VITE_API_BASE_URL is required/);
  });

  it('rejects when VITE_SOCKET_URL is missing', () => {
    expect(() => {
      validateEnv({
        VITE_API_BASE_URL: 'http://localhost:4000/api/v1',
      });
    }).toThrow(/VITE_SOCKET_URL is required/);
  });

  it('rejects invalid URLs', () => {
    expect(() => {
      validateEnv({
        VITE_API_BASE_URL: 'not-a-valid-url',
        VITE_SOCKET_URL: 'http://localhost:4000',
      });
    }).toThrow(/must be a valid URL/);
  });

  it('successfully validates complete environment and applies defaults', () => {
    const valid = validateEnv({
      VITE_API_BASE_URL: 'http://localhost:4000/api/v1',
      VITE_SOCKET_URL: 'http://localhost:4000',
    });

    expect(valid.VITE_API_BASE_URL).toBe('http://localhost:4000/api/v1');
    expect(valid.VITE_SOCKET_URL).toBe('http://localhost:4000');
    expect(valid.VITE_DEMO_PAY_ENABLED).toBe(false);
    expect(valid.VITE_USE_MOCKS).toBe(true);
    expect(valid.VITE_MAP_TILE_URL).toBe(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    );
  });

  it('parses boolean transform flags correctly', () => {
    const valid = validateEnv({
      VITE_API_BASE_URL: 'http://localhost:4000/api/v1',
      VITE_SOCKET_URL: 'http://localhost:4000',
      VITE_DEMO_PAY_ENABLED: 'true',
      VITE_USE_MOCKS: 'false',
    });

    expect(valid.VITE_DEMO_PAY_ENABLED).toBe(true);
    expect(valid.VITE_USE_MOCKS).toBe(false);
  });
});
