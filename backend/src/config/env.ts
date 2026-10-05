import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().optional(),
    DIRECT_URL: z.string().optional(),
    TEST_DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .refine(
        (val) => !val.split(',').map((origin) => origin.trim()).includes('*'),
        { message: 'CORS_ORIGINS must not contain "*"' }
      ),
    TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
      .default('default_jwt_access_secret_min_32_characters_for_local_dev'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).default('lax'),
    COOKIE_DOMAIN: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    DEMO_PAY_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((val) => val === 'true'),
    SENTRY_DSN_BACKEND: z.string().optional(),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),
    SEED_GUARD_EMAIL: z.string().email().optional(),
    SEED_GUARD_PASSWORD: z.string().optional(),
    NO_SHOW_GRACE_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .refine(
    (data) => !(data.NODE_ENV === 'production' && data.DEMO_PAY_ENABLED),
    {
      message: 'DEMO_PAY_ENABLED=true while NODE_ENV=production is strictly prohibited',
      path: ['DEMO_PAY_ENABLED'],
    }
  );

export type EnvConfig = z.infer<typeof envSchema>;

function loadEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Security Rule 2: list only variable NAMES that are missing or invalid, NEVER their values
    const failedVarNames = result.error.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `[FATAL] Environment validation failed. Invalid or missing variables: [${failedVarNames}]`
    );
  }
  return result.data;
}

export const env = loadEnv();
