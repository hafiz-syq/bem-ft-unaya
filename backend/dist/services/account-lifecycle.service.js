"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sedangDiperpanjang = exports.tenggatHapusEfektif = exports.tenggatHapusBawaan = exports.hitungAngkatan = exports.TENGGANG_HAPUS_HARI = exports.MASA_STUDI_TAHUN = void 0;
exports.purgeStudentAccount = purgeStudentAccount;
exports.runAccountLifecycleJob = runAccountLifecycleJob;
exports.startAccountLifecycleJob = startAccountLifecycleJob;
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("./audit.service");
/**
 * Siklus hidup akun mahasiswa.
 *
 * Aturan bisnis:
 * 1. Mahasiswa yang sudah 5 tahun sejak tahun angkatannya otomatis dinonaktifkan.
 *    Tahun angkatan dibaca dari 2 digit pertama NIM (contoh: 2214xxxx -> 2022).
 * 2. Akun yang dinonaktifkan OTOMATIS dan sudah menganggur 1 tahun akan dihapus
 *    permanen beserta seluruh data turunannya.
 * 3. Akun yang dinonaktifkan MANUAL tidak pernah dihapus otomatis; admin/pengurus
 *    masih bisa mengaktifkannya kembali.
 * 4. Hanya role MAHASISWA yang terkena aturan ini. Pengurus dan admin tidak
 *    pernah dinonaktifkan otomatis supaya kepengurusan tidak mendadak mati.
 * 5. Admin boleh menggeser tenggat hapus (tenggatHapus) dan memberi perpanjangan
 *    masa studi (perpanjanganHingga). Selama perpanjangan belum lewat, akun tidak
 *    dinonaktifkan otomatis walau angkatannya sudah lewat 5 tahun.
 */
exports.MASA_STUDI_TAHUN = 5;
exports.TENGGANG_HAPUS_HARI = 365;
/** Mengubah NIM menjadi tahun angkatan. Mengembalikan null jika NIM tidak valid. */
const hitungAngkatan = (nim) => {
    const digit = nim.slice(0, 2);
    if (!/^\d{2}$/.test(digit))
        return null;
    return 2000 + parseInt(digit, 10);
};
exports.hitungAngkatan = hitungAngkatan;
/** Tenggat hapus bawaan sebuah akun: 1 tahun sejak dinonaktifkan otomatis. */
const tenggatHapusBawaan = (deactivatedAt) => new Date(deactivatedAt.getTime() + exports.TENGGANG_HAPUS_HARI * 24 * 60 * 60 * 1000);
exports.tenggatHapusBawaan = tenggatHapusBawaan;
/**
 * Tenggat hapus yang benar-benar dipakai job dan ditampilkan ke admin.
 * Kolom tenggatHapus menang bila terisi (admin sudah menggesernya); kalau kosong,
 * aturan bawaan (deactivatedAt + 1 tahun) yang berlaku.
 * Mengembalikan null untuk akun yang tidak sedang menunggu penghapusan.
 */
const tenggatHapusEfektif = (akun) => {
    if (akun.isActive || akun.deactivationType !== 'AUTO')
        return null;
    if (akun.tenggatHapus)
        return akun.tenggatHapus;
    return akun.deactivatedAt ? (0, exports.tenggatHapusBawaan)(akun.deactivatedAt) : null;
};
exports.tenggatHapusEfektif = tenggatHapusEfektif;
/**
 * Apakah akun ini masih dilindungi perpanjangan masa studi?
 * Dipakai job otomatis DAN endpoint perpanjang supaya keduanya tidak pernah
 * berbeda tafsir.
 */
const sedangDiperpanjang = (akun, sekarang = new Date()) => Boolean(akun.perpanjanganHingga && akun.perpanjanganHingga > sekarang);
exports.sedangDiperpanjang = sedangDiperpanjang;
/**
 * Menghapus akun beserta SEMUA data turunannya dalam satu transaksi.
 * Urutannya penting: baris yang punya foreign key wajib dibersihkan lebih dulu.
 */
