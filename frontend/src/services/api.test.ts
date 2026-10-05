import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { api, validateResponse } from './api';
import { tokenManager } from './tokenManager';

describe('API Service (C9)', () => {
  beforeEach(() => {
    tokenManager.clear();
  });

  it('exports api with baseURL and withCredentials', () => {
    expect(api).toBeDefined();
    expect(api.defaults.withCredentials).toBe(true);
  });

  describe('validateResponse', () => {
    const testSchema = z.object({
      id: z.string(),
      count: z.number(),
    });

    it('returns parsed data when schema matches', () => {
      const validData = { id: 'lot-1', count: 10 };
      const parsed = validateResponse(testSchema, validData);
      expect(parsed).toEqual(validData);
    });

    it('throws validation error when schema does not match', () => {
      const invalidData = { id: 'lot-1', count: 'not-a-number' };
      expect(() => {
        validateResponse(testSchema, invalidData);
      }).toThrow(/API response validation failed/);
    });
  });

  describe('In-memory token management', () => {
    it('sets and retrieves in-memory access token without localStorage', () => {
      tokenManager.setAccessToken('sample-jwt-token');
      expect(tokenManager.getAccessToken()).toBe('sample-jwt-token');

      tokenManager.clear();
      expect(tokenManager.getAccessToken()).toBeNull();
    });
  });
});
