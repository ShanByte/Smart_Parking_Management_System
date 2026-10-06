// ==============================================================================
// client.test.ts - Unit tests for Simulator HTTP Client against Mock Server
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { SimulatorApiClient } from './client.js';

describe('Simulator HTTP Client - Request Shape & Authentication', () => {
  let server: http.Server;
  let port: number;
  let lastReceivedHeaders: http.IncomingHttpHeaders = {};
  let lastReceivedBody: Record<string, unknown> = {};

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      lastReceivedHeaders = req.headers;

      let rawData = '';
      req.on('data', (chunk) => {
        rawData += chunk;
      });

      req.on('end', () => {
        if (rawData) {
          try {
            lastReceivedBody = JSON.parse(rawData);
          } catch {
            lastReceivedBody = { raw: rawData };
          }
        }

        if (req.url === '/api/v1/sensors/events' && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: { applied: true } }));
          return;
        }

        if (req.url === '/api/v1/parking-lots' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              data: [{ id: 'lot-1', name: 'Pune Station Lot', totalSlots: 10 }],
            }),
          );
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Not found' }));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          port = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('sends sensor event with exact Contract C7 shape and X-Device-Key header', async () => {
    const rawKey = 'sim-raw-device-key-xyz-987';
    const client = new SimulatorApiClient(`http://127.0.0.1:${port}`, rawKey);

    const result = await client.sendSensorEvent('slot-A5', 'OCCUPIED');

    expect(result).toBe(true);

    // Verify header (Security Rule 8: sent strictly as X-Device-Key)
    expect(lastReceivedHeaders['x-device-key']).toBe(rawKey);

    // Verify body payload (Contract C7: { slotId, status, timestamp })
    expect(lastReceivedBody.slotId).toBe('slot-A5');
    expect(lastReceivedBody.status).toBe('OCCUPIED');
    expect(typeof lastReceivedBody.timestamp).toBe('string');
    // Ensure timestamp is valid UTC ISO string
    expect(new Date(lastReceivedBody.timestamp as string).toISOString()).toBe(
      lastReceivedBody.timestamp,
    );
  });

  it('fetches parking lots list correctly', async () => {
    const client = new SimulatorApiClient(`http://127.0.0.1:${port}`, 'key');
    const lots = await client.getParkingLots();

    expect(lots).toHaveLength(1);
    expect(lots[0]?.id).toBe('lot-1');
    expect(lots[0]?.name).toBe('Pune Station Lot');
  });

  it('normalizes target URL when baseUrl includes trailing slashes or /api/v1 subpaths', async () => {
    const client = new SimulatorApiClient(
      `http://127.0.0.1:${port}/api/v1/sensors/events`,
      'key',
    );
    const lots = await client.getParkingLots();

    expect(lots).toHaveLength(1);
    expect(lots[0]?.id).toBe('lot-1');
  });
});
