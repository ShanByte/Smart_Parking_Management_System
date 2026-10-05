import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@smart-parking/shared';
import { env } from '../config/env.js';

// Pre-computed bcrypt cost 12 dummy hash for unknown email timing-attack mitigation (Rule 4)
export const DUMMY_PASSWORD_HASH =
  '$2a$12$e8m4wW1sNlP.lB5Gq8Q8xuxB7w2z2QzZ1kQc6j6ZlV2P1a1b1c1d1';

const BCRYPT_SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates an opaque refresh token of 48 random bytes encoded in base64url (Rule 5)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Computes SHA-256 hex digest of a token or device key (Rules 5 & 10)
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessTokenJwt(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
  }) as AccessTokenPayload;
}

/**
 * Verifies Razorpay payment signature using HMAC-SHA256 and timing-safe comparison (Security Rule 9)
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }
  const payload = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const genBuffer = Buffer.from(generatedSignature, 'utf8');
  if (sigBuffer.length !== genBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, genBuffer);
}

/**
 * Verifies Razorpay webhook signature using HMAC-SHA256 and timing-safe comparison (Security Rule 9)
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string
): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(bodyBuffer)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const genBuffer = Buffer.from(generatedSignature, 'utf8');
  if (sigBuffer.length !== genBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, genBuffer);
}
