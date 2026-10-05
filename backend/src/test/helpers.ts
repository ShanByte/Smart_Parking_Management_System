import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Ensure root .env is loaded for tests if not already in process.env
if (!process.env.TEST_DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

/**
 * Validates that the test database URL is distinct from DATABASE_URL,
 * is hosted on localhost/127.0.0.1, and contains "test" in its database name.
 */
function getValidatedTestDatabaseUrl(): string {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  const mainDbUrl = process.env.DATABASE_URL;

  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL is not set. Refusing to run resetDb.');
  }

  if (mainDbUrl && testDbUrl === mainDbUrl) {
    throw new Error(
      'TEST_DATABASE_URL must be a different database from DATABASE_URL. Refusing to run resetDb.'
    );
  }

  try {
    const parsed = new URL(testDbUrl);
    const host = parsed.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      throw new Error(`Test database host must be localhost or 127.0.0.1 (got: ${host})`);
    }

    const dbName = parsed.pathname.replace(/^\//, '');
    if (!dbName.toLowerCase().includes('test')) {
      throw new Error(
        `Test database name must contain "test" for safety (got: "${dbName}"). Refusing to run resetDb.`
      );
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Refusing to run')) {
      throw err;
    }
    throw new Error(`Invalid TEST_DATABASE_URL format: ${err instanceof Error ? err.message : String(err)}`);
  }

  return testDbUrl;
}

import { prisma } from '../lib/prisma.js';

export function getTestPrisma(): PrismaClient {
  getValidatedTestDatabaseUrl();
  return prisma;
}

/**
 * Resets the test database by truncating all tables.
 * Refuses to run unless TEST_DATABASE_URL is verified safe.
 */
export async function resetDb(): Promise<void> {
  const client = getTestPrisma();

  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog",
      "WebhookEvent",
      "RefreshToken",
      "OccupancyRecord",
      "Payment",
      "Booking",
      "Device",
      "ParkingSlot",
      "User",
      "ParkingLot"
    CASCADE;
  `);
}
