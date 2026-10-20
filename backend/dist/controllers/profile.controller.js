"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMyPhoto = exports.uploadMyPhoto = exports.updateMyEmail = exports.getMyProfile = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const uploads_1 = require("../lib/uploads");
const audit_service_1 = require("../services/audit.service");
const account_lifecycle_service_1 = require("../services/account-lifecycle.service");
const getMyProfile = async (req, res, next) => {
    try {
        const userId = req.user.id; // Didapat dari auth.middleware
        // Ambil data user beserta relasi tabel StudentProfile (jika ada)
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                // Jabatan aktif ditampilkan sebagai bagian biodata di halaman profil.
                positions: {
                    where: { isActive: true },
                    include: {
                        positionSlot: { include: { organization: true, department: true } }
                    }
                }
            }
        });
        if (!user) {
            res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
            return;
        }
        res.status(200).json({
            id: user.id,
            nim: user.nim,
            role: user.role,
            isActive: user.isActive,
            // Email akun untuk semua role: kolom User.email (admin/superadmin) atau
            // email profil (mahasiswa/pengurus). Dipakai form lupa password.
            email: user.email ?? user.profile?.email ?? null,
            // Angkatan dibaca dari 2 digit pertama NIM (misal: 2214... -> Angkatan 2022)
            angkatan: (0, account_lifecycle_service_1.hitungAngkatan)(user.nim),
            // Foto profil diprioritaskan dari tabel User supaya berlaku untuk SEMUA role,
            // termasuk admin yang tidak punya baris StudentProfile.
            foto: user.foto ?? user.profile?.foto ?? null,
            deactivatedAt: user.deactivatedAt,
            deactivationType: user.deactivationType,
            createdAt: user.createdAt,
            // email_verified ikut dikirim supaya halaman profil bisa menampilkan status
            // verifikasi tanpa perlu tahu detail kolom internal.
            profile: user.profile
                ? { ...user.profile, email_verified: Boolean(user.profile.email_verified_at) }
                : null, // Admin bernilai null karena tidak ada di tabel profile
            email_verified: Boolean(user.profile?.email_verified_at),
            jabatan: user.positions.map((p) => ({
                id: p.id,
                title: p.positionSlot.title,
                organisasi: p.positionSlot.organization.name,
                divisi: p.positionSlot.department?.name ?? null,
                startDate: p.startDate,
            }))
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyProfile = getMyProfile;
// Skema validasi email pribadi
const updateEmailSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email()
});
// Mengubah email pribadi milik pengguna yang sedang login.
// Hanya field email yang bisa diubah di sini; field profil lain tetap lewat pengajuan perubahan data.
const updateMyEmail = async (req, res, next) => {
    try {
        const userId = req.user.id; // Didapat dari auth.middleware
        const parsed = updateEmailSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Format email tidak valid.' });
            return;
        }
        const email = parsed.data.email.toLowerCase();
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { profile: true }
        });
        if (!user) {
            res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
            return;
        }
        // Email yang sama tidak boleh dipakai dua akun, karena lupa password
        // mencocokkan email ke akun. Diperiksa lebih dulu agar balasannya jelas.
        const dipakaiAkunLain = await prisma_1.default.user.findFirst({
            where: { email, id: { not: userId } },
            select: { id: true }
        });
        if (dipakaiAkunLain) {
            res.status(409).json({ message: 'Email ini sudah dipakai akun lain.' });
            return;
        }
        // Akun tanpa StudentProfile (ADMIN/SUPERADMIN) menyimpan emailnya di tabel
        // User, supaya fitur lupa password juga berlaku untuk mereka.
        if (!user.profile) {
            const emailBerubah = (user.email ?? null) !== email;
            await prisma_1.default.user.update({ where: { id: userId }, data: { email } });
            await (0, audit_service_1.logActivity)(userId, 'UPDATE_EMAIL', 'User', emailBerubah ? 'Pengguna mengubah email akunnya.' : 'Pengguna menyimpan ulang email akunnya.', userId);
            res.status(200).json({
                message: 'Email akun berhasil diperbarui.',
                emailBerubah,
                email,
                profile: null
            });
            return;
        }
        const emailBerubah = user.profile.email !== email;
        const updated = await prisma_1.default.$transaction(async (tx) => {
            // Email akun di tabel User ikut disamakan supaya lupa password membaca
            // alamat yang sama dengan yang tampil di profil.
            await tx.user.update({ where: { id: userId }, data: { email } });
            return tx.studentProfile.update({
                where: { userId },
                data: {
                    email,
                    // Email baru belum terbukti benar, jadi status verifikasi lama DIBATALKAN.
                    // Tanpa ini, sekali terverifikasi akan berlaku selamanya untuk alamat apa pun.
                    ...(emailBerubah ? { email_verified_at: null } : {})
                }
            });
        });
        if (emailBerubah) {
            // Kode lama dikirim ke alamat lama, jadi dibuang sekalian.
            // last_sent_at dikosongkan agar pengguna bisa langsung minta kode ke alamat baru.
            await prisma_1.default.emailVerification.updateMany({
                where: { userId },
                data: { code_hash: null, expires_at: null, attempts: 0, last_sent_at: null }
            });
        }
        await (0, audit_service_1.logActivity)(userId, 'UPDATE_EMAIL', 'StudentProfile', emailBerubah
            ? 'Pengguna mengubah email pribadinya (status verifikasi direset).'
            : 'Pengguna menyimpan ulang email pribadinya.', updated.id);
        res.status(200).json({
            message: emailBerubah
                ? 'Email berhasil diperbarui. Email baru perlu diverifikasi lagi.'
                : 'Email berhasil diperbarui.',
            emailBerubah,
            profile: { email: updated.email, email_verified: Boolean(updated.email_verified_at) }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMyEmail = updateMyEmail;
/**
 * Mengunggah / mengganti foto profil milik pengguna yang sedang login.
 * Berlaku untuk SEMUA role dan disimpan di kolom User.foto agar admin
 * (yang tidak punya StudentProfile) juga bisa punya foto.
 */
const uploadMyPhoto = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ message: 'Pilih file foto terlebih dahulu.' });
            return;
        }
        const foto = `/uploads/${file.filename}`;
        await prisma_1.default.user.update({ where: { id: req.user.id }, data: { foto } });
        // Profil (untuk mahasiswa/pengurus) disamakan agar tampilan lama tetap konsisten.
        await prisma_1.default.studentProfile.updateMany({ where: { userId: req.user.id }, data: { foto } });
        await (0, audit_service_1.logActivity)(req.user.id, 'UPDATE_PHOTO', 'User', 'Memperbarui foto profil', req.user.id);
        res.status(200).json({ message: 'Foto profil berhasil diperbarui.', foto });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadMyPhoto = uploadMyPhoto;
