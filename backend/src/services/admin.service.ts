import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { hashToken } from '../lib/crypto.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import {
  ErrorCode,
  Role,
  SlotStatus,
  SlotSource,
  BookingStatus,
  CreateLotRequest,
  UpdateLotRequest,
  CreateDeviceRequest,
  ParkingLotView,
  SlotView,
  BookingView,
  UserView,
  DeviceView,
  AuditLogView,
} from '@smart-parking/shared';
import { createAuditLog } from './audit.service.js';
import { emitSlotUpdated, emitLotUpdated } from '../sockets/index.js';

export async function adminCreateLot(
  adminId: string,
  data: CreateLotRequest
): Promise<ParkingLotView> {
  return prisma.$transaction(async (tx) => {
    const lot = await tx.parkingLot.create({
      data: {
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        totalSlots: data.totalSlots,
        pricePerHourPaise: data.pricePerHourPaise,
        isActive: true,
      },
    });

    await createAuditLog(
      {
        adminId,
        action: 'CREATE_LOT',
        targetType: 'ParkingLot',
        targetId: lot.id,
        details: { name: lot.name, totalSlots: lot.totalSlots },
      },
      tx
    );

    return {
      id: lot.id,
      name: lot.name,
      address: lot.address,
      latitude: lot.latitude,
      longitude: lot.longitude,
      totalSlots: lot.totalSlots,
      pricePerHourPaise: lot.pricePerHourPaise,
      isActive: lot.isActive,
    };
  });
}

export async function adminUpdateLot(
  adminId: string,
  lotId: string,
  data: UpdateLotRequest
): Promise<ParkingLotView> {
  const existing = await prisma.parkingLot.findUnique({ where: { id: lotId } });
  if (!existing) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking lot with ID '${lotId}' not found`);
  }

  return prisma.$transaction(async (tx) => {
    const lot = await tx.parkingLot.update({
      where: { id: lotId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.totalSlots !== undefined && { totalSlots: data.totalSlots }),
        ...(data.pricePerHourPaise !== undefined && { pricePerHourPaise: data.pricePerHourPaise }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await createAuditLog(
      {
        adminId,
        action: 'UPDATE_LOT',
        targetType: 'ParkingLot',
        targetId: lot.id,
        details: data as Record<string, unknown>,
      },
      tx
    );

    return {
      id: lot.id,
      name: lot.name,
      address: lot.address,
      latitude: lot.latitude,
      longitude: lot.longitude,
      totalSlots: lot.totalSlots,
      pricePerHourPaise: lot.pricePerHourPaise,
      isActive: lot.isActive,
    };
  });
}

export async function adminDeleteLot(
  adminId: string,
  lotId: string
): Promise<{ deactivated: boolean; lotId: string }> {
  const existing = await prisma.parkingLot.findUnique({ where: { id: lotId } });
  if (!existing) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking lot with ID '${lotId}' not found`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.parkingLot.update({
      where: { id: lotId },
      data: { isActive: false },
    });

    await createAuditLog(
      {
        adminId,
        action: 'DEACTIVATE_LOT',
        targetType: 'ParkingLot',
        targetId: lotId,
        details: { name: existing.name },
      },
      tx
    );
  });

  return { deactivated: true, lotId };
}

export async function adminGenerateSlots(
  adminId: string,
  lotId: string,
  count: number
): Promise<{ count: number; slots: SlotView[] }> {
  const lot = await prisma.parkingLot.findUnique({
    where: { id: lotId },
    include: { slots: { select: { slotNumber: true } } },
  });
  if (!lot) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking lot with ID '${lotId}' not found`);
  }

  const existingNumbers = new Set(lot.slots.map((s) => s.slotNumber));
  const newSlotsData: Array<{ parkingLotId: string; slotNumber: string; status: SlotStatus; source: SlotSource }> = [];

  let candidateNum = 1;
  while (newSlotsData.length < count) {
    const slotNumber = `A${candidateNum}`;
    if (!existingNumbers.has(slotNumber)) {
      newSlotsData.push({
        parkingLotId: lotId,
        slotNumber,
        status: SlotStatus.AVAILABLE,
        source: SlotSource.APP,
      });
      existingNumbers.add(slotNumber);
    }
    candidateNum++;
  }

  return prisma.$transaction(async (tx) => {
    await tx.parkingSlot.createMany({
      data: newSlotsData,
    });

    const updatedTotalSlots = lot.slots.length + count;
    await tx.parkingLot.update({
      where: { id: lotId },
      data: { totalSlots: updatedTotalSlots },
    });

    const createdSlots = await tx.parkingSlot.findMany({
      where: {
        parkingLotId: lotId,
        slotNumber: { in: newSlotsData.map((s) => s.slotNumber) },
      },
      select: { id: true, slotNumber: true, status: true },
    });

    await createAuditLog(
      {
        adminId,
        action: 'GENERATE_SLOTS',
        targetType: 'ParkingLot',
        targetId: lotId,
        details: { count, totalSlots: updatedTotalSlots },
      },
      tx
    );

    return {
      count,
      slots: createdSlots.map((s) => ({
        id: s.id,
        slotNumber: s.slotNumber,
        status: s.status as SlotStatus,
      })),
    };
  });
}

export async function adminReleaseSlot(
  adminId: string,
  slotId: string
): Promise<{ released: boolean; slotId: string }> {
  const slot = await prisma.parkingSlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Parking slot with ID '${slotId}' not found`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.parkingSlot.update({
      where: { id: slotId },
      data: {
        status: SlotStatus.AVAILABLE,
        source: SlotSource.APP,
        heldUntil: null,
        statusUpdatedAt: new Date(),
      },
    });

    await createAuditLog(
      {
        adminId,
        action: 'RELEASE_SLOT',
        targetType: 'ParkingSlot',
        targetId: slotId,
        details: { previousStatus: slot.status, lotId: slot.parkingLotId },
      },
      tx
    );
  });

  emitSlotUpdated({
    slotId,
    parkingLotId: slot.parkingLotId,
    status: SlotStatus.AVAILABLE,
  });

  const availableCount = await prisma.parkingSlot.count({
    where: { parkingLotId: slot.parkingLotId, status: SlotStatus.AVAILABLE },
  });
  const totalCount = await prisma.parkingSlot.count({
    where: { parkingLotId: slot.parkingLotId },
  });
  emitLotUpdated({
    parkingLotId: slot.parkingLotId,
    freeCount: availableCount,
    totalSlots: totalCount,
  });

  return { released: true, slotId };
}

