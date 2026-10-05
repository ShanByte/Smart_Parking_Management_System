import { PrismaClient } from '@prisma/client';

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

let testPrismaClient: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrismaClient) {
    const url = getValidatedTestDatabaseUrl();
    testPrismaClient = new PrismaClient({
      datasources: {
        db: { url },
      },
      log: ['error'],
    });
  }
  return testPrismaClient;
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
