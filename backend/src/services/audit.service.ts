import prisma from '../lib/prisma';

export const logActivity = async (
  actorId: string,
  action: string,
  entityType: string,
  description: string,
  entityId?: string
) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        description,
        entityId
      }
    });
  } catch (error) {
    console.error('Gagal mencatat audit log:', error);
  }
};