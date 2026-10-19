"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRequest = exports.getRequests = exports.createRequest = void 0;
const audit_service_1 = require("../services/audit.service");
const prisma_1 = __importDefault(require("../lib/prisma"));
const ticket_access_1 = require("../lib/ticket-access");
// 1. Mahasiswa mengajukan perubahan data
const createRequest = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { requestData, reason } = req.body;
        if (!requestData || Object.keys(requestData).length === 0) {
            res.status(400).json({ message: 'Data perubahan tidak boleh kosong.' });
            return;
        }
        const newRequest = await prisma_1.default.dataChangeRequest.create({
            data: {
                userId,
                requestData,
                reason,
                status: 'PENDING'
            }
        });
        res.status(201).json({ message: 'Pengajuan perubahan data berhasil dikirim.', data: newRequest });
    }
    catch (error) {
        next(error);
    }
};
exports.createRequest = createRequest;
// 2. Admin melihat semua pengajuan
const getRequests = async (req, res, next) => {
    try {
        const user = req.user;
        let whereCondition = {};
        if (user.role === 'MAHASISWA') {
            whereCondition = { userId: user.id };
        }
        const requests = await prisma_1.default.dataChangeRequest.findMany({
            where: whereCondition,
            include: {
                user: {
                    include: {
                        profile: true
                    }
                },
                reviewer: {
                    select: {
                        role: true,
                        profile: { select: { nama: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // Sanitasi data: pastikan requestData berbentuk JSON object yang valid
        // dan pastikan array selalu dikembalikan meskipun kosong
        const sanitizedRequests = requests.map(req => {
            let parsedData = req.requestData;
            // Jika Prisma membacanya sebagai string JSON, kita parse
            if (typeof parsedData === 'string') {
                try {
                    parsedData = JSON.parse(parsedData);
                }
                catch (e) {
                    parsedData = {};
                }
            }
            return {
                ...req,
                requestData: parsedData || {}
            };
        });
        res.status(200).json({ data: sanitizedRequests });
    }
    catch (error) {
        next(error);
    }
};
exports.getRequests = getRequests;
// 3. Admin memproses pengajuan (Approve / Reject)
const processRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // <-- Typo kurawal ekstra sudah dihapus di sini
        // [PERBAIKAN KEAMANAN] Hanya ADMIN/SUPERADMIN yang boleh memproses pengajuan perubahan data.
        if (!(0, ticket_access_1.isAdminRole)(req.user?.role)) {
            res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
            return;
        }
        const reviewerId = req.user.id;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            res.status(400).json({ message: 'Status tidak valid.' });
            return;
        }
        const request = await prisma_1.default.dataChangeRequest.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ message: 'Data pengajuan tidak ditemukan.' });
            return;
        }
        if (request.status !== 'PENDING') {
            res.status(400).json({ message: 'Pengajuan ini sudah diproses sebelumnya.' });
            return;
        }
        if (status === 'APPROVED') {
            const updateData = request.requestData;
            await prisma_1.default.studentProfile.update({
                where: { userId: request.userId },
                data: {
                    nama: updateData.nama,
                    program_studi: updateData.program_studi,
                    email: updateData.email,
                    no_hp: updateData.no_hp,
                }
            });
        }
        const updatedRequest = await prisma_1.default.dataChangeRequest.update({
            where: { id },
            data: {
                status, // <-- TypeScript sekarang sudah mengenali status dengan benar
                reviewedById: reviewerId,
                reviewedAt: new Date()
            }
        });
        await (0, audit_service_1.logActivity)(reviewerId, status === 'APPROVED' ? 'APPROVE_DATA' : 'REJECT_DATA', 'DataChangeRequest', `Admin memproses pengajuan perubahan data dari User ID: ${request.userId}`, id);
        res.status(200).json({ message: `Pengajuan berhasil di-${status.toLowerCase()}.`, data: updatedRequest });
    }
    catch (error) {
        next(error);
    }
};
exports.processRequest = processRequest;
