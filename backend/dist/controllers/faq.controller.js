"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFaq = exports.updateFaq = exports.createFaq = exports.getFaqs = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("../services/audit.service");
/** Halaman FAQ dashboard. Semua pengguna login boleh membaca; admin mengelola. */
const getFaqs = async (req, res, next) => {
    try {
        const data = await prisma_1.default.faq.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
        res.status(200).json({ data });
    }
    catch (error) {
        next(error);
    }
};
exports.getFaqs = getFaqs;
const createFaq = async (req, res, next) => {
    try {
        const question = String(req.body.question || '').trim();
        const answer = String(req.body.answer || '').trim();
        const order = parseInt(req.body.order) || 0;
        if (!question || !answer) {
            res.status(400).json({ message: 'Pertanyaan dan jawaban wajib diisi.' });
            return;
        }
        const baru = await prisma_1.default.faq.create({ data: { question, answer, order } });
        await (0, audit_service_1.logActivity)(req.user.id, 'CREATE_FAQ', 'Faq', `Menambahkan FAQ "${question}"`, baru.id);
        res.status(201).json({ message: 'FAQ berhasil ditambahkan.', data: baru });
    }
    catch (error) {
        next(error);
    }
};
exports.createFaq = createFaq;
const updateFaq = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { question, answer, order } = req.body;
        const lama = await prisma_1.default.faq.findUnique({ where: { id } });
        if (!lama) {
            res.status(404).json({ message: 'FAQ tidak ditemukan.' });
            return;
        }
        const updated = await prisma_1.default.faq.update({
            where: { id },
            data: {
                ...(question !== undefined ? { question } : {}),
                ...(answer !== undefined ? { answer } : {}),
                ...(order !== undefined ? { order: parseInt(order) || 0 } : {})
            }
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'UPDATE_FAQ', 'Faq', `Memperbarui FAQ "${updated.question}"`, id);
        res.status(200).json({ message: 'FAQ berhasil diperbarui.', data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.updateFaq = updateFaq;
const deleteFaq = async (req, res, next) => {
    try {
        const lama = await prisma_1.default.faq.findUnique({ where: { id: req.params.id } });
        await prisma_1.default.faq.delete({ where: { id: req.params.id } });
        await (0, audit_service_1.logActivity)(req.user.id, 'DELETE_FAQ', 'Faq', `Menghapus FAQ "${lama?.question ?? req.params.id}"`, req.params.id);
        res.status(200).json({ message: 'FAQ berhasil dihapus.' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteFaq = deleteFaq;
