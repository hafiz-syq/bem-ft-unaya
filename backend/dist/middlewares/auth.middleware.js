"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
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
            res.status(403).json({
                message: 'Akun ini sudah dinonaktifkan. Silakan hubungi administrator.',
            });
            return;
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