async function purgeStudentAccount(userId) {
    // Penjaga terakhir: akun pengelola tidak boleh terhapus lewat jalur mana pun,
    // termasuk job otomatis yang datanya mungkin sudah tidak sinkron.
    const akun = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    if (akun && (akun.role === 'ADMIN' || akun.role === 'SUPERADMIN')) {
        throw new Error('Akun administrator/superadmin tidak boleh dihapus oleh siklus hidup otomatis.');
    }
    await prisma_1.default.$transaction(async (tx) => {
        // 1. Tiket yang ia kirim: lampiran, balasan, dan penugasan harus lebih dulu.
        const tickets = await tx.ticket.findMany({ where: { senderId: userId }, select: { id: true } });
        const ticketIds = tickets.map((t) => t.id);
        if (ticketIds.length > 0) {
            await tx.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
            await tx.ticketReply.deleteMany({ where: { ticketId: { in: ticketIds } } });
            await tx.ticketAssignment.deleteMany({ where: { ticketId: { in: ticketIds } } });
            await tx.ticket.deleteMany({ where: { id: { in: ticketIds } } });
        }
        // 2. Balasan buku tamu yang pernah ia tulis sebagai pengurus/admin.
        //    Tabel balasan tidak memakai cascade ke User, jadi harus dibersihkan
        //    lebih dulu sebelum akunnya dihapus.
        await tx.publicCommentReply.deleteMany({ where: { authorId: userId } });
        // 3. Jejak sebagai pengurus pada tiket milik orang lain.
        await tx.ticketReply.deleteMany({ where: { authorId: userId } });
        await tx.ticketAssignment.deleteMany({
            where: { OR: [{ assigneeId: userId }, { assignerId: userId }] },
        });
        await tx.ticket.updateMany({
            where: { moderatedById: userId },
            data: { moderatedById: null, moderatedAt: null },
        });
        // 4. Pengajuan perubahan data (sebagai pemilik maupun sebagai peninjau).
        await tx.dataChangeRequest.deleteMany({ where: { userId } });
        await tx.dataChangeRequest.updateMany({
            where: { reviewedById: userId },
            data: { reviewedById: null },
        });
        // 5. Moderasi komentar publik miliknya, dan konten yang ia terbitkan.
        await tx.publicComment.updateMany({
            where: { moderatedById: userId },
            data: { moderatedById: null, moderatedAt: null },
        });
        await tx.content.deleteMany({ where: { authorId: userId } });
        await tx.agenda.deleteMany({ where: { authorId: userId } });
        const galleries = await tx.gallery.findMany({
            where: { uploaderId: userId },
            select: { id: true },
        });
        if (galleries.length > 0) {
            const galleryIds = galleries.map((g) => g.id);
            await tx.galleryImage.deleteMany({ where: { galleryId: { in: galleryIds } } });
            await tx.gallery.deleteMany({ where: { id: { in: galleryIds } } });
        }
        // 6. Sisanya: jabatan, notifikasi, audit log miliknya, profil, lalu akunnya.
        await tx.position.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.auditLog.deleteMany({ where: { actorId: userId } });
        await tx.emailVerification.deleteMany({ where: { userId } });
        await tx.studentProfile.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
    });
}
/** Menjalankan kedua aturan otomatis sekali jalan. Aman dipanggil berulang kali. */
async function runAccountLifecycleJob() {
    const sekarang = new Date();
    const batasAngkatan = sekarang.getFullYear() - exports.MASA_STUDI_TAHUN;
    // --- 0. Akun pengelola tidak pernah nonaktif ---
    // Job ini adalah jaring pengaman terakhir: kalau status nonaktif terlanjur
    // tertulis pada akun ADMIN/SUPERADMIN (mis. perubahan manual di database),
    // akunnya dipulihkan di sini dan kejadiannya dicatat ke audit log.
    const pemulihan = await prisma_1.default.user.updateMany({
        where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, isActive: false },
        data: { isActive: true, deactivatedAt: null, deactivationType: null, tenggatHapus: null },
    });
    // --- 1. Nonaktifkan otomatis mahasiswa yang masa studinya habis ---
    // Akun yang sedang dalam perpanjangan masa studi dilewati, walau angkatannya
    // sudah lewat batas, supaya keputusan admin tidak langsung dibatalkan job ini.
    const mahasiswaAktif = await prisma_1.default.user.findMany({
        where: { isActive: true, role: 'MAHASISWA' },
        select: { id: true, nim: true, perpanjanganHingga: true },
    });
    const akanDinonaktifkan = mahasiswaAktif.filter((u) => {
        const angkatan = (0, exports.hitungAngkatan)(u.nim);
        if (angkatan === null || angkatan > batasAngkatan)
            return false;
        return !(0, exports.sedangDiperpanjang)(u, sekarang);
    });
    if (akanDinonaktifkan.length > 0) {
        await prisma_1.default.user.updateMany({
            where: { id: { in: akanDinonaktifkan.map((u) => u.id) } },
            data: {
                isActive: false,
                deactivatedAt: sekarang,
                deactivationType: 'AUTO',
                // Tenggat hapus diisi nyata saat nonaktif, bukan dibiarkan kosong, supaya
                // admin bisa melihat dan menggeser tanggalnya kapan saja.
                tenggatHapus: (0, exports.tenggatHapusBawaan)(sekarang),
            },
        });
    }
    // --- 2. Hapus akun nonaktif-otomatis yang sudah lewat tenggatnya ---
    // Tenggat per akun dipakai bila ada (hasil geseran admin), sisanya mengikuti
    // aturan bawaan deactivatedAt + 1 tahun.
    const batasHapus = new Date(sekarang.getTime() - exports.TENGGANG_HAPUS_HARI * 24 * 60 * 60 * 1000);
    const akanDihapus = await prisma_1.default.user.findMany({
        where: {
            isActive: false,
            deactivationType: 'AUTO',
            // Akun pengelola tidak pernah ikut dihapus, walau datanya tidak sinkron.
            role: { notIn: ['ADMIN', 'SUPERADMIN'] },
            OR: [
                { tenggatHapus: { lte: sekarang } },
                { tenggatHapus: null, deactivatedAt: { lte: batasHapus } },
            ],
        },
        select: { id: true, nim: true },
    });
    const gagal = [];
    for (const akun of akanDihapus) {
        try {
            await purgeStudentAccount(akun.id);
        }
        catch (error) {
            const pesan = error instanceof Error ? error.message : String(error);
            gagal.push(akun.nim);
            console.error(`[siklus akun] Gagal menghapus ${akun.nim}:`, pesan);
        }
    }
    const hasil = {
        dinonaktifkan: akanDinonaktifkan.length,
        dihapus: akanDihapus.length - gagal.length,
        dipulihkan: pemulihan.count,
        gagal,
        detailDinonaktifkan: akanDinonaktifkan.map((u) => u.nim),
    };
    if (pemulihan.count > 0) {
        await (0, audit_service_1.logSystemActivity)('RESTORE_ADMIN_ACCOUNT', 'User', `${pemulihan.count} akun administrator/superadmin yang sempat nonaktif dipulihkan otomatis`, undefined, { total: pemulihan.count });
    }
    if (hasil.dinonaktifkan > 0 || hasil.dihapus > 0 || gagal.length > 0) {
        console.log(`[siklus akun] ${hasil.dinonaktifkan} dinonaktifkan otomatis, ` +
            `${hasil.dihapus} dihapus permanen, ${gagal.length} gagal.`);
        // Perubahan massal ini dicatat sebagai peristiwa SISTEM (actor = null) supaya
        // admin bisa menelusurinya di halaman Audit Log, bukan hanya dari console
        // server. Daftar NIM dibatasi agar metadata tidak membengkak.
        if (hasil.dinonaktifkan > 0) {
            await (0, audit_service_1.logSystemActivity)('AUTO_DEACTIVATE_ACCOUNT', 'User', `${hasil.dinonaktifkan} akun mahasiswa dinonaktifkan otomatis karena melewati masa studi ${exports.MASA_STUDI_TAHUN} tahun`, undefined, {
                total: hasil.dinonaktifkan,
                tenggatHapusHari: exports.TENGGANG_HAPUS_HARI,
                contohNim: hasil.detailDinonaktifkan.slice(0, 50),
            });
        }
        if (hasil.dihapus > 0) {
            await (0, audit_service_1.logSystemActivity)('AUTO_DELETE_ACCOUNT', 'User', `${hasil.dihapus} akun nonaktif-otomatis dihapus permanen setelah melewati tenggat penghapusan`, undefined, { total: hasil.dihapus, tenggatHapusHari: exports.TENGGANG_HAPUS_HARI });
        }
        if (gagal.length > 0) {
            await (0, audit_service_1.logSystemActivity)('AUTO_DELETE_ACCOUNT_FAILED', 'User', `Gagal menghapus ${gagal.length} akun nonaktif-otomatis`, undefined, { total: gagal.length, nims: gagal.slice(0, 50) });
        }
    }
    return hasil;
}
let timer = null;
/** Menjalankan job sekali saat server hidup, lalu setiap 12 jam. */
function startAccountLifecycleJob() {
    if (timer)
        return;
    const jalankan = () => runAccountLifecycleJob().catch((error) => console.error('[siklus akun] Job gagal:', error));
    jalankan();
    const DUA_BELAS_JAM = 12 * 60 * 60 * 1000;
    timer = setInterval(jalankan, DUA_BELAS_JAM);
    // Jangan menahan proses tetap hidup hanya karena timer ini.
    timer.unref?.();
}
