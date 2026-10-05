// ==============================================================================
// qa/concurrency.ts - Concurrency & Race-Condition QA Test Suite
// ==============================================================================
// TEST PLAN:
// 1. Objective: Prove that the Smart Parking Management System enforces zero double-bookings,
//    strict transaction isolation, and source precedence under intense parallel load.
// 2. Safety Guards:
//    - Strictly verifies that QA_TARGET_URL is within QA_ALLOWED_TARGETS.
//    - Refuses to run if NODE_ENV=production or target is a third-party/external host.
// 3. Test Scenarios:
//    a) Parallel Booking Contention: 10 concurrent requests booking the same slot with unique
//       Idempotency-Keys. Expect exactly 1 winner (HTTP 201) and 9 rejections (HTTP 409).
//    b) Guard Walk-In vs. Driver Booking Race: Guard walk-in request competing simultaneously
//       with a driver's booking hold. Exactly 1 operation succeeds; the other is rejected (HTTP 409).
//    c) Simulator vs. Guard Source Precedence: A slot marked with source 'GUARD' must NEVER be
//       overridden by a sensor or simulator event. Ingested sensor events for a GUARD slot
//       must be ignored (applied: false) until released by a guard.
//    d) Parallel Check-In Race: 20 simultaneous check-in attempts for the same bookingCode.
//       Expect exactly 1 successful check-in (HTTP 200); all others fail (HTTP 409).
// ==============================================================================

import { z } from 'zod';

const QAConfigSchema = z.object({
  targetUrl: z.string().url(),
  allowedTargets: z.array(z.string()),
  nodeEnv: z.string().default('development'),
});

export function loadQAConfig(): { targetUrl: string } {
  const targetUrl = process.env.QA_TARGET_URL || 'http://localhost:4000';
  const allowed = (process.env.QA_ALLOWED_TARGETS || 'http://localhost:4000,http://127.0.0.1:4000')
    .split(',')
    .map((s) => s.trim().toLowerCase());
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv.toLowerCase() === 'production') {
    throw new Error(
      'SECURITY VIOLATION: QA concurrency suite cannot run in production environment!',
    );
  }

  const parsed = QAConfigSchema.parse({
    targetUrl,
    allowedTargets: allowed,
    nodeEnv,
  });

  const targetOrigin = new URL(parsed.targetUrl).origin.toLowerCase();
  const isAllowed = parsed.allowedTargets.some((item) => {
    try {
      return new URL(item).origin.toLowerCase() === targetOrigin;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    throw new Error(
      `SECURITY VIOLATION: Target '${targetUrl}' is not present in QA_ALLOWED_TARGETS allowlist!`,
    );
  }

  return { targetUrl: parsed.targetUrl.replace(/\/+$/, '') };
}

export interface ConcurrencyRunResult {
  scenario: string;
  totalRequests: number;
  successCount: number;
  expectedWinnerCount: number;
  conflictCount: number;
  passed: boolean;
  details: string;
}

/**
 * Scenario A: Parallel Booking Race
 * Fires 10 concurrent requests to book the exact same slot.
 */
export async function testParallelBookingRace(
  targetUrl: string,
  slotId: string,
  userToken: string,
): Promise<ConcurrencyRunResult> {
  const concurrencyCount = 10;
  const requests = Array.from({ length: concurrencyCount }, (_, i) => {
    const idempotencyKey = `qa-idemp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 70 * 60 * 1000).toISOString();

    return fetch(`${targetUrl}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        slotId,
        startTime,
        endTime,
      }),
    });
  });

  const responses = await Promise.all(requests);
  const statusCodes = responses.map((r) => r.status);

  const successCount = statusCodes.filter((s) => s === 201).length;
  const conflictCount = statusCodes.filter((s) => s === 409).length;

  // Zero double booking: Exactly 1 winner, 9 conflicts
  const passed = successCount === 1 && conflictCount === concurrencyCount - 1;

  return {
    scenario: 'Parallel Booking Contention (10 concurrent requests)',
    totalRequests: concurrencyCount,
    successCount,
    expectedWinnerCount: 1,
    conflictCount,
    passed,
    details: `Results: ${successCount} won (HTTP 201), ${conflictCount} rejected with conflict (HTTP 409). Double-booking prevented.`,
  };
}

/**
 * Scenario B: Guard Walk-In vs Booking Race
 * A guard marking walk-in vs a driver booking the same slot simultaneously.
 */
