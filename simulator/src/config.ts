// ==============================================================================
// config.ts - Member 4: Simulator Configuration & Security Guardrails
// Security Rule 8: Refuses production, validates allowlisted target, protects key
// ==============================================================================

import { z } from 'zod';

export interface SimulatorConfig {
  nodeEnv: string;
  targetUrl: string;
  allowedTargets: string[];
  deviceKey: string;
  seed: number;
  tickSeconds: number;
  demoMode: boolean;
}

const RawEnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  SIM_TARGET_URL: z.string().url('SIM_TARGET_URL must be a valid URL'),
  SIM_ALLOWED_TARGETS: z.string().min(1, 'SIM_ALLOWED_TARGETS is required'),
  SIM_DEVICE_KEY: z.string().min(1, 'SIM_DEVICE_KEY is required'),
  SIM_SEED: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 42)),
  SIM_TICK_SECONDS: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 2)),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
});

function normalizeOrigin(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.origin.toLowerCase();
  } catch {
    return urlStr.trim().toLowerCase();
  }
}

/**
 * Loads, validates, and enforces safety guardrails on simulator configuration.
 *
 * @throws {Error} if NODE_ENV is production
 * @throws {Error} if target URL is not present in SIM_ALLOWED_TARGETS
 */
export function loadConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): SimulatorConfig {
  const parsed = RawEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid simulator configuration: ${issues}`);
  }

  const {
    NODE_ENV,
    SIM_TARGET_URL,
    SIM_ALLOWED_TARGETS,
    SIM_DEVICE_KEY,
    SIM_SEED,
    SIM_TICK_SECONDS,
    DEMO_MODE,
  } = parsed.data;

  // Security Rule 8: Production Refusal
  if (NODE_ENV.toLowerCase() === 'production') {
    throw new Error('SECURITY VIOLATION: Simulator refuses to start when NODE_ENV is production!');
  }

  const allowedOrigins = SIM_ALLOWED_TARGETS.split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  const targetOrigin = normalizeOrigin(SIM_TARGET_URL);

  // Security Rule 8: Allowed Targets Allowlist
  const isAllowed = allowedOrigins.some((allowed) => {
    if (allowed === targetOrigin) return true;
    // Allow localhost/127.0.0.1 equivalence for developer convenience
    if (
      (targetOrigin.includes('localhost') || targetOrigin.includes('127.0.0.1')) &&
      (allowed.includes('localhost') || allowed.includes('127.0.0.1'))
    ) {
      const portA = new URL(SIM_TARGET_URL).port;
      const portB = new URL(allowed).port;
      return portA === portB;
    }
    return false;
  });

  if (!isAllowed) {
    throw new Error(
      `SECURITY VIOLATION: Simulator target '${SIM_TARGET_URL}' is not listed in SIM_ALLOWED_TARGETS! Refusing to start.`,
    );
  }

  return {
    nodeEnv: NODE_ENV,
    targetUrl: SIM_TARGET_URL.replace(/\/+$/, ''), // strip trailing slash
    allowedTargets: allowedOrigins,
    deviceKey: SIM_DEVICE_KEY, // strictly never printed or logged
    seed: SIM_SEED,
    tickSeconds: SIM_TICK_SECONDS,
    demoMode: DEMO_MODE,
  };
}
