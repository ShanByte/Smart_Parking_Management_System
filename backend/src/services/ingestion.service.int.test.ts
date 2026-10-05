import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getTestPrisma, resetDb } from '../test/helpers.js';
import { ingestSensorEvent } from './ingestion.service.js';
import { SlotStatus, SlotSource } from '@smart-parking/shared';
import crypto from 'node:crypto';

describe('Stage 3 Integration Tests: Sensor Ingestion Engine', () => {
  const prisma = getTestPrisma();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestFixture() {
    const lot = await prisma.parkingLot.create({
      data: {
        name: 'FC Road Demo Lot',
        address: 'FC Road, Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        totalSlots: 5,
        pricePerHourPaise: 4000,
        isActive: true,
      },
    });

    const lot2 = await prisma.parkingLot.create({
      data: {
        name: 'MG Road Central Parking',
        address: 'MG Road, Pune',
        latitude: 18.5158,
        longitude: 73.8785,
        totalSlots: 5,
        pricePerHourPaise: 5000,
        isActive: true,
      },
    });

    const slot = await prisma.parkingSlot.create({
      data: {
        parkingLotId: lot.id,
        slotNumber: 'A1',
        status: SlotStatus.AVAILABLE,
        source: SlotSource.APP,
        statusUpdatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      },
    });

    // Device bound to lot 1
    const sensorDevice = await prisma.device.create({
      data: {
        name: 'FC Road Sensor A1',
        kind: SlotSource.SENSOR,
        parkingLotId: lot.id,
        keyHash: crypto.createHash('sha256').update('sensor-secret-key-1').digest('hex'),
        isActive: true,
      },
    });

    // Device bound to lot 2
    const wrongLotDevice = await prisma.device.create({
      data: {
        name: 'MG Road Sensor B1',
        kind: SlotSource.SENSOR,
        parkingLotId: lot2.id,
        keyHash: crypto.createHash('sha256').update('sensor-secret-key-2').digest('hex'),
        isActive: true,
      },
    });

    // Unbound device (simulator)
    const simDevice = await prisma.device.create({
      data: {
        name: 'Simulator Multi-Lot Device',
        kind: SlotSource.SIM,
        parkingLotId: null,
        keyHash: crypto.createHash('sha256').update('sim-secret-key').digest('hex'),
        isActive: true,
      },
    });

    return { lot, lot2, slot, sensorDevice, wrongLotDevice, simDevice };
  }

  it('applies a normal sensor event and updates slot status, source, and statusUpdatedAt', async () => {
    const { slot, sensorDevice } = await createTestFixture();

    const eventTime = new Date();
    const result = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'OCCUPIED',
      eventTime
    );

    expect(result.applied).toBe(true);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.OCCUPIED);
    expect(refreshedSlot?.source).toBe(SlotSource.SENSOR);
    expect(refreshedSlot?.statusUpdatedAt.getTime()).toBe(eventTime.getTime());
  });

  it('unbound device (simulator with parkingLotId=null) can send events for any lot', async () => {
    const { slot, simDevice } = await createTestFixture();

    const eventTime = new Date();
    const result = await ingestSensorEvent(
      simDevice.id,
      slot.id,
      'OCCUPIED',
      eventTime
    );

    expect(result.applied).toBe(true);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.OCCUPIED);
    expect(refreshedSlot?.source).toBe(SlotSource.SIM);
  });

  it('ignores events for slots that are HELD', async () => {
    const { slot, sensorDevice } = await createTestFixture();

    await prisma.parkingSlot.update({
      where: { id: slot.id },
      data: { status: SlotStatus.HELD, heldUntil: new Date(Date.now() + 5 * 60 * 1000) },
    });

    const eventTime = new Date();
    const result = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'OCCUPIED',
      eventTime
    );

    expect(result.applied).toBe(false);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.HELD);
  });

  it('ignores events for slots that are RESERVED', async () => {
    const { slot, sensorDevice } = await createTestFixture();

    await prisma.parkingSlot.update({
      where: { id: slot.id },
      data: { status: SlotStatus.RESERVED },
    });

    const eventTime = new Date();
    const result = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'AVAILABLE',
      eventTime
    );

    expect(result.applied).toBe(false);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.RESERVED);
  });

  it('ignores stale events older than or equal to slot statusUpdatedAt', async () => {
    const { slot, sensorDevice } = await createTestFixture();

    const oldTimestamp = new Date(slot.statusUpdatedAt.getTime() - 60 * 1000); // 1 min older
    const resultOld = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'OCCUPIED',
      oldTimestamp
    );
    expect(resultOld.applied).toBe(false);

    const equalTimestamp = new Date(slot.statusUpdatedAt.getTime());
    const resultEqual = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'OCCUPIED',
      equalTimestamp
    );
    expect(resultEqual.applied).toBe(false);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.AVAILABLE);
  });

  it('ignores events with timestamps more than 60 seconds in the future', async () => {
    const { slot, sensorDevice } = await createTestFixture();

    const futureTime = new Date(Date.now() + 75 * 1000); // 75 seconds in future
    const result = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'OCCUPIED',
      futureTime
    );

    expect(result.applied).toBe(false);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.AVAILABLE);
  });

  it('ignores wrong-lot events when device is bound to a different lot', async () => {
    const { slot, wrongLotDevice } = await createTestFixture();

    const eventTime = new Date();
    const result = await ingestSensorEvent(
      wrongLotDevice.id,
      slot.id,
      'OCCUPIED',
      eventTime
    );

    expect(result.applied).toBe(false);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.AVAILABLE);
  });

  it('ignores events for a slot whose source is GUARD while it is OCCUPIED (Amendment F3)', async () => {
    const { slot, sensorDevice } = await createTestFixture();

    // Guard manually marks slot as OCCUPIED (walk-in)
    await prisma.parkingSlot.update({
      where: { id: slot.id },
      data: {
        status: SlotStatus.OCCUPIED,
        source: SlotSource.GUARD,
        statusUpdatedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });

    const eventTime = new Date();
    // Sensor attempts to report AVAILABLE
    const result = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'AVAILABLE',
      eventTime
    );

    expect(result.applied).toBe(false);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.OCCUPIED);
    expect(refreshedSlot?.source).toBe(SlotSource.GUARD);
  });

  it('after guard frees the slot (status AVAILABLE), the next sensor event is applied and sets source from Device.kind (Amendment F3)', async () => {
    const { slot, sensorDevice } = await createTestFixture();

    // Guard frees the slot (status is now AVAILABLE, source is GUARD)
    const guardFreesTime = new Date(Date.now() - 2 * 60 * 1000);
    await prisma.parkingSlot.update({
      where: { id: slot.id },
      data: {
        status: SlotStatus.AVAILABLE,
        source: SlotSource.GUARD,
        statusUpdatedAt: guardFreesTime,
      },
    });

    // Next sensor event arrives after guard freed it
    const sensorEventTime = new Date();
    const result = await ingestSensorEvent(
      sensorDevice.id,
      slot.id,
      'OCCUPIED',
      sensorEventTime
    );

    expect(result.applied).toBe(true);

    const refreshedSlot = await prisma.parkingSlot.findUnique({
      where: { id: slot.id },
    });
    expect(refreshedSlot?.status).toBe(SlotStatus.OCCUPIED);
    expect(refreshedSlot?.source).toBe(SlotSource.SENSOR); // source transitioned from GUARD to SENSOR
    expect(refreshedSlot?.statusUpdatedAt.getTime()).toBe(sensorEventTime.getTime());
  });
});
