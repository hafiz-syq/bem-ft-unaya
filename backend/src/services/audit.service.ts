import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';

export const logActivity = async (
  actorId: string,
  action: string,
  entityType: string,
  description: string,
  entityId?: string,
  metadata?: Prisma.InputJsonValue
) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        description,
        entityId,
        metadata
      }
    });
  } catch (error) {
    console.error('Gagal mencatat audit log:', error);
  }
};

/**
 * Mencatat peristiwa yang tidak dilakukan oleh pengguna mana pun, misalnya
 * permintaan dari origin web yang ditolak atau pemeriksaan otomatis oleh sistem.
 * Baris-baris ini muncul di log aktivitas dengan aktor "Sistem".
 */
export const logSystemActivity = async (
  action: string,
  entityType: string,
  description: string,
  entityId?: string,
  metadata?: Prisma.InputJsonValue
) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action,
        entityType,
        description,
        entityId,
        metadata
      }
    });
  } catch (error) {
    console.error('Gagal mencatat audit log sistem:', error);
  }
};