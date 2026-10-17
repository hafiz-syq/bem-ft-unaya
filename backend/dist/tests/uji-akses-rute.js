"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const bantu_uji_1 = require("./bantu-uji");
/** 403 tidak boleh menyertakan isi data mahasiswa. */
const tanpaIsiCsv = (peran, hasil) => hasil.status !== 200 && hasil.body.includes('Program Studi')
    ? 'balasan penolakan masih memuat isi CSV'
    : null;
const BARIS = [
    // ── auth.routes.ts ──────────────────────────────────────────────────────
    { metode: 'GET', jalur: '/auth/me', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    {
        metode: 'POST',
        jalur: '/auth/login',
        harapan: { tamu: 'DIIZINKAN' },
        dilewati: 'endpoint login dibatasi 5 permintaan / 5 menit / IP — memanggilnya berulang akan mengunci percobaan login yang sah',
    },
    { metode: 'POST', jalur: '/auth/first-login', harapan: { tamu: 401 } },
    { metode: 'POST', jalur: '/auth/verify-email', harapan: { tamu: 401 } },
    { metode: 'POST', jalur: '/auth/resend-verification', harapan: { tamu: 401 } },
    { metode: 'POST', jalur: '/auth/logout', harapan: { tamu: 'DIIZINKAN' }, amanDiuji: true },
    // ── profile.routes.ts ───────────────────────────────────────────────────
    { metode: 'GET', jalur: '/profile/me', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'PUT', jalur: '/profile/me', harapan: { tamu: 401 } },
    { metode: 'POST', jalur: '/profile/me/photo', harapan: { tamu: 401 } },
    // ── ticket.routes.ts ────────────────────────────────────────────────────
    { metode: 'GET', jalur: '/tickets/public', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'GET', jalur: '/tickets/assignees', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    {
        metode: 'GET',
        jalur: '/tickets/export/keluhan',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
        temuan: 'hanya ADMIN dan PENGURUS DPM yang boleh mengaudit keluhan (canExportKeluhan); PENGURUS BEM termasuk ditolak. Pastikan memang begitu yang diinginkan.',
    },
    { metode: 'GET', jalur: '/tickets', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/tickets', harapan: { tamu: 401 } },
    { metode: 'POST', jalur: '/tickets/:id/replies', harapan: { tamu: 401 } },
    { metode: 'POST', jalur: '/tickets/:id/assign', harapan: { tamu: 401 } },
    { metode: 'PUT', jalur: '/tickets/:id/moderation', harapan: { tamu: 401 } },
    // ── organization.routes.ts (seluruh rute: ADMIN) ─────────────────────────
    { metode: 'GET', jalur: '/organizations', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/organizations', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'POST', jalur: '/organizations/departments', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'DELETE', jalur: '/organizations/departments/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'DELETE', jalur: '/organizations/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    // ── position.routes.ts ──────────────────────────────────────────────────
    { metode: 'GET', jalur: '/positions', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    {
        metode: 'POST',
        jalur: '/positions/slots',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
        temuan: 'route hanya memakai requireAuth tanpa penjaga peran, jadi akun mana pun yang login bisa membuat slot jabatan (probe body kosong ditolak 400 oleh validasi, bukan oleh pemeriksaan peran).',
    },
    {
        metode: 'POST',
        jalur: '/positions/assign',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
        temuan: 'route hanya memakai requireAuth; dengan body yang sah akun mana pun bisa mengangkat pengurus (bahkan menaikkan dirinya dari MAHASISWA menjadi PENGURUS).',
    },
    {
        metode: 'DELETE',
        jalur: '/positions/:idJabatan',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
        catatan: 'memakai id jabatan yang benar-benar ada supaya 403 berasal dari pemeriksaan peran di controller, bukan dari 404 data tidak ditemukan',
    },
    // ── data-request.routes.ts ──────────────────────────────────────────────
    { metode: 'GET', jalur: '/data-requests', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/data-requests', harapan: { tamu: 401 } },
    {
        metode: 'PUT',
        jalur: '/data-requests/:id/process',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
        temuan: 'route hanya memakai requireAuth dan controller tidak memeriksa peran maupun kepemilikan, jadi akun mana pun bisa memproses pengajuan perubahan data orang lain (seharusnya admin/pengurus).',
    },
    // ── audit.routes.ts ─────────────────────────────────────────────────────
    {
        metode: 'GET',
        jalur: '/audit',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
        temuan: 'route hanya memakai requireAuth, sehingga mahasiswa bisa membaca seluruh audit log, padahal menu Audit Log hanya ditampilkan untuk admin di antarmuka.',
    },
    // ── notification.routes.ts ──────────────────────────────────────────────
    { metode: 'GET', jalur: '/notifications', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'PUT', jalur: '/notifications/read-all', harapan: { tamu: 401 } },
    // ── public-comment.routes.ts ────────────────────────────────────────────
    { metode: 'GET', jalur: '/public-comments', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    {
        metode: 'POST',
        jalur: '/public-comments',
        harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' },
        amanDiuji: true,
        catatan: 'body kosong selalu ditolak validasi 400, jadi tidak ada komentar yang benar-benar tersimpan',
    },
    { metode: 'GET', jalur: '/public-comments/manage', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'PATCH', jalur: '/public-comments/manage/:id/status', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'POST', jalur: '/public-comments/manage/:id/replies', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'GET', jalur: '/public-comments/:commentId/replies', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'PATCH', jalur: '/public-comments/:commentId/replies/:replyId', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'DELETE', jalur: '/public-comments/:commentId/replies/:replyId', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'POST', jalur: '/public-comments/:commentId/report', harapan: { tamu: 401 } },
    // ── dashboard.routes.ts ─────────────────────────────────────────────────
    { metode: 'GET', jalur: '/dashboard/stats', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    // ── cms.routes.ts ───────────────────────────────────────────────────────
    { metode: 'GET', jalur: '/cms/settings', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
    { metode: 'PUT', jalur: '/cms/settings', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'GET', jalur: '/cms/structure', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
    { metode: 'GET', jalur: '/cms/agendas', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/cms/agendas', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'PUT', jalur: '/cms/agendas/:id', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'DELETE', jalur: '/cms/agendas/:id', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'GET', jalur: '/cms/galleries', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/cms/galleries', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'PUT', jalur: '/cms/galleries/:id', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'DELETE', jalur: '/cms/galleries/:id', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'GET', jalur: '/cms', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/cms', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'GET', jalur: '/cms/:id', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
    { metode: 'PUT', jalur: '/cms/:id', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'DELETE', jalur: '/cms/:id', harapan: { tamu: 401, mahasiswa: 403 } },
    // ── demisioner.routes.ts ────────────────────────────────────────────────
    { metode: 'GET', jalur: '/demisioner', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/demisioner', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'PUT', jalur: '/demisioner/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'DELETE', jalur: '/demisioner/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    // ── faq.routes.ts ───────────────────────────────────────────────────────
    { metode: 'GET', jalur: '/faqs', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/faqs', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'PUT', jalur: '/faqs/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'DELETE', jalur: '/faqs/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    // ── notifikasi-perpanjangan.routes.ts ───────────────────────────────────
    {
        metode: 'POST',
        jalur: '/notifikasi-perpanjangan/check',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
        catatan: 'sel admin sengaja tidak diuji: menjalankan pemeriksaan perpanjangan nyata (mengirim email ke admin)',
    },
    // ── student-exports.routes.ts + student.routes.ts ───────────────────────
    {
        metode: 'GET',
        jalur: '/students/export',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
        cek: tanpaIsiCsv,
        catatan: 'pemeriksaan tambahan: balasan penolakan tidak boleh memuat isi CSV',
    },
    { metode: 'GET', jalur: '/students', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
    { metode: 'POST', jalur: '/students', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'PATCH', jalur: '/students/:id/status', harapan: { tamu: 401, mahasiswa: 403 } },
    { metode: 'PATCH', jalur: '/students/:id/perpanjangan', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'PATCH', jalur: '/students/:id/role', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
    {
        metode: 'POST',
        jalur: '/students/maintenance/run-lifecycle',
        harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
        catatan: 'sel admin sengaja tidak diuji: menjalankan siklus hidup akun nyata (bisa menonaktifkan/menghapus akun)',
    },
    { metode: 'POST', jalur: '/students/import/pratinjau', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    { metode: 'POST', jalur: '/students/import/simpan', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
    // ── rute yang didaftarkan langsung di app.ts ────────────────────────────
    { metode: 'GET', jalur: '/health', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
];
const NAMA_PERAN = {
    tamu: 'tamu (tanpa sesi)',
    mahasiswa: 'mahasiswa',
    pengurus: 'pengurus biasa (PENGURUS_BEM)',
    admin: 'admin',
};
/** Ganti penanda `:param` dengan id nyata/tidak ada. */
function betulkanJalur(jalur, idJabatan) {
    return jalur.replace(':idJabatan', idJabatan).replace(/:(id|commentId|replyId)/g, bantu_uji_1.ID_TIDAK_ADA);
}
/**
 * Id jabatan (Position) untuk menguji DELETE /positions/:id.
 *
 * Memakai jabatan yang sudah ada supaya probe 403 benar-benar ditolak oleh
 * pemeriksaan peran di controller, bukan oleh 404 data tidak ditemukan. Bila
 * basis data belum punya jabatan (mis. basis data CI yang kosong), jabatan uji
 * dibuat sementara lalu dihapus kembali.
 */
async function siapkanIdJabatan(akunMahasiswa) {
    const sudahAda = await prisma_1.default.position.findFirst({ select: { id: true } });
    if (sudahAda)
        return { id: sudahAda.id, bersihkan: async () => { } };
    const organisasi = await prisma_1.default.organization.create({ data: { name: 'UJI Akses Rute' }, select: { id: true } });
    const slot = await prisma_1.default.positionSlot.create({
        data: { organizationId: organisasi.id, title: 'UJI Jabatan' },
        select: { id: true },
    });
    const jabatan = await prisma_1.default.position.create({
        data: { positionSlotId: slot.id, userId: akunMahasiswa.id },
        select: { id: true },
    });
    return {
        id: jabatan.id,
        bersihkan: async () => {
            await prisma_1.default.position.deleteMany({ where: { id: jabatan.id } });
            await prisma_1.default.positionSlot.deleteMany({ where: { id: slot.id } });
            await prisma_1.default.organization.deleteMany({ where: { id: organisasi.id } });
        },
    };
}
/** Cocokkan hasil nyata dengan harapan. */
async function jalankanBaris(baris, akun, idJabatan, laporan) {
    const label = `${baris.metode} /api${baris.jalur}`;
    if (baris.dilewati) {
        laporan.lewati(label, baris.dilewati);
        return;
    }
    if (baris.catatan)
        console.log(`          catatan: ${baris.catatan}`);
    const jalur = betulkanJalur(baris.jalur, idJabatan);
    let adaKetidaksesuaian = false;
    for (const peran of ['tamu', 'mahasiswa', 'pengurus', 'admin']) {
        const harapan = baris.harapan[peran];
        if (harapan === undefined)
            continue;
        const nama = `${label} [${NAMA_PERAN[peran]}]`;
        if (baris.metode !== 'GET' && harapan === 'DIIZINKAN' && !baris.amanDiuji) {
            laporan.lewati(nama, 'sel "diizinkan" tidak diuji pada metode yang mengubah data');
            continue;
        }
        const cookie = peran === 'tamu' ? undefined : akun[peran].cookie;
        const hasil = await (0, bantu_uji_1.minta)(jalur, { metode: baris.metode, cookie });
        const sesuai = harapan === 'DIIZINKAN' ? hasil.status !== 401 && hasil.status !== 403 : hasil.status === harapan;
        if (!sesuai) {
            adaKetidaksesuaian = true;
            if (baris.temuan)
                laporan.catatTemuan(nama, baris.temuan, hasil.status, harapan);
            else
                laporan.gagalkan(nama, hasil.status, harapan);
            continue;
        }
        const pesanCek = baris.cek?.(peran, hasil) ?? null;
        if (pesanCek) {
            laporan.gagalkan(`${nama} — ${pesanCek}`, hasil.status, harapan);
            continue;
        }
        laporan.luluskan(`${nama} → ${hasil.status}`);
    }
    // Baris bertanda `temuan` yang ternyata sudah sesuai harapan tetap dilaporkan,
    // supaya pertanyaannya tidak ikut hilang hanya karena aturannya cocok.
    if (baris.temuan && !adaKetidaksesuaian)
        laporan.catatKonfirmasi(label, baris.temuan);
}
function bacaBerkasRute(namaBerkas) {
    for (const ekstensi of ['.ts', '.js']) {
        const jalur = path_1.default.join(__dirname, '..', 'routes', `${namaBerkas}${ekstensi}`);
        if (fs_1.default.existsSync(jalur))
            return fs_1.default.readFileSync(jalur, 'utf8');
    }
    return null;
}
function normalisasi(metode, jalur) {
    return `${metode.toUpperCase()} ${jalur.replace(/:[^/]+/g, ':').replace(/\/+$/, '') || '/'}`;
}
/**
 * Mendaftar seluruh rute yang benar-benar terpasang (mengikuti `app.use` di app.ts),
 * supaya rute baru tidak bisa lolos dari pengujian tanpa terdeteksi.
 */
function daftarRuteTerpasang() {
    const berkasApp = path_1.default.join(__dirname, '..', 'app.ts');
    const sumberApp = fs_1.default.existsSync(berkasApp) ? fs_1.default.readFileSync(berkasApp, 'utf8') : '';
    const impor = new Map();
    for (const cocok of sumberApp.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/([\w.-]+)'/g)) {
        impor.set(cocok[1], cocok[2]);
    }
    const terpasang = [];
    const dipakai = new Set();
    for (const cocok of sumberApp.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
        const [, awalan, variabel] = cocok;
        const namaBerkas = impor.get(variabel);
        if (!namaBerkas)
            continue;
        dipakai.add(variabel);
        const isi = bacaBerkasRute(namaBerkas);
        if (!isi)
            continue;
        for (const rute of isi.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
            const kunci = normalisasi(rute[1], `${awalan}${rute[2]}`);
            if (!terpasang.some((t) => t.kunci === kunci)) {
                terpasang.push({ kunci, berkas: `${namaBerkas}.ts` });
            }
        }
    }
    // Rute yang didaftarkan langsung di app.ts, mis. /api/health
    for (const rute of sumberApp.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
        terpasang.push({ kunci: normalisasi(rute[1], rute[2]), berkas: 'app.ts' });
    }
    const berkasTidakTerpasang = [...impor.entries()]
        .filter(([variabel]) => !dipakai.has(variabel))
        .map(([, namaBerkas]) => `${namaBerkas}.ts`);
    return { terpasang, berkasTidakTerpasang };
}
async function main() {
    console.log(`\n=== UJI AKSES RUTE (401/403) ===\nAPI: ${bantu_uji_1.API_URL}\n`);
    await (0, bantu_uji_1.pastikanServerHidup)();
    const akun = await (0, bantu_uji_1.siapkanAkunUji)();
    const semuaAkun = Object.values(akun);
    const jabatan = await siapkanIdJabatan(akun.mahasiswa);
    const laporan = new bantu_uji_1.Laporan();
    try {
        console.log('--- Aturan per endpoint ---');
        for (const baris of BARIS) {
            await jalankanBaris(baris, akun, jabatan.id, laporan);
        }
        console.log('\n--- Kelengkapan cakupan ---');
        const { terpasang, berkasTidakTerpasang } = daftarRuteTerpasang();
        const kunciMatriks = new Set(BARIS.map((b) => normalisasi(b.metode, `/api${b.jalur}`)));
        const tanpaBaris = terpasang.filter((r) => !kunciMatriks.has(r.kunci));
        for (const rute of tanpaBaris) {
            laporan.gagalkan(`Rute ${rute.kunci} belum punya baris di BARIS (berkas ${rute.berkas})`, 'tidak ada baris', 'ada baris');
        }
        const ruteTerpasang = new Set(terpasang.map((r) => r.kunci));
        for (const kunci of kunciMatriks) {
            if (!ruteTerpasang.has(kunci)) {
                laporan.gagalkan(`Baris ${kunci} tidak cocok dengan rute mana pun`, 'tidak terdaftar', 'terdaftar');
            }
        }
        if (tanpaBaris.length === 0) {
            console.log(`  LULUS   Semua ${terpasang.length} rute terpasang punya baris pengujian`);
            laporan.lulus++;
        }
        for (const berkas of berkasTidakTerpasang) {
            console.log(`  PERHATIAN  Berkas rute ${berkas} tidak dipasang di app.ts (rutenya tidak bisa dipanggil)`);
        }
    }
    finally {
        await jabatan.bersihkan();
        await (0, bantu_uji_1.hapusAkunUji)(semuaAkun);
        console.log(`\nAkun uji dihapus kembali: ${semuaAkun.map((a) => a.nim).join(', ')}`);
    }
    laporan.ringkas('UJI AKSES');
    if (laporan.gagal > 0)
        process.exitCode = 1;
    console.log(laporan.gagal === 0 ? '\nHASIL: TIDAK ADA REGRESI ATURAN AKSES\n' : '\nHASIL: ADA ATURAN YANG TIDAK SESUAI\n');
}
main()
    .catch((e) => {
    console.error('\nERROR:', e.message || e);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
