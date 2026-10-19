"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportMahasiswa = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("../services/audit.service");
const account_lifecycle_service_1 = require("../services/account-lifecycle.service");
const ticket_access_1 = require("../lib/ticket-access");
// Lokasi kolom CSV untuk tabel mahasiswa
const HEADER_LAHAN = ['No', 'NIM', 'Nama', 'Program Studi', 'Email', 'No HP', 'Angkatan', 'Role', 'Jabatan', 'Organisasi', 'Status', 'Dilarang Login', 'Tenggat Hapus'];
/**
 * Ekspor data mahasiswa ke file CSV.
 * Hanya bisa dilakukan oleh ADMIN.
 * Endpoint: GET /api/students/export
 */
const exportMahasiswa = async (req, res, next) => {
    try {
        if (!req.user || !(0, ticket_access_1.isAdminRole)(req.user.role)) {
            res.status(403).json({ message: 'Hanya admin yang dapat mengekspor data mahasiswa.' });
            return;
        }
        const { search, status, role } = req.query;
        // Bangun filter. Akun SUPERADMIN tidak pernah ikut diekspor (akun pengelola
        // web); akun ADMIN hanya ikut bila memang difilter oleh SUPERADMIN.
        const bisaLihatAdmin = req.user.role === 'SUPERADMIN';
        const where = { role: { notIn: bisaLihatAdmin ? ['SUPERADMIN'] : ['ADMIN', 'SUPERADMIN'] } };
        if (status === 'AKTIF')
            where.isActive = true;
        else if (status === 'NONAKTIF')
            where.isActive = false;
        if (role && role !== 'ALL' && (role !== 'ADMIN' || bisaLihatAdmin))
            where.role = role;
        if (search) {
            where.OR = [
                { nim: { contains: search } },
                { profile: { nama: { contains: search } } },
            ];
        }
        const mahasiswa = await prisma_1.default.user.findMany({
            where,
            orderBy: { nim: 'asc' },
            include: {
                profile: true,
                positions: {
                    where: { isActive: true },
                    include: {
                        positionSlot: {
                            include: {
                                organization: { select: { name: true } },
                                department: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });
        // Hitung jumlah
        const total = mahasiswa.length;
        // Siapkan CSV content
        const rows = [HEADER_LAHAN];
        for (let i = 0; i < mahasiswa.length; i++) {
            const m = mahasiswa[i];
            const angkatan = (0, account_lifecycle_service_1.hitungAngkatan)(m.nim);
            const jabatan = m.positions[0]?.positionSlot.title ?? '-';
            const organisasi = m.positions[0]?.positionSlot.organization.name ?? '-';
            const status = m.isActive ? 'Aktif' : 'Nonaktif';
            const dilarang = m.first_login ? 'Belum ganti password' : 'Aktif';
            rows.push([
                String(i + 1),
                m.nim,
                m.profile?.nama ?? '-',
                m.profile?.program_studi ?? '-',
                m.email ?? m.profile?.email ?? '-',
                m.profile?.no_hp ?? '-',
                String(angkatan ?? '-'),
                m.role,
                jabatan,
                organisasi,
                status,
                dilarang,
                m.tenggatHapus ? new Date(m.tenggatHapus).toLocaleDateString('id-ID') : '-',
            ]);
        }
        // Buat CSV string
        const csvContent = rows.map((row) => row.map((cell) => {
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',')).join('\n');
        // Header untuk file download
        const fileName = `data-mahasiswa-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await (0, audit_service_1.logActivity)(req.user.id, 'EXPORT_STUDENTS', 'Student', `Mengekspor data mahasiswa: ${total} baris dicetak ke CSV`, undefined, { total, filters: { search: String(search || ''), status: String(status || 'ALL'), role: String(role || 'ALL') } });
        res.send(csvContent);
    }
    catch (error) {
        next(error);
    }
};
exports.exportMahasiswa = exportMahasiswa;
