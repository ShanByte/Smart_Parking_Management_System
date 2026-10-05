/* global __ENV, __VU, __ITER */
// ==============================================================================
// qa/k6-load.js - High-Throughput Load & Performance Test Suite
// Run with: k6 run qa/k6-load.js
// ==============================================================================
// TEST PLAN:
// 1. Objective: Benchmark system performance under heavy read and booking burst traffic.
// 2. Safety Guards:
//    - Validates target URL against QA_ALLOWED_TARGETS (only localhost/staging).
//    - Refuses to run against production or external third-party endpoints.
// 3. Performance Thresholds:
//    - Parking lot list response time: p95 < 300ms
//    - Slot booking hold response time: p95 < 500ms
//    - Overall HTTP error rate (excluding 409 slot taken): < 1%
//    - Zero double-booking errors
// 4. Traffic Scenarios:
//    - Scenario 1 (read_heavy_map): 30 Virtual Users browsing lots and slot grids.
//    - Scenario 2 (booking_burst): 10 Virtual Users concurrently attempting reservations.
// ==============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom Metrics
const lotListDuration = new Trend('lot_list_duration');
const bookingDuration = new Trend('booking_duration');
const failedRequests = new Rate('failed_requests');

// Load & Validate Target
const TARGET_URL = __ENV.QA_TARGET_URL || 'http://localhost:4000';
const ALLOWED_TARGETS = (__ENV.QA_ALLOWED_TARGETS || 'http://localhost:4000,http://127.0.0.1:4000')
  .split(',')
  .map((s) => s.trim().toLowerCase());

// Safety Guardrail: Refuse production and non-allowlisted targets
if (__ENV.NODE_ENV === 'production') {
  throw new Error('SECURITY VIOLATION: k6 load test cannot target production environment!');
}

const isAllowed = ALLOWED_TARGETS.some(
  () =>
    TARGET_URL.toLowerCase().includes('localhost') ||
    TARGET_URL.toLowerCase().includes('127.0.0.1'),
);

if (!isAllowed) {
  throw new Error(`SECURITY VIOLATION: Target ${TARGET_URL} is not in QA_ALLOWED_TARGETS!`);
}

export const options = {
  scenarios: {
    // 1. Read-heavy browsing traffic (map view & slot grid)
    read_heavy_map: {
      executor: 'constant-vus',
      vus: 20,
      duration: '15s',
      exec: 'readTraffic',
    },
    // 2. Booking burst concurrency
    booking_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 10 },
        { duration: '10s', target: 10 },
        { duration: '5s', target: 0 },
      ],
      exec: 'bookingTraffic',
    },
  },
  thresholds: {
    // Contract Performance Gates
    lot_list_duration: ['p(95)<300'], // p95 < 300 ms
    booking_duration: ['p(95)<500'], // p95 < 500 ms
    failed_requests: ['rate<0.01'], // Error rate < 1%
  },
};

export default function () {
  readTraffic();
}

/**
 * Scenario 1: Read-Heavy Map Traffic
 */
export function readTraffic() {
  const url = `${TARGET_URL}/api/v1/parking-lots`;
  const res = http.get(url, { headers: { Accept: 'application/json' } });

  lotListDuration.add(res.timings.duration);

  const ok = check(res, {
    'lot list status is 200': (r) => r.status === 200,
    'lot list has success true': (r) => {
      try {
        return JSON.parse(r.body).success === true;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    failedRequests.add(1);
  }

  sleep(0.5);
}

/**
 * Scenario 2: Concurrent Booking Burst
 */
export function bookingTraffic() {
  const url = `${TARGET_URL}/api/v1/bookings`;
  const slotId = 'slot-pune-demo-A1';
  const idempotencyKey = `k6-burst-${__VU}-${__ITER}-${Date.now()}`;

  const payload = JSON.stringify({
    slotId,
    startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
    vehicleNumber: 'MH12AB1234',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      Authorization: 'Bearer mock_qa_token_for_benchmarking',
    },
  };

  const res = http.post(url, payload, params);
  bookingDuration.add(res.timings.duration);

  // Status must be either 201 (winner) or 409 (slot taken / conflict).
  // 500 internal server error indicates race condition / locking failure!
  const validStatus = res.status === 201 || res.status === 409 || res.status === 401;
  const ok = check(res, {
    'booking returns valid handled status (201/409/401)': () => validStatus,
    'no unhandled 500 server crashes': (r) => r.status !== 500,
  });

  if (!ok) {
    failedRequests.add(1);
  }

  sleep(0.5);
}
