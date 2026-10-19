"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportKeluhanExcel = exports.setTicketModeration = exports.assignTicket = exports.getAssignees = exports.replyTicket = exports.getPublicTickets = exports.getTickets = exports.createTicket = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const email_service_1 = require("../services/email.service");
const ticket_access_1 = require("../lib/ticket-access");
/**
 * Menentukan siapa yang mendapat notifikasi (database + email) untuk sebuah tiket.
 * Notifikasi hanya menyasar pengurus yang memang berhak membaca tiket tersebut,
 * bukan seluruh pengurus seperti sebelumnya.
 */
const roleYangMenerima = (type, target) => {
    const roles = [...ticket_access_1.ADMIN_ROLES];
    if (type === 'KELUHAN' && target && target !== 'BEM') {
        const peran = Object.keys(ticket_access_1.ROLE_TARGET).find((r) => ticket_access_1.ROLE_TARGET[r] === target);
        if (peran)
            roles.push(peran);
    }
    else {
        // Aspirasi (dan keluhan yang diarahkan ke BEM) menjadi tugas PENGURUS BEM.
        roles.push('PENGURUS_BEM');
    }
    return roles;
};
// 1. Membuat Tiket Baru (dengan lampiran opsional)
const createTicket = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { type, category, title, content } = req.body;
        const file = req.file;
        if (!type || !category || !title || !content) {
            res.status(400).json({ message: 'Semua field wajib diisi.' });
            return;
        }
        if (type !== 'ASPIRASI' && type !== 'KELUHAN') {
            res.status(400).json({ message: 'Jenis tiket tidak dikenali.' });
            return;
        }
        // Aspirasi selalu menuju BEM. Keluhan wajib memilih organisasi tujuan.
        let targetOrganization = 'BEM';
        if (type === 'KELUHAN') {
            const dipilih = req.body.targetOrganization;
            if (!(0, ticket_access_1.isTicketTarget)(dipilih)) {
                res.status(400).json({ message: 'Pilih organisasi tujuan keluhan terlebih dahulu.' });
                return;
            }
            targetOrganization = dipilih;
        }
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const ticket_no = `TKT-${dateStr}-${randomCode}`;
        const newTicket = await prisma_1.default.ticket.create({
            data: {
                ticket_no,
                type,
                category,
                title,
                content,
                targetOrganization,
                senderId: userId,
                status: 'DIKIRIM',
                // Aspirasi memang ditujukan untuk ruang publik sejak awal.
                // Keluhan ditahan dulu supaya bisa diperiksa sebelum tayang (anonim).
                moderationStatus: type === 'ASPIRASI' ? 'PUBLISHED' : 'PENDING_MODERATION',
            },
        });
        if (file) {
            await prisma_1.default.attachment.create({
                data: {
                    ticketId: newTicket.id,
                    filename: file.filename,
                    url: `/uploads/${file.filename}`,
                    mimeType: file.mimetype,
                    size: file.size,
                },
            });
        }
        // --- Notifikasi dalam aplikasi ---
        const roles = roleYangMenerima(type, targetOrganization);
        const penerima = await prisma_1.default.user.findMany({
            where: { role: { in: roles }, isActive: true },
            select: { id: true },
        });
        if (penerima.length > 0) {
            await prisma_1.default.notification.createMany({
                data: penerima.map((p) => ({
                    userId: p.id,
                    title: 'Tiket Masuk Baru',
                    message: `Tiket ${type} baru #${ticket_no} menunggu untuk ditinjau.`,
                })),
            });
        }
        // --- Notifikasi email: HANYA ke alamat yang sudah diverifikasi ---
        const allOfficers = await prisma_1.default.user.findMany({
            where: { role: { in: roles }, isActive: true },
            include: { profile: { select: { nama: true, email: true, email_verified_at: true } } },
        });
        const officerPenerima = allOfficers.filter((officer) => officer.profile?.email && officer.profile.email_verified_at);
        const jumlahDilewati = allOfficers.length - officerPenerima.length;
        if (jumlahDilewati > 0) {
            console.log(`ℹ️ Notifikasi email tiket dilewati untuk ${jumlahDilewati} pengurus/admin yang emailnya belum terverifikasi.`);
        }
        if (officerPenerima.length > 0) {
            await Promise.all(officerPenerima.map(async (officer) => {
                const recipientName = officer.profile?.nama || officer.nim;
                const recipientEmail = officer.profile.email;
                const htmlContent = (0, email_service_1.generateTicketNotificationEmail)(recipientName, ticket_no, type, title, userId, category);
                await (0, email_service_1.sendEmailNotification)(recipientEmail, `📬 Tiket Baru: ${ticket_no} - ${title}`, htmlContent);
            }));
        }
        res.status(201).json({ message: 'Tiket berhasil dikirim.', ticket: newTicket });
    }
    catch (error) {
        next(error);
    }
};
exports.createTicket = createTicket;
// 2. Mengambil Daftar Tiket (dibatasi hak baca per organisasi)
const getTickets = async (req, res, next) => {
    try {
        const tickets = await prisma_1.default.ticket.findMany({
            where: (0, ticket_access_1.ticketVisibilityWhere)(req.user),
            include: {
                sender: { select: { nim: true, role: true, profile: { select: { nama: true } } } },
                attachments: true,
                replies: {
                    include: { author: { select: { nim: true, role: true, profile: { select: { nama: true } } } } },
                },
                assignments: {
                    where: { isActive: true },
                    include: { assignee: { include: { profile: { select: { nama: true } } } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ data: tickets });
    }
    catch (error) {
        next(error);
    }
};
exports.getTickets = getTickets;
// 3. Feed publik untuk landing page.
//    Aspirasi tampil dengan nama & NIM pengirim; keluhan selalu dianonimkan.
const getPublicTickets = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 6, 30);
        const tickets = await prisma_1.default.ticket.findMany({
            where: { moderationStatus: 'PUBLISHED', type: { in: ['ASPIRASI', 'KELUHAN'] } },
            include: {
                sender: { select: { nim: true, profile: { select: { nama: true } } } },
                replies: {
                    where: { author: { role: { in: [...ticket_access_1.ADMIN_ROLES, ...ticket_access_1.OFFICER_ROLES] } } },
                    select: { id: true, content: true, createdAt: true },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        const data = tickets.map((t) => {
            const anonim = t.type === 'KELUHAN';
            return {
                id: t.id,
                ticket_no: anonim ? null : t.ticket_no,
                type: t.type,
                category: t.category,
                title: t.title,
                content: t.content,
                targetOrganization: t.targetOrganization,
                targetLabel: t.targetOrganization
                    ? ticket_access_1.TARGET_LABEL[t.targetOrganization]
                    : null,
                status: t.status,
                createdAt: t.createdAt,
                pengirim: anonim ? null : { nama: t.sender.profile?.nama ?? null, nim: t.sender.nim },
                anonim,
                balasan: t.replies,
            };
        });
        res.status(200).json({ data });
    }
    catch (error) {
        next(error);
    }
};
exports.getPublicTickets = getPublicTickets;
// 4. Membalas Tiket (wajib punya hak baca atas tiket tersebut)
const replyTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { content } = req.body;
        if (!content) {
            res.status(400).json({ message: 'Isi balasan tidak boleh kosong.' });
            return;
        }
        const ticket = await prisma_1.default.ticket.findUnique({
            where: { id },
            include: { assignments: { where: { isActive: true } } },
        });
        if (!ticket) {
            res.status(404).json({ message: 'Tiket tidak ditemukan.' });
            return;
        }
        if (!(0, ticket_access_1.canAccessTicket)(req.user, ticket)) {
            res.status(403).json({ message: 'Anda tidak memiliki akses ke tiket ini.' });
            return;
        }
        const reply = await prisma_1.default.ticketReply.create({
            data: { ticketId: id, authorId: userId, content },
        });
        if (ticket.senderId !== userId) {
            await prisma_1.default.notification.create({
                data: {
                    userId: ticket.senderId,
                    title: 'Balasan Baru pada Tiket',
                    message: `Tiket #${ticket.ticket_no} Anda telah mendapat balasan baru dari pengurus.`,
                },
            });
        }
        res.status(201).json({ message: 'Balasan berhasil dikirim.', reply });
    }
    catch (error) {
        next(error);
    }
};
exports.replyTicket = replyTicket;
// 5. Mengambil daftar pengurus yang bisa ditugaskan, dikelompokkan per organisasi
const getAssignees = async (req, res, next) => {
    try {
        const pengurus = await prisma_1.default.user.findMany({
            where: { role: { in: [...ticket_access_1.ADMIN_ROLES, ...ticket_access_1.OFFICER_ROLES] }, isActive: true },
            select: {
                id: true,
                nim: true,
                role: true,
                profile: { select: { nama: true, program_studi: true } },
            },
            orderBy: { role: 'asc' },
        });
        res.status(200).json({
            data: pengurus.map((p) => ({
                ...p,
                organisasi: ticket_access_1.ROLE_TARGET[p.role] ? ticket_access_1.TARGET_LABEL[ticket_access_1.ROLE_TARGET[p.role]] : 'BEM (Umum)',
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAssignees = getAssignees;
// 6. Delegasi Tiket
const assignTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { assigneeId } = req.body;
        const assignerId = req.user.id;
        if (!assigneeId) {
            res.status(400).json({ message: 'Pengurus wajib dipilih.' });
            return;
        }
        const ticket = await prisma_1.default.ticket.findUnique({
            where: { id },
            include: { assignments: { where: { isActive: true } } },
        });
        if (!ticket) {
            res.status(404).json({ message: 'Tiket tidak ditemukan.' });
            return;
        }
        if (!(0, ticket_access_1.canAccessTicket)(req.user, ticket)) {
            res.status(403).json({ message: 'Anda tidak berhak menugaskan tiket ini.' });
            return;
        }
        const assignee = await prisma_1.default.user.findUnique({ where: { id: assigneeId } });
        if (!assignee) {
            res.status(404).json({ message: 'Pengurus tidak ditemukan.' });
            return;
        }
        await prisma_1.default.ticketAssignment.updateMany({
            where: { ticketId: id, isActive: true },
            data: { isActive: false },
        });
        const newAssignment = await prisma_1.default.ticketAssignment.create({
            data: { ticketId: id, assigneeId, assignerId },
        });
        if (ticket.status === 'DIKIRIM') {
            await prisma_1.default.ticket.update({ where: { id }, data: { status: 'DIPROSES' } });
            await prisma_1.default.notification.create({
                data: {
                    userId: ticket.senderId,
                    title: 'Status Tiket Diperbarui',
                    message: `Tiket #${ticket.ticket_no} Anda saat ini mulai diproses oleh pengurus.`,
                },
            });
        }
        // Beri tahu pengurus yang ditugaskan supaya tidak ada tiket yang menganggur.
        await prisma_1.default.notification.create({
            data: {
                userId: assigneeId,
                title: 'Tiket Ditugaskan Kepada Anda',
                message: `Anda ditugaskan menangani tiket #${ticket.ticket_no} (${ticket.title}).`,
            },
        });
        res.status(200).json({ message: 'Tiket berhasil ditugaskan.', data: newAssignment });
    }
    catch (error) {
        next(error);
    }
};
exports.assignTicket = assignTicket;
// 7. Mengubah status moderasi / status tiket
const setTicketModeration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { moderationStatus, status } = req.body;
        const data = {};
        if (moderationStatus) {
            const boleh = ['PENDING_MODERATION', 'PUBLISHED', 'REJECTED'];
            if (!boleh.includes(moderationStatus)) {
                res.status(400).json({ message: 'Status moderasi tidak dikenali.' });
                return;
            }
            data.moderationStatus = moderationStatus;
            data.moderatedById = req.user.id;
            data.moderatedAt = new Date();
        }
        if (status) {
            const boleh = ['DIKIRIM', 'DITINJAU', 'DIPROSES', 'SELESAI', 'DITOLAK'];
            if (!boleh.includes(status)) {
                res.status(400).json({ message: 'Status tiket tidak dikenali.' });
                return;
            }
            data.status = status;
        }
        if (Object.keys(data).length === 0) {
            res.status(400).json({ message: 'Tidak ada perubahan yang dikirim.' });
            return;
        }
        const ticket = await prisma_1.default.ticket.findUnique({ where: { id } });
        if (!ticket) {
            res.status(404).json({ message: 'Tiket tidak ditemukan.' });
            return;
        }
        if (!(0, ticket_access_1.canAccessTicket)(req.user, { ...ticket, assignments: [] })) {
            res.status(403).json({ message: 'Anda tidak berhak mengubah tiket ini.' });
            return;
        }
        const updated = await prisma_1.default.ticket.update({ where: { id }, data });
        res.status(200).json({ message: 'Tiket berhasil diperbarui.', data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.setTicketModeration = setTicketModeration;
// 8. Ekspor data keluhan ke Excel (hanya ADMIN & PENGURUS DPM)
const exportKeluhanExcel = async (req, res, next) => {
    try {
        if (!(0, ticket_access_1.canExportKeluhan)(req.user.role)) {
            res.status(403).json({ message: 'Hanya PENGURUS DPM dan Admin yang dapat mengaudit data keluhan.' });
            return;
        }
        const daftar = await prisma_1.default.ticket.findMany({
            where: { type: 'KELUHAN' },
            include: {
                sender: { select: { nim: true, profile: { select: { nama: true, program_studi: true } } } },
                assignments: {
                    where: { isActive: true },
                    include: { assignee: { include: { profile: { select: { nama: true } } } } },
                },
                replies: { select: { id: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = 'BEM-FT UNAYA';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet('Audit Keluhan');
        sheet.columns = [
            { header: 'No. Tiket', key: 'ticket_no', width: 24 },
            { header: 'Tanggal Masuk', key: 'tanggal', width: 20 },
            { header: 'Organisasi Tujuan', key: 'target', width: 30 },
            { header: 'Kategori', key: 'category', width: 18 },
            { header: 'Judul', key: 'title', width: 34 },
            { header: 'Isi Keluhan', key: 'content', width: 60 },
            { header: 'NIM Pengirim', key: 'nim', width: 18 },
            { header: 'Nama Pengirim', key: 'nama', width: 28 },
            { header: 'Program Studi', key: 'prodi', width: 22 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Moderasi', key: 'moderasi', width: 20 },
            { header: 'Ditangani Oleh', key: 'petugas', width: 26 },
            { header: 'Jumlah Balasan', key: 'balasan', width: 16 },
        ];
        daftar.forEach((t) => {
            sheet.addRow({
                ticket_no: t.ticket_no,
                tanggal: t.createdAt.toLocaleString('id-ID'),
                target: t.targetOrganization ? ticket_access_1.TARGET_LABEL[t.targetOrganization] : '-',
                category: t.category,
                title: t.title,
                content: t.content,
                nim: t.sender.nim,
                nama: t.sender.profile?.nama ?? '-',
                prodi: t.sender.profile?.program_studi ?? '-',
                status: t.status,
                moderasi: t.moderationStatus,
                petugas: t.assignments[0]?.assignee.profile?.nama ?? '-',
                balasan: t.replies.length,
            });
        });
        // Baris judul di atas tabel supaya hasil audit langsung terbaca.
        sheet.insertRow(1, [`Audit Keluhan BEM-FT UNAYA - dicetak ${new Date().toLocaleString('id-ID')}`]);
        sheet.mergeCells(1, 1, 1, sheet.columnCount);
        sheet.getRow(1).font = { bold: true, size: 13 };
        sheet.getRow(1).alignment = { horizontal: 'center' };
        sheet.insertRow(2, []);
        // Baris header asli kini berada di baris 3.
        sheet.getRow(3).font = { bold: true };
        sheet.getRow(3).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFBBF24' },
        };
        const namaFile = `audit-keluhan-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        next(error);
    }
};
exports.exportKeluhanExcel = exportKeluhanExcel;