export async function adminGetBookings(status?: BookingStatus): Promise<BookingView[]> {
  const bookings = await prisma.booking.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return bookings.map((b) => ({
    id: b.id,
    slotId: b.slotId,
    status: b.status as BookingStatus,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    amountPaise: b.amountPaise,
    heldUntil: b.heldUntil ? b.heldUntil.toISOString() : null,
    bookingCode: b.bookingCode,
    vehicleNumber: b.vehicleNumber,
    checkedInAt: b.checkedInAt ? b.checkedInAt.toISOString() : null,
  }));
}

export async function adminGetUsers(): Promise<UserView[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      assignedLotId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    assignedLotId: u.assignedLotId,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function adminUpdateUserRole(
  adminId: string,
  targetUserId: string,
  role: Role,
  assignedLotId?: string | null
): Promise<UserView> {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `User with ID '${targetUserId}' not found`);
  }

  let finalAssignedLotId: string | null = null;
  if (role === Role.GUARD) {
    if (!assignedLotId) {
      throw new ValidationError(
        ErrorCode.VALIDATION_ERROR,
        'assignedLotId is required when assigning role GUARD'
      );
    }
    const lot = await prisma.parkingLot.findUnique({ where: { id: assignedLotId } });
    if (!lot || !lot.isActive) {
      throw new NotFoundError(
        ErrorCode.NOT_FOUND,
        `Assigned parking lot '${assignedLotId}' does not exist or is inactive`
      );
    }
    finalAssignedLotId = assignedLotId;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: {
        role,
        assignedLotId: finalAssignedLotId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedLotId: true,
        createdAt: true,
      },
    });

    await createAuditLog(
      {
        adminId,
        action: 'UPDATE_USER_ROLE',
        targetType: 'User',
        targetId: targetUserId,
        details: { role, assignedLotId: finalAssignedLotId, previousRole: targetUser.role },
      },
      tx
    );

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role as Role,
      assignedLotId: updated.assignedLotId,
      createdAt: updated.createdAt.toISOString(),
    };
  });
}

export async function adminCreateDevice(
  adminId: string,
  data: CreateDeviceRequest
): Promise<{ device: DeviceView; rawKey: string }> {
  if (data.parkingLotId) {
    const lot = await prisma.parkingLot.findUnique({ where: { id: data.parkingLotId } });
    if (!lot) {
      throw new NotFoundError(
        ErrorCode.NOT_FOUND,
        `Parking lot with ID '${data.parkingLotId}' not found`
      );
    }
  }

  const rawKey = crypto.randomBytes(32).toString('hex');
  const keyHash = hashToken(rawKey);

  return prisma.$transaction(async (tx) => {
    const device = await tx.device.create({
      data: {
        name: data.name,
        kind: data.kind as SlotSource,
        parkingLotId: data.parkingLotId ?? null,
        keyHash,
        isActive: true,
      },
    });

    await createAuditLog(
      {
        adminId,
        action: 'CREATE_DEVICE',
        targetType: 'Device',
        targetId: device.id,
        details: { name: device.name, kind: device.kind, parkingLotId: device.parkingLotId },
      },
      tx
    );

    return {
      device: {
        id: device.id,
        name: device.name,
        kind: device.kind as SlotSource,
        parkingLotId: device.parkingLotId,
        isActive: device.isActive,
        revokedAt: device.revokedAt ? device.revokedAt.toISOString() : null,
        createdAt: device.createdAt.toISOString(),
      },
      rawKey,
    };
  });
}

export async function adminGetDevices(): Promise<DeviceView[]> {
  const devices = await prisma.device.findMany({
    select: {
      id: true,
      name: true,
      kind: true,
      parkingLotId: true,
      isActive: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind as SlotSource,
    parkingLotId: d.parkingLotId,
    isActive: d.isActive,
    revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function adminRevokeDevice(
  adminId: string,
  deviceId: string
): Promise<{ revoked: boolean; deviceId: string }> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Device with ID '${deviceId}' not found`);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.device.update({
      where: { id: deviceId },
      data: {
        isActive: false,
        revokedAt: now,
      },
    });

    await createAuditLog(
      {
        adminId,
        action: 'REVOKE_DEVICE',
        targetType: 'Device',
        targetId: deviceId,
        details: { name: device.name },
      },
      tx
    );
  });

  return { revoked: true, deviceId };
}

export async function adminGetAuditLogs(): Promise<AuditLogView[]> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return logs.map((l) => ({
    id: l.id,
    adminId: l.adminId,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    details: (l.details ?? {}) as Record<string, unknown>,
    createdAt: l.createdAt.toISOString(),
  }));
}