/**
 * Menghapus berkas foto dari folder uploads. Hanya nilai yang berbentuk
 * `/uploads/<nama berkas>` yang disentuh; `path.basename` menjaga agar nilai
 * kolom yang aneh (mis. berisi `../`) tidak bisa menghapus berkas lain.
 * Kegagalan hapus berkas tidak menggagalkan permintaan — kolom database tetap
 * sudah dikosongkan, dan berkas yatim hanya memakan disk.
 */
function hapusBerkasFoto(foto) {
    if (!foto || !foto.startsWith('/uploads/'))
        return;
    const berkas = path_1.default.join((0, uploads_1.folderUploads)(), path_1.default.basename(foto));
    fs_1.default.promises.unlink(berkas).catch(() => undefined);
}
/**
 * Menghapus foto profil milik pengguna yang sedang login.
 * Berlaku untuk SEMUA role, termasuk ADMIN/SUPERADMIN yang tidak punya baris
 * StudentProfile. Kedua kolom dikosongkan agar foto lama tidak muncul lagi
 * dari sumber cadangan (profil), lalu berkasnya dibuang dari folder uploads.
 */
const deleteMyPhoto = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { foto: true, profile: { select: { foto: true } } }
        });
        if (!user) {
            res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
            return;
        }
        // Foto bisa tersimpan di User (semua role) atau hanya di StudentProfile
        // (data lama). Keduanya dibaca supaya berkas yang benar ikut terhapus.
        const fotoLama = user.foto ?? user.profile?.foto ?? null;
        if (!fotoLama) {
            res.status(200).json({ message: 'Akun ini memang belum memiliki foto profil.', foto: null });
            return;
        }
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({ where: { id: userId }, data: { foto: null } }),
            prisma_1.default.studentProfile.updateMany({ where: { userId }, data: { foto: null } })
        ]);
        hapusBerkasFoto(fotoLama);
        await (0, audit_service_1.logActivity)(userId, 'DELETE_PHOTO', 'User', 'Menghapus foto profil', userId);
        res.status(200).json({ message: 'Foto profil berhasil dihapus.', foto: null });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteMyPhoto = deleteMyPhoto;
