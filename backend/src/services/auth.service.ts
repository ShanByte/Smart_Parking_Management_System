import { Role, ErrorCode, UserView, LoginResponseData, RegisterResponseData, RefreshResponseData } from '@smart-parking/shared';
import { prisma } from '../lib/prisma.js';
import {
  hashPassword,
  comparePassword,
  generateRefreshToken,
  hashToken,
  signAccessToken,
  DUMMY_PASSWORD_HASH,
} from '../lib/crypto.js';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../lib/errors.js';
import { env } from '../config/env.js';

export interface AuthTokens {
  accessToken: string;
  expiresInSeconds: number;
  rawRefreshToken: string;
}

function toUserView(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedLotId: string | null;
  createdAt: Date;
}): UserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as unknown as Role,
    assignedLotId: user.assignedLotId,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Register a new user with bcrypt-hashed password (Security Rule 4)
 */
export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<RegisterResponseData> {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError(ErrorCode.CONFLICT, 'Email is already registered');
  }

  const passwordHash = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: Role.USER,
    },
  });

  return {
    user: toUserView(newUser),
  };
}

/**
 * Login user, mitigating timing attacks via dummy hash (Security Rule 4 & 5)
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ authData: LoginResponseData; rawRefreshToken: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Run comparison against dummy hash to prevent email enumeration via response timing
    await comparePassword(password, DUMMY_PASSWORD_HASH);
    throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Invalid email or password');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Invalid email or password');
  }

  // Generate and store refresh token hash (Security Rule 5)
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role as unknown as Role,
  });

  return {
    authData: {
      accessToken,
      expiresInSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      user: toUserView(user),
    },
    rawRefreshToken,
  };
}

/**
 * Rotate refresh token with reuse detection (Security Rule 5)
 */
export async function rotateRefreshToken(
  rawRefreshToken: string
): Promise<{ authData: RefreshResponseData; rawRefreshToken: string }> {
  if (!rawRefreshToken) {
    throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Refresh token is required');
  }

  const tokenHash = hashToken(rawRefreshToken);

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Invalid refresh token');
  }

  // Reuse detection: If a revoked token is presented, revoke all refresh tokens for that user!
  if (tokenRecord.revokedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    throw new UnauthorizedError(
      ErrorCode.UNAUTHORIZED,
      'Refresh token has already been used and revoked. All active sessions terminated.'
    );
  }

  // Check expiration
  if (tokenRecord.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Refresh token has expired');
  }

  // Revoke current token (rotation)
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() },
  });

  // Issue new refresh token
  const newRawRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: tokenRecord.userId,
      tokenHash: newTokenHash,
      expiresAt,
    },
  });

  const accessToken = signAccessToken({
    sub: tokenRecord.user.id,
    role: tokenRecord.user.role as unknown as Role,
  });

  return {
    authData: {
      accessToken,
      expiresInSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      user: toUserView(tokenRecord.user),
    },
    rawRefreshToken: newRawRefreshToken,
  };
}

/**
 * Revoke refresh token on logout (Security Rule 5)
 */
export async function logoutUser(rawRefreshToken?: string): Promise<void> {
  if (!rawRefreshToken) {
    return;
  }
  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Fetch current user profile
 */
export async function getCurrentUser(userId: string): Promise<UserView> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, 'User not found');
  }

  return toUserView(user);
}
