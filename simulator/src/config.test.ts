// ==============================================================================
// config.test.ts - Unit tests for Simulator Config and Security Guardrails
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { loadConfig } from './config.js';

describe('Simulator Configuration - Safety Guardrails', () => {
  const validBaseEnv = {
    NODE_ENV: 'development',
    SIM_TARGET_URL: 'http://localhost:4000',
    SIM_ALLOWED_TARGETS: 'http://localhost:4000,http://127.0.0.1:4000',
    SIM_DEVICE_KEY: 'test-device-raw-key-123',
    SIM_SEED: '42',
    SIM_TICK_SECONDS: '2',
    DEMO_MODE: 'true',
  };

  it('loads valid configuration successfully', () => {
    const config = loadConfig(validBaseEnv);
    expect(config.targetUrl).toBe('http://localhost:4000');
    expect(config.seed).toBe(42);
    expect(config.tickSeconds).toBe(2);
    expect(config.demoMode).toBe(true);
    expect(config.deviceKey).toBe('test-device-raw-key-123');
  });

  it('refuses to start when NODE_ENV is production (Security Rule 8)', () => {
    const prodEnv = {
      ...validBaseEnv,
      NODE_ENV: 'production',
    };

    expect(() => loadConfig(prodEnv)).toThrowError(
      /SECURITY VIOLATION: Simulator refuses to start when NODE_ENV is production!/,
    );
  });

  it('refuses to start when target URL is not in SIM_ALLOWED_TARGETS (Security Rule 8)', () => {
    const disallowedEnv = {
      ...validBaseEnv,
      SIM_TARGET_URL: 'https://evil-unauthorized-target.com',
    };

    expect(() => loadConfig(disallowedEnv)).toThrowError(
      /SECURITY VIOLATION: Simulator target .* is not listed in SIM_ALLOWED_TARGETS!/,
    );
  });

  it('permits localhost and 127.0.0.1 equivalence on same port', () => {
    const env = {
      ...validBaseEnv,
      SIM_TARGET_URL: 'http://127.0.0.1:4000',
      SIM_ALLOWED_TARGETS: 'http://localhost:4000',
    };

    const config = loadConfig(env);
    expect(config.targetUrl).toBe('http://127.0.0.1:4000');
  });

  it('fails validation when required fields are missing', () => {
    const incompleteEnv = {
      NODE_ENV: 'development',
      SIM_TARGET_URL: 'http://localhost:4000',
      // Missing SIM_DEVICE_KEY and SIM_ALLOWED_TARGETS
    };

    expect(() => loadConfig(incompleteEnv)).toThrowError(/Invalid simulator configuration/);
  });
});
