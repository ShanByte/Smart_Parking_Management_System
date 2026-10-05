import { z } from 'zod';

/**
 * Frontend environment variable validation schema (C10 Frozen Contract)
 */
export const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string({
      required_error: 'VITE_API_BASE_URL is required',
    })
    .url('VITE_API_BASE_URL must be a valid URL'),
  VITE_SOCKET_URL: z
    .string({
      required_error: 'VITE_SOCKET_URL is required',
    })
    .url('VITE_SOCKET_URL must be a valid URL'),
  VITE_MAP_TILE_URL: z
    .string()
    .default('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  VITE_DEMO_PAY_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  VITE_SENTRY_DSN_FRONTEND: z.string().optional().default(''),
  VITE_USE_MOCKS: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates any given environment record.
 * Throws a clean error without printing sensitive tokens or secret values.
 */
export function validateEnv(rawEnv: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Environment validation failed: ${errorDetails}`);
  }
  return result.data;
}

let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    // In Vite, environment variables live on import.meta.env
    cachedEnv = validateEnv((import.meta as unknown as { env: Record<string, unknown> }).env || {});
  }
  return cachedEnv;
}
