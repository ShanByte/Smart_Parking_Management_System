import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { getTestPrisma, resetDb } from './test/helpers.js';
import { signAccessToken } from './lib/crypto.js';
import { Role, ErrorCode } from '@smart-parking/shared';

describe('Stage 3 Integration Tests: Real Database Booking & Lot Endpoints', () => {
  const prisma = getTestPrisma();
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('performs end-to-end booking hold, retrieval, and cancellation against real test database', async () => {
    // 1. Seed user, lot, slot in database
    const user = await prisma.user.create({
      data: {
        name: 'Integration Driver',
        email: 'driver_int@example.com',
        passwordHash: 'dummyhash',
        role: 'USER',
      },
    });

    const otherUser = await prisma.user.create({
      data: {
        name: 'Other Driver',
        email: 'other_int@example.com',
        passwordHash: 'dummyhash',
        role: 'USER',
      },
    });

    const lot = await prisma.parkingLot.create({
      data: {
        name: 'Shivajinagar Station Lot',
        address: 'Shivajinagar, Pune',
        latitude: 18.53,
        longitude: 73.85,
        totalSlots: 10,
        pricePerHourPaise: 4000,
        isActive: true,
      },
    });

    const slot = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lot.id,
        slotNumber: 'B1',
        status: 'AVAILABLE',
        source: 'APP',
      },
    });

    const token = signAccessToken({ sub: user.id, role: Role.USER });
    const otherToken = signAccessToken({ sub: otherUser.id, role: Role.USER });

    // 2. Read parking lots via GET /api/v1/parking-lots
    const lotsRes = await request(app).get('/api/v1/parking-lots');
    expect(lotsRes.status).toBe(200);
    expect(lotsRes.body.data.length).toBeGreaterThan(0);
    const foundLot = lotsRes.body.data.find((l: { id: string }) => l.id === lot.id);
    expect(foundLot).toBeDefined();
    expect(foundLot.freeCount).toBe(1);

    // 3. Create booking hold via POST /api/v1/bookings
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const endTime = new Date(now.getTime() + 70 * 60 * 1000).toISOString();

    const bookRes = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('idempotency-key', 'idem-int-test-12345')
      .send({
        slotId: slot.id,
        startTime,
        endTime,
        vehicleNumber: 'MH12CD5678',
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.data.status).toBe('HELD');
    expect(bookRes.body.data.slotId).toBe(slot.id);
    const bookingId = bookRes.body.data.id;

    // 4. Retrieve user bookings via GET /api/v1/bookings/my
    const myRes = await request(app)
      .get('/api/v1/bookings/my')
      .set('Authorization', `Bearer ${token}`);

    expect(myRes.status).toBe(200);
    expect(myRes.body.data.length).toBe(1);
    expect(myRes.body.data[0].id).toBe(bookingId);

    // 5. Verify ownership check: other user cannot cancel this booking
    const unauthorizedCancel = await request(app)
      .delete(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(unauthorizedCancel.status).toBe(404);
    expect(unauthorizedCancel.body.code).toBe(ErrorCode.NOT_FOUND);

    // 6. User cancels their own booking via DELETE /api/v1/bookings/:id
    const cancelRes = await request(app)
      .delete(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
  });
});
