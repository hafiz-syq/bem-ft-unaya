"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const ticket_access_1 = require("../lib/ticket-access");
const getAuditLogs = async (req, res, next) => {
    try {
        // [PERBAIKAN KEAMANAN] Log audit hanya boleh dibaca ADMIN/SUPERADMIN.
        if (!(0, ticket_access_1.isAdminRole)(req.user?.role)) {
            res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            prisma_1.default.auditLog.findMany({
                skip,
                take: limit,
                include: {
                    actor: {
                        include: {
                            profile: true // Menggunakan include penuh agar lebih aman untuk Prisma
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma_1.default.auditLog.count()
        ]);
        const totalPages = Math.ceil(total / limit);
        res.status(200).json({
            data: logs,
            meta: { total, page, limit, totalPages }
        });
    }
    catch (error) {
        // Menampilkan error asli di terminal backend Anda
        console.error("==== ERROR DI AUDIT CONTROLLER ====");
        console.error(error.message || error);
        res.status(500).json({ message: 'Terjadi kesalahan internal pada server backend.' });
    }
};
exports.getAuditLogs = getAuditLogs;
