import rateLimit from 'express-rate-limit';
import { ErrorCode } from '@smart-parking/shared';
import { env } from '../config/env.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'development' ? 500 : 30, // Generous limit in dev to allow demo switching
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (env.NODE_ENV === 'test') return true;
    if (env.NODE_ENV === 'development') {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
      if (
        email.endsWith('@example.com') ||
        email === 'driver@example.com' ||
        email === 'guard@example.com' ||
        email === 'admin@example.com' ||
        req.path === '/refresh' ||
        req.originalUrl?.includes('/refresh')
      ) {
        return true;
      }
    }
    return false;
  },
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    code: ErrorCode.RATE_LIMITED,
  },
});

export const paymentsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test', // Bypass in test environments
  message: {
    success: false,
    message: 'Too many payment requests. Please try again later.',
    code: ErrorCode.RATE_LIMITED,
  },
});

export const sensorsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per device
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  keyGenerator: (req) => (req.headers['x-device-key'] as string) || req.ip || 'unknown',
  message: {
    success: false,
    message: 'Too many sensor events from this device. Please rate limit.',
    code: ErrorCode.RATE_LIMITED,
  },
});

export const guardCheckInRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 check-in attempts per minute to prevent code guessing
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many check-in attempts. Please try again shortly.',
    code: ErrorCode.RATE_LIMITED,
  },
});

export const availabilityRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  message: {
    success: false,
    message: 'Too many availability requests. Please slow down.',
    code: ErrorCode.RATE_LIMITED,
  },
});

