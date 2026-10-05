import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from './authSchemas';

describe('Auth Zod Schemas Validation (C7 Contract)', () => {
  describe('loginSchema', () => {
    it('rejects empty inputs', () => {
      const result = loginSchema.safeParse({ email: '', password: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format().email?._errors[0]).toBe('Email address is required');
        expect(result.error.format().password?._errors[0]).toBe('Password is required');
      }
    });

    it('rejects invalid email formats', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email-string',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format().email?._errors[0]).toBe('Please enter a valid email address');
      }
    });

    it('rejects passwords shorter than 8 characters', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format().password?._errors[0]).toBe(
          'Password must be at least 8 characters long'
        );
      }
    });

    it('accepts valid credentials and normalizes email to lowercase', () => {
      const result = loginSchema.safeParse({
        email: '  USER@Example.COM  ',
        password: 'password123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
        expect(result.data.password).toBe('password123');
      }
    });
  });

  describe('registerSchema', () => {
    it('rejects names shorter than 2 characters', () => {
      const result = registerSchema.safeParse({
        name: 'A',
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format().name?._errors[0]).toBe(
          'Full name must be at least 2 characters'
        );
      }
    });

    it('accepts valid registration input', () => {
      const result = registerSchema.safeParse({
        name: 'Rohan Sharma',
        email: 'rohan@example.com',
        password: 'securePassword123',
      });
      expect(result.success).toBe(true);
    });
  });
});
