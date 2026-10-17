"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.getNotifications = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// Mengambil notifikasi user yang sedang login
const getNotifications = async (req, res, next) => {
    try {
        const notifications = await prisma_1.default.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 15 // Ambil 15 terbaru saja
        });
        res.status(200).json({ data: notifications });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotifications = getNotifications;
// Tandai semua notifikasi menjadi sudah dibaca (isRead = true)
const markAllAsRead = async (req, res, next) => {
    try {
        await prisma_1.default.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true }
        });
        res.status(200).json({ message: 'Semua notifikasi telah dibaca.' });
    }
    catch (error) {
        next(error);
    }
};
exports.markAllAsRead = markAllAsRead;
