import rateLimit from 'express-rate-limit';
import { ErrorCode } from '@smart-parking/shared';
import { env } from '../config/env.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test', // Bypass in test environments
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
