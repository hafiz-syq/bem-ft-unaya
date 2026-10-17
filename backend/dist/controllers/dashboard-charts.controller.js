"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportImporCsv = exports.getDashboardCharts = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getDashboardCharts = async (req, res, next) => {
    try {
        // --- 1. Tren komentar publik per bulan (12 bulan terakhir) ---
        const sekarang = new Date();
        const satuDuaBelasBulankeDepan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 1);
        const duaBelasBulankeLalu = new Date(sekarang.getFullYear(), sekarang.getMonth() - 11, 1);
        // Kirim query raw ke Prisma agar kita bisa kelompokkan berdasarkan bulan.
        // Prisma tidak mendukung extract() secara native di semua DB, jadi kita
        // mengambil data mentah kemudian kelompokkan manual di sisi Node.
        const komentarMentah = await prisma_1.default.publicComment.findMany({
            where: {
                createdAt: {
                    gte: duaBelasBulankeLalu,
                    lt: satuDuaBelasBulankeDepan,
                },
            },
            select: {
                createdAt: true,
                status: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        // Kelompokkan per bulan (format YYYY-MM)
        const petaBulanan = new Map();
        for (let i = 0; i < 12; i++) {
            const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - (11 - i), 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            petaBulanan.set(key, { total: 0, approved: 0, rejected: 0 });
        }
        for (const baris of komentarMentah) {
            const d = baris.createdAt;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const existing = petaBulanan.get(key) ?? { total: 0, approved: 0, rejected: 0 };
            existing.total += 1;
            if (baris.status === 'APPROVED')
                existing.approved += 1;
            if (baris.status === 'REJECTED')
                existing.rejected += 1;
            petaBulanan.set(key, existing);
        }
        const komentarPerBulan = [];
        const urutanKunci = Array.from(petaBulanan.keys()).sort();
        for (const k of urutanKunci) {
            komentarPerBulan.push({
                label: k,
                nilai: petaBulanan.get(k).total,
            });
        }
        // --- 2. Tren impor mahasiswa per bulan (berdasarkan audit log IMPORT_STUDENTS_SIMPAN) ---
        const imporMentah = await prisma_1.default.auditLog.findMany({
            where: {
                action: 'IMPORT_STUDENTS_SIMPAN',
                createdAt: {
                    gte: duaBelasBulankeLalu,
                    lt: satuDuaBelasBulankeDepan,
                },
            },
            select: {
                createdAt: true,
                metadata: true,
            },
        });
        const petaBulananImpor = new Map();
        for (let i = 0; i < 12; i++) {
            const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - (11 - i), 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            petaBulananImpor.set(key, 0);
        }
        for (const baris of imporMentah) {
            const d = baris.createdAt;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            petaBulananImpor.set(key, (petaBulananImpor.get(key) ?? 0) + 1);
        }
        const imporPerBulan = [];
        for (const k of Array.from(petaBulananImpor.keys()).sort()) {
            imporPerBulan.push({
                label: k,
                nilai: petaBulananImpor.get(k),
            });
        }
        // --- 3. Status komentar (selalu terbaru) ---
        const [menunggu, disetujui, ditolak] = await Promise.all([
            prisma_1.default.publicComment.count({ where: { status: 'PENDING' } }),
            prisma_1.default.publicComment.count({ where: { status: 'APPROVED' } }),
            prisma_1.default.publicComment.count({ where: { status: 'REJECTED' } }),
        ]);
        // --- 4. Ringkasan impor (akumulasi dari log, bukan real-time) ---
        // Total dari metadata log, batasi 1000 baris terakhir agar tidak berat
        const imporBarisTerakhir = await prisma_1.default.auditLog.findMany({
            where: { action: 'IMPORT_STUDENTS_SIMPAN' },
            orderBy: { createdAt: 'desc' },
            take: 1000,
            select: { metadata: true },
        });
        let totalDibuat = 0;
        let totalDilewati = 0;
        let totalGagal = 0;
        for (const baris of imporBarisTerakhir) {
            const m = baris.metadata ?? {};
            totalDibuat += Number(m.akunDibuat ?? 0);
            totalDilewati += Number(m.akunDilewati ?? 0);
            totalGagal += Number(m.akunGagal ?? 0);
        }
        res.status(200).json({
            data: {
                komentarPerBulan,
                imporPerBulan,
                komentarPerStatus: {
                    menunggu,
                    disetujui,
                    ditolak,
                },
                imporTotal: {
                    totalImpor: imporBarisTerakhir.length,
                    totalDibuat,
                    totalDilewati,
                    totalGagal,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboardCharts = getDashboardCharts;
/** Endpoint kecil untuk format CSV laporan impor.
 * Dipanggil frontend bila ingin mendownload hasil impor dalam bentuk CSV.
 * URL: GET /api/dashboard/charts/export-impor?namaBerkas=xxx&totalDibaca=x&bermasalah=x&...
 * (Data diambil dari query params, bukan dari DB, karena frontend sudah punya datanya
 *   dari langkah pratinjau atau setelah simpan.)
 */
const exportImporCsv = async (req, res, next) => {
    try {
        const { namaBerkas, totalDibaca, bermasalah, laporan, // JSON string: array array [nama,nim,prodi,status]
        laporanBermasalah, // JSON string: array array [nama,nim,status]
        laporanGagalDb, // JSON string: array NIM yang gagal DB
        keteranganKolom, // JSON string: array nama kolom
         } = req.query;
        const kolom = JSON.parse(keteranganKolom || '["Nama","NIM","Program Studi","Status"]');
        const barisSiap = JSON.parse(laporan || '[]');
        const barisBermasalah = JSON.parse(laporanBermasalah || '[]');
        const barisGagalDb = JSON.parse(laporanGagalDb || '[]');
        // Gabung semua baris: siap, bermasalah, gagal DB
        const semuaBaris = [
            ...barisSiap,
            ...barisBermasalah.map((b) => [...b, 'DIBUANG']),
            ...barisGagalDb.map((nim) => [nim, '', '', 'GAGAL_DB']),
        ];
        // CSV content
        const header = kolom.join(',') + '\n';
        const rows = semuaBaris.map((row) => row.map((cell) => {
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',')).join('\n');
        const csv = header + rows;
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-impor-${namaBerkas || 'import'}.csv"`);
        res.send(csv);
    }
    catch (error) {
        next(error);
    }
};
exports.exportImporCsv = exportImporCsv;
