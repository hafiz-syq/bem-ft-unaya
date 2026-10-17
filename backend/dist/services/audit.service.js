"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSystemActivity = exports.logActivity = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const logActivity = async (actorId, action, entityType, description, entityId, metadata) => {
    try {
        await prisma_1.default.auditLog.create({
            data: {
                actorId,
                action,
                entityType,
                description,
                entityId,
                metadata
            }
        });
    }
    catch (error) {
        console.error('Gagal mencatat audit log:', error);
    }
};
exports.logActivity = logActivity;
/**
 * Mencatat peristiwa yang tidak dilakukan oleh pengguna mana pun, misalnya
 * permintaan dari origin web yang ditolak atau pemeriksaan otomatis oleh sistem.
 * Baris-baris ini muncul di log aktivitas dengan aktor "Sistem".
 */
const logSystemActivity = async (action, entityType, description, entityId, metadata) => {
    try {
        await prisma_1.default.auditLog.create({
            data: {
                actorId: null,
                action,
                entityType,
                description,
                entityId,
                metadata
            }
        });
    }
    catch (error) {
        console.error('Gagal mencatat audit log sistem:', error);
    }
};
exports.logSystemActivity = logSystemActivity;
