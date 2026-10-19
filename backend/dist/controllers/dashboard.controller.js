"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const cors_monitor_service_1 = require("../services/cors-monitor.service");
const ticket_access_1 = require("../lib/ticket-access");
const getDashboardStats = async (req, res, next) => {
    try {
        const user = req.user;
        if ((0, ticket_access_1.isAdminRole)(user.role) || user.role === 'PENGURUS') {
            // --- STATISTIK UNTUK ADMIN, SUPERADMIN & PENGURUS ---
            const totalMahasiswa = await prisma_1.default.user.count({ where: { role: 'MAHASISWA' } });
            const totalPengurus = await prisma_1.default.user.count({
                where: { role: { in: ['PENGURUS', 'ADMIN', 'SUPERADMIN'] } },
            });
            const totalAspirasi = await prisma_1.default.ticket.count({ where: { type: 'ASPIRASI' } });
            const totalKeluhan = await prisma_1.default.ticket.count({ where: { type: 'KELUHAN' } });
            const ticketMenunggu = await prisma_1.default.ticket.count({ where: { status: 'DIKIRIM' } });
            const ticketDiproses = await prisma_1.default.ticket.count({ where: { status: { in: ['DITINJAU', 'DIPROSES'] } } });
            const ticketSelesai = await prisma_1.default.ticket.count({ where: { status: 'SELESAI' } });
            // Ringkasan percobaan akses dari origin tak dikenal hanya untuk ADMIN:
            // ini telemetri keamanan, bukan bagian dari pekerjaan kepengurusan.
            const keamananCors = (0, ticket_access_1.isAdminRole)(user.role) ? await (0, cors_monitor_service_1.ringkasanPenolakanCors)() : null;
            res.status(200).json({
                role: user.role,
                data: {
                    totalMahasiswa,
                    totalPengurus,
                    totalAspirasi,
                    totalKeluhan,
                    ticketMenunggu,
                    ticketDiproses,
                    ticketSelesai,
                    ...(keamananCors ? { keamananCors } : {})
                }
            });
        }
        else {
            // --- STATISTIK UNTUK MAHASISWA ---
            const myTickets = await prisma_1.default.ticket.count({ where: { senderId: user.id } });
            const myAspirasi = await prisma_1.default.ticket.count({ where: { senderId: user.id, type: 'ASPIRASI' } });
            const myKeluhan = await prisma_1.default.ticket.count({ where: { senderId: user.id, type: 'KELUHAN' } });
            const myActiveTickets = await prisma_1.default.ticket.count({ where: { senderId: user.id, status: { not: { in: ['SELESAI', 'DITOLAK'] } } } });
            const myCompletedTickets = await prisma_1.default.ticket.count({ where: { senderId: user.id, status: 'SELESAI' } });
            res.status(200).json({
                role: user.role,
                data: {
                    myTickets,
                    myAspirasi,
                    myKeluhan,
                    myActiveTickets,
                    myCompletedTickets
                }
            });
        }
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboardStats = getDashboardStats;
