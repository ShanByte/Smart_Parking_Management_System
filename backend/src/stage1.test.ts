import { describe, it, expect } from 'vitest';
import {
  Role as SharedRole,
  SlotStatus as SharedSlotStatus,
  BookingStatus as SharedBookingStatus,
  PaymentStatus as SharedPaymentStatus,
  SlotSource as SharedSlotSource,
} from '@smart-parking/shared';
import {
  Role as PrismaRole,
  SlotStatus as PrismaSlotStatus,
  BookingStatus as PrismaBookingStatus,
  PaymentStatus as PrismaPaymentStatus,
  SlotSource as PrismaSlotSource,
} from '@prisma/client';

describe('FROZEN CONTRACT C2 & Prisma Enum Parity', () => {
  it('Role enum matches exactly between shared and Prisma', () => {
    expect(Object.keys(PrismaRole).sort()).toEqual(Object.keys(SharedRole).sort());
    expect(Object.values(PrismaRole).sort()).toEqual(Object.values(SharedRole).sort());
  });

  it('SlotStatus enum matches exactly between shared and Prisma', () => {
    expect(Object.keys(PrismaSlotStatus).sort()).toEqual(Object.keys(SharedSlotStatus).sort());
    expect(Object.values(PrismaSlotStatus).sort()).toEqual(Object.values(SharedSlotStatus).sort());
  });

  it('BookingStatus enum matches exactly between shared and Prisma (including NO_SHOW)', () => {
    expect(Object.keys(PrismaBookingStatus).sort()).toEqual(Object.keys(SharedBookingStatus).sort());
    expect(Object.values(PrismaBookingStatus).sort()).toEqual(Object.values(SharedBookingStatus).sort());
    expect(PrismaBookingStatus.NO_SHOW).toBe('NO_SHOW');
  });

  it('PaymentStatus enum matches exactly between shared and Prisma', () => {
    expect(Object.keys(PrismaPaymentStatus).sort()).toEqual(Object.keys(SharedPaymentStatus).sort());
    expect(Object.values(PrismaPaymentStatus).sort()).toEqual(Object.values(SharedPaymentStatus).sort());
  });

  it('SlotSource enum matches exactly between shared and Prisma (including GUARD)', () => {
    expect(Object.keys(PrismaSlotSource).sort()).toEqual(Object.keys(SharedSlotSource).sort());
    expect(Object.values(PrismaSlotSource).sort()).toEqual(Object.values(SharedSlotSource).sort());
    expect(PrismaSlotSource.GUARD).toBe('GUARD');
  });
});
