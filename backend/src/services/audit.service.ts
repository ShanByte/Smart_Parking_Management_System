import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CreateAuditLogParams {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}

/**
 * Creates an AuditLog row per Security Rule 11.
 * Supports executing within an ongoing prisma.$transaction.
 */
export async function createAuditLog(
  params: CreateAuditLogParams,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: (params.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}
