import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Ensure root .env is loaded if not already present in process.env
if (!process.env.DATABASE_URL || !process.env.TEST_DATABASE_URL) {
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
 * Shared Prisma Client singleton per FROZEN CONTRACT C3
 */
declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const isTest = process.env.NODE_ENV === 'test';
const datasourceUrl =
  isTest && process.env.TEST_DATABASE_URL
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
