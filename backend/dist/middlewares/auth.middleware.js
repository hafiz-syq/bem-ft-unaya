"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.optionalAuth = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const ticket_access_1 = require("../lib/ticket-access");
const requireAuth = async (req, res, next) => {
    try {
        // Membaca token dari httpOnly cookie
        const token = req.cookies.token;
        if (!token) {
            res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
            return;
        }
        // Verifikasi token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Status akun diperiksa ulang ke database, tidak cukup dari isi token.
        // Alasannya: token berlaku 1 hari, sehingga tanpa pemeriksaan ini akun yang
        // dinonaktifkan (mis. habis masa studi) atau yang sudah dihapus masih bisa
        // memakai sesi lamanya, dan perubahan role baru berlaku setelah login ulang.
        const akun = await prisma_1.default.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, nim: true, role: true, isActive: true },
        });
        if (!akun) {
            res.status(401).json({ message: 'Akun tidak ditemukan. Silakan login kembali.' });
            return;
        }
        if (!akun.isActive) {
            // Akun pengelola tidak pernah ditolak: statusnya dipulihkan saat itu juga.
            // Ini penjagaan terakhir supaya kesalahan status pada ADMIN/SUPERADMIN
            // tidak bisa mengunci seluruh sistem.
            if ((0, ticket_access_1.isAdminRole)(akun.role)) {
                await prisma_1.default.user.update({
                    where: { id: akun.id },
                    data: { isActive: true, deactivatedAt: null, deactivationType: null, tenggatHapus: null },
                });
            }
            else {
                res.status(403).json({
                    message: 'Akun ini sudah dinonaktifkan. Silakan hubungi administrator.',
                });
                return;
            }
        }
        // Role diambil dari database agar keputusan otorisasi selalu mengikuti keadaan
        // terkini, bukan role saat token dibuat.
        req.user = { ...decoded, id: akun.id, nim: akun.nim, role: akun.role };
        next();
    }
    catch (error) {
        res.status(401).json({ message: 'Sesi tidak valid atau telah kedaluwarsa.' });
    }
};
exports.requireAuth = requireAuth;
/**
 * Seperti requireAuth, tetapi tamu tetap dilanjutkan tanpa `req.user`.
 *
 * Dipakai pada endpoint publik yang ingin mengenali pengguna login bila ada,
 * mis. komentar galeri: tamu boleh menulis dengan nama sendiri, sedangkan
 * pengguna login otomatis memakai identitas akunnya. Token yang tidak valid
 * diperlakukan sebagai tamu, bukan 401, supaya sesi kedaluwarsa tidak
 * menghalangi pengunjung biasa.
 */
const optionalAuth = async (req, _res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const akun = await prisma_1.default.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, nim: true, role: true, isActive: true },
        });
        if (akun?.isActive) {
            req.user = { ...decoded, id: akun.id, nim: akun.nim, role: akun.role };
        }
    }
    catch {
        // Token tidak valid/kedaluwarsa: lanjut sebagai tamu.
    }
    next();
};
exports.optionalAuth = optionalAuth;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ message: 'Forbidden.' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