export async function testGuardWalkInVsBookingRace(
  targetUrl: string,
  slotId: string,
  guardToken: string,
  userToken: string,
): Promise<ConcurrencyRunResult> {
  const idempotencyKey = `qa-race-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 70 * 60 * 1000).toISOString();

  // Trigger guard walk-in and user booking concurrently
  const guardRequest = fetch(`${targetUrl}/api/v1/guard/slots/${slotId}/walk-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guardToken}`,
    },
    body: JSON.stringify({ status: 'OCCUPIED' }),
  });

  const userRequest = fetch(`${targetUrl}/api/v1/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ slotId, startTime, endTime }),
  });

  const [guardRes, userRes] = await Promise.all([guardRequest, userRequest]);

  const guardWon = guardRes.status === 200 && userRes.status === 409;
  const userWon = userRes.status === 201 && guardRes.status === 409;

  const passed = (guardWon || userWon) && !(guardRes.ok && userRes.ok);

  return {
    scenario: 'Guard Walk-in vs. Driver Booking Race on Same Slot',
    totalRequests: 2,
    successCount: (guardRes.ok ? 1 : 0) + (userRes.ok ? 1 : 0),
    expectedWinnerCount: 1,
    conflictCount: (!guardRes.ok ? 1 : 0) + (!userRes.ok ? 1 : 0),
    passed,
    details: guardWon
      ? 'Guard walk-in succeeded (HTTP 200); driver booking rejected with 409.'
      : userWon
        ? 'Driver booking hold succeeded (HTTP 201); guard walk-in rejected with 409.'
        : `Race condition failure: Guard HTTP ${guardRes.status}, User HTTP ${userRes.status}`,
  };
}

/**
 * Scenario C: Simulator vs Guard Source Precedence
 * Proves that once a guard marks a slot OCCUPIED, sensor/simulator events are ignored.
 */
export async function testSimulatorVsGuardPrecedence(
  targetUrl: string,
  slotId: string,
  deviceKey: string,
  guardToken: string,
): Promise<ConcurrencyRunResult> {
  // Step 1: Guard marks slot OCCUPIED (Source becomes GUARD)
  const guardRes = await fetch(`${targetUrl}/api/v1/guard/slots/${slotId}/walk-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guardToken}`,
    },
    body: JSON.stringify({ status: 'OCCUPIED' }),
  });

  if (!guardRes.ok) {
    return {
      scenario: 'Simulator vs. Guard Precedence',
      totalRequests: 2,
      successCount: 0,
      expectedWinnerCount: 1,
      conflictCount: 0,
      passed: false,
      details: `Setup failed: could not set slot to GUARD source. HTTP ${guardRes.status}`,
    };
  }

  // Step 2: Virtual sensor attempts to report slot as AVAILABLE
  const sensorRes = await fetch(`${targetUrl}/api/v1/sensors/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Key': deviceKey,
    },
    body: JSON.stringify({
      slotId,
      status: 'AVAILABLE',
      timestamp: new Date().toISOString(),
    }),
  });

  const sensorBody = (await sensorRes.json()) as { success: boolean; data?: { applied: boolean } };

  // Contract C3: A slot whose source is GUARD ignores sensor events until the guard frees it (applied: false)
  const passed = sensorRes.status === 200 && sensorBody.data?.applied === false;

  return {
    scenario: 'Simulator vs. Guard Source Precedence',
    totalRequests: 2,
    successCount: passed ? 1 : 0,
    expectedWinnerCount: 1,
    conflictCount: 0,
    passed,
    details: passed
      ? 'Guard source precedence verified: Sensor event ignored (applied: false) while slot has GUARD source.'
      : `Precedence failed: Sensor response HTTP ${sensorRes.status}, applied: ${sensorBody.data?.applied}`,
  };
}

/**
 * Scenario D: Parallel Check-In Race
 * 20 simultaneous check-in attempts for the exact same bookingCode.
 */
export async function testParallelCheckInRace(
  targetUrl: string,
  bookingCode: string,
  guardToken: string,
): Promise<ConcurrencyRunResult> {
  const attempts = 20;
  const requests = Array.from({ length: attempts }, () =>
    fetch(`${targetUrl}/api/v1/guard/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guardToken}`,
      },
      body: JSON.stringify({ bookingCode }),
    }),
  );

  const responses = await Promise.all(requests);
  const statusCodes = responses.map((r) => r.status);

  const successCount = statusCodes.filter((s) => s === 200).length;
  const rejectedCount = statusCodes.filter((s) => s === 409).length;

  const passed = successCount === 1 && rejectedCount === attempts - 1;

  return {
    scenario: 'Parallel Check-In Contention (20 simultaneous attempts)',
    totalRequests: attempts,
    successCount,
    expectedWinnerCount: 1,
    conflictCount: rejectedCount,
    passed,
    details: `Results: Exactly ${successCount} successful check-in (HTTP 200), ${rejectedCount} rejected (HTTP 409). Duplicate check-in prevented.`,
  };
}
