"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifikasiKodeReset = exports.mintaResetPassword = exports.changePassword = exports.changePasswordSchema = exports.resendVerification = exports.verifyEmail = exports.completeFirstLogin = exports.completeFirstLoginSchema = exports.login = exports.buildAuthUser = exports.CODE_TTL_MINUTES = exports.loginSchema = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("../services/audit.service");
const email_service_1 = require("../services/email.service");
const cookies_1 = require("../lib/cookies");
const frontend_url_1 = require("../lib/frontend-url");
const ticket_access_1 = require("../lib/ticket-access");
const crypto_1 = __importDefault(require("crypto"));
exports.loginSchema = zod_1.z.object({
    nim: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1)
});
// --- Pengaturan verifikasi email ---
exports.CODE_TTL_MINUTES = 15; // masa berlaku kode
const MAX_VERIFY_ATTEMPTS = 5; // kode hangus setelah 5 kali salah
const RESEND_COOLDOWN_SECONDS = 60; // jeda minimal antar kirim ulang
/**
 * Bentuk data user yang dikirim ke frontend.
 * email & email_verified ikut dikirim supaya frontend bisa menahan pengguna
 * di halaman verifikasi selama emailnya belum terbukti benar.
 */
const buildAuthUser = (user, profile) => ({
    id: user.id,
    nim: user.nim,
    role: user.role,
    first_login: user.first_login,
    email: profile?.email ?? null,
    email_verified: Boolean(profile?.email_verified_at),
    // Foto profil & nama ikut dikirim agar header dashboard dan landing
    // tidak perlu memanggil API profil terpisah hanya untuk menampilkan avatar.
    foto: user.foto ?? profile?.foto ?? null,
    nama: profile?.nama ?? null
});
exports.buildAuthUser = buildAuthUser;
/**
 * Buat kode 6 digit, simpan hash-nya, lalu kirim ke email pengguna.
 * Mengembalikan true kalau email benar-benar berhasil dikirim.
 */
const issueVerificationCode = async (userId, profile) => {
    const code = crypto_1.default.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt_1.default.hash(code, 10);
    const dataKode = {
        code_hash: codeHash,
        expires_at: new Date(Date.now() + exports.CODE_TTL_MINUTES * 60 * 1000),
        attempts: 0,
        last_sent_at: new Date()
    };
    // Disimpan di tabel EmailVerification (terpisah dari StudentProfile)
    await prisma_1.default.emailVerification.upsert({
        where: { userId },
        create: { userId, ...dataKode },
        update: dataKode
    });
    return (0, email_service_1.sendVerificationEmail)(profile.email, profile.nama, code, exports.CODE_TTL_MINUTES);
};
const login = async (req, res, next) => {
    try {
        const { nim, password } = req.body;
        // 1. Cari user berdasarkan NIM (profil ikut diambil untuk status verifikasi email)
        const user = await prisma_1.default.user.findUnique({ where: { nim }, include: { profile: true } });
        if (!user) {
            res.status(401).json({ message: 'NIM atau Password salah.' });
            return; // WAJIB ADA agar eksekusi berhenti di sini
        }
        // 2. Validasi Password
        const isPasswordValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'NIM atau Password salah.' });
            return; // WAJIB ADA agar eksekusi berhenti di sini
        }
        // 3. Tolak akun yang sudah dinonaktifkan (mis. habis masa studi 5 tahun).
        // Pesannya dibedakan dari "NIM atau Password salah" supaya pengguna tidak
        // mengira lupa password padahal akunnya memang dinonaktifkan.
        //
        // Akun ADMIN/SUPERADMIN adalah pengecualian: statusnya dipulihkan di sini,
        // bukan ditolak. Dengan begitu akun pengelola tidak pernah bisa terkunci
        // karena status nonaktif yang tertulis keliru.
        if (!user.isActive) {
            if ((0, ticket_access_1.isAdminRole)(user.role)) {
                await prisma_1.default.user.update({
                    where: { id: user.id },
                    data: { isActive: true, deactivatedAt: null, deactivationType: null, tenggatHapus: null },
                });
            }
            else {
                res.status(403).json({
                    message: 'Akun ini sudah dinonaktifkan. Silakan hubungi administrator fakultas.',
                });
                return;
            }
        }
        // 4. Buat JWT Token
        const token = jsonwebtoken_1.default.sign({ id: user.id, nim: user.nim, role: user.role, first_login: user.first_login }, process.env.JWT_SECRET, { expiresIn: '1d' });
        // 5. Set Cookie
        res.cookie(cookies_1.TOKEN_COOKIE, token, (0, cookies_1.opsiCookieToken)(req));
        // 6. Kirim data User HANYA SATU KALI ke Frontend
        res.status(200).json({
            message: 'Login berhasil',
            user: (0, exports.buildAuthUser)(user, user.profile)
        });
    }
    catch (error) {
        // Serahkan error tidak terduga ke Global Error Handler di app.ts
        next(error);
    }
};
exports.login = login;
exports.completeFirstLoginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email({ message: 'Format email tidak valid.' }),
    no_hp: zod_1.z.string().trim().min(10, { message: 'Nomor HP/WA minimal 10 digit.' }),
    password_baru: zod_1.z.string().min(8, { message: 'Password baru minimal 8 karakter.' }),
    konfirmasi_password: zod_1.z.string()
}).refine(data => data.password_baru === data.konfirmasi_password, {
    message: 'Konfirmasi password tidak cocok.',
    path: ['konfirmasi_password']
});
const completeFirstLogin = async (req, res, next) => {
    try {
        const userId = req.user?.id; // Didapatkan dari auth.middleware
        if (!userId) {
            res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
            return;
        }
        // 1. Validasi seluruh isian (email & no_hp WAJIB, foto opsional)
        const parsed = exports.completeFirstLoginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: parsed.error.issues[0]?.message || 'Data yang dikirim tidak valid.' });
            return;
        }
        const { email, no_hp, password_baru } = parsed.data;
        // 2. Pastikan ini memang login pertama
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { profile: true }
        });
        if (!user) {
            res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
            return;
        }
        if (!user.first_login) {
            res.status(400).json({ message: 'Pengaturan ini hanya berlaku pada login pertama.' });
            return;
        }
        // Email harus unik antar akun karena dipakai untuk lupa password. Tanpa
        // pemeriksaan ini, dua mahasiswa yang mengetik email sama akan membuat
        // penyimpanan gagal dengan pesan server yang tidak jelas.
        const emailDipakai = await prisma_1.default.user.findFirst({
            where: { email: email.toLowerCase(), id: { not: userId } },
            select: { id: true }
        });
        if (emailDipakai) {
            res.status(409).json({ message: 'Email ini sudah dipakai akun lain. Gunakan alamat email lain.' });
            return;
        }
        // 3. Hash password baru
        const password_hash = await bcrypt_1.default.hash(password_baru, 10);
        // 4. Foto profil bersifat OPSIONAL
        const foto = req.file ? `/uploads/${req.file.filename}` : undefined;
        // 5. Simpan password, status first_login, dan data profil dalam satu transaksi
        const updatedUser = await prisma_1.default.$transaction(async (tx) => {
            const u = await tx.user.update({
                where: { id: userId },
                data: {
                    password_hash,
                    first_login: false,
                    // Email akun ikut disimpan di tabel User supaya lupa password berjalan
                    // untuk SEMUA role, termasuk akun yang tidak punya StudentProfile.
                    email: email.toLowerCase()
                }
            });
            if (user.profile) {
                await tx.studentProfile.update({
                    where: { userId },
                    data: {
                        email: email.toLowerCase(),
                        no_hp,
                        ...(foto ? { foto } : {})
                    }
                });
            }
            return u;
        });
        // 6. Kirim kode verifikasi ke email yang baru saja disimpan.
        //    Kalau pengiriman gagal, datanya tetap tersimpan dan pengguna bisa kirim ulang.
        const terkirim = await issueVerificationCode(userId, {
            nama: user.profile?.nama || user.nim,
            email: email.toLowerCase()
        });
        // 7. Buat ulang Token JWT karena status first_login sudah berubah
        const newToken = jsonwebtoken_1.default.sign({ id: updatedUser.id, nim: updatedUser.nim, role: updatedUser.role, first_login: false }, process.env.JWT_SECRET, { expiresIn: '1d' });
        // 8. Set Cookie baru
        res.cookie(cookies_1.TOKEN_COOKIE, newToken, (0, cookies_1.opsiCookieToken)(req));
        res.status(200).json({
            message: terkirim
                ? `Data berhasil disimpan. Kode verifikasi telah dikirim ke ${email.toLowerCase()}.`
                : 'Data berhasil disimpan, tapi kode verifikasi gagal terkirim. Gunakan "Kirim ulang kode" di halaman berikutnya.',
            emailSent: terkirim,
            user: (0, exports.buildAuthUser)({ ...updatedUser, first_login: false }, { email: email.toLowerCase(), email_verified_at: null })
        });
    }
    catch (error) {
        next(error);
    }
};
exports.completeFirstLogin = completeFirstLogin;
// --- Memasukkan kode verifikasi email ---
const verifyEmail = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
            return;
        }
        const kode = typeof req.body?.kode === 'string' ? req.body.kode.trim() : '';
        if (!/^\d{6}$/.test(kode)) {
            res.status(400).json({ message: 'Kode verifikasi harus berupa 6 digit angka.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId }, include: { profile: true } });
        if (!user) {
            res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
            return;
        }
        const profile = user.profile;
        if (!profile || !profile.email) {
            res.status(400).json({ message: 'Belum ada email yang perlu diverifikasi.' });
            return;
        }
        // Sudah terverifikasi sebelumnya: anggap berhasil supaya tidak mentok
        if (profile.email_verified_at) {
            res.status(200).json({ message: 'Email Anda sudah terverifikasi.', user: (0, exports.buildAuthUser)(user, profile) });
            return;
        }
        const dataVerifikasi = await prisma_1.default.emailVerification.findUnique({ where: { userId } });
        if (!dataVerifikasi?.code_hash || !dataVerifikasi.expires_at) {
            res.status(400).json({ message: 'Belum ada kode verifikasi yang aktif. Silakan kirim ulang kode.' });
            return;
        }
        if (dataVerifikasi.expires_at.getTime() < Date.now()) {
            res.status(400).json({ message: 'Kode verifikasi sudah kedaluwarsa. Silakan kirim ulang kode baru.' });
            return;
        }
        if (dataVerifikasi.attempts >= MAX_VERIFY_ATTEMPTS) {
            res.status(429).json({ message: 'Terlalu banyak percobaan salah. Silakan kirim ulang kode baru.' });
            return;
        }
        const cocok = await bcrypt_1.default.compare(kode, dataVerifikasi.code_hash);
        if (!cocok) {
            const attempts = dataVerifikasi.attempts + 1;
            const habis = attempts >= MAX_VERIFY_ATTEMPTS;
            await prisma_1.default.emailVerification.update({
                where: { userId },
                data: {
                    attempts,
                    // Kode dihanguskan supaya tidak bisa ditebak terus-menerus
                    ...(habis ? { code_hash: null, expires_at: null } : {})
                }
            });
            res.status(400).json({
                message: habis
                    ? 'Kode salah. Batas percobaan habis, silakan kirim ulang kode baru.'
                    : `Kode verifikasi salah. Sisa percobaan: ${MAX_VERIFY_ATTEMPTS - attempts}.`
            });
            return;
        }
        // Kode benar: bersihkan sisa kode dan tandai email terverifikasi
        const verifiedProfile = await prisma_1.default.studentProfile.update({
            where: { userId },
            data: { email_verified_at: new Date() }
        });
        // Kode tidak diperlukan lagi setelah email terverifikasi
        await prisma_1.default.emailVerification.updateMany({
            where: { userId },
            data: { code_hash: null, expires_at: null, attempts: 0 }
        });
        await (0, audit_service_1.logActivity)(userId, 'VERIFY_EMAIL', 'StudentProfile', `Pengguna memverifikasi email ${verifiedProfile.email}`, verifiedProfile.id);
        res.status(200).json({
            message: 'Email berhasil diverifikasi.',
            user: (0, exports.buildAuthUser)(user, verifiedProfile)
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyEmail = verifyEmail;
// --- Kirim ulang kode verifikasi (sekaligus bisa mengganti email yang salah ketik) ---
const resendVerification = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId }, include: { profile: true } });
        if (!user) {
            res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
            return;
        }
        if (!user.profile) {
            res.status(400).json({ message: 'Profil Anda belum tersedia, hubungi admin.' });
            return;
        }
        let profile = user.profile;
        if (profile.email_verified_at) {
            res.status(200).json({ message: 'Email Anda sudah terverifikasi.', user: (0, exports.buildAuthUser)(user, profile) });
            return;
        }
        // Pengguna boleh memperbaiki emailnya di sini supaya tidak terjebak
        // kalau salah ketik dan tidak pernah menerima kode.
        const emailBaru = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (emailBaru && emailBaru !== profile.email) {
            const parsed = zod_1.z.string().email({ message: 'Format email tidak valid.' }).safeParse(emailBaru);
            if (!parsed.success) {
                res.status(400).json({ message: parsed.error.issues[0]?.message || 'Format email tidak valid.' });
                return;
            }
            // Email akun (User.email) harus ikut diperbarui, kalau tidak lupa password
            // akan mengirim kode ke alamat lama yang sudah tidak dipakai.
            const dipakaiAkunLain = await prisma_1.default.user.findFirst({
                where: { email: emailBaru, id: { not: userId } },
                select: { id: true }
            });
            if (dipakaiAkunLain) {
                res.status(409).json({ message: 'Email ini sudah dipakai akun lain.' });
                return;
            }
            profile = await prisma_1.default.$transaction(async (tx) => {
                await tx.user.update({ where: { id: userId }, data: { email: emailBaru } });
                return tx.studentProfile.update({
                    where: { userId },
                    data: { email: emailBaru, email_verified_at: null }
                });
            });
            await (0, audit_service_1.logActivity)(userId, 'UPDATE_EMAIL', 'StudentProfile', `Pengguna mengubah email menjadi ${emailBaru} saat verifikasi`, profile.id);
        }
        if (!profile.email) {
            res.status(400).json({ message: 'Belum ada email yang bisa dikirimi kode. Isi email Anda dulu.' });
            return;
        }
        // Batas frekuensi kirim ulang supaya tidak dijadikan alat spam
        const dataVerifikasi = await prisma_1.default.emailVerification.findUnique({ where: { userId } });
        if (dataVerifikasi?.last_sent_at) {
            const lewatDetik = Math.floor((Date.now() - dataVerifikasi.last_sent_at.getTime()) / 1000);
            const sisaDetik = RESEND_COOLDOWN_SECONDS - lewatDetik;
            if (sisaDetik > 0) {
                res.status(429).json({ message: `Mohon tunggu ${sisaDetik} detik sebelum meminta kode baru.` });
                return;
            }
        }
        const terkirim = await issueVerificationCode(userId, {
            nama: profile.nama || user.nim,
            email: profile.email
        });
        if (!terkirim) {
            res.status(502).json({
                message: `Kode gagal dikirim ke ${profile.email}. Pastikan alamat emailnya benar, lalu coba lagi sebentar lagi.`
            });
            return;
        }
        res.status(200).json({
            message: `Kode verifikasi baru telah dikirim ke ${profile.email}.`,
            email: profile.email,
            user: (0, exports.buildAuthUser)(user, profile)
        });
    }
    catch (error) {
        next(error);
    }
};
exports.resendVerification = resendVerification;
// ==========================================================================
// GANTI PASSWORD MANDIRI (SEMUA ROLE)
// ==========================================================================
exports.changePasswordSchema = zod_1.z
    .object({
    password_lama: zod_1.z.string().min(1, { message: 'Password lama wajib diisi.' }),
    password_baru: zod_1.z.string().min(8, { message: 'Password baru minimal 8 karakter.' }),
    konfirmasi_password: zod_1.z.string(),
})
    .refine((data) => data.password_baru === data.konfirmasi_password, {
    message: 'Konfirmasi password tidak cocok.',
    path: ['konfirmasi_password'],
});
/**
 * Mengganti password akun yang sedang login. Berlaku untuk SEMUA role
 * (mahasiswa, pengurus, admin, superadmin) dan tidak memerlukan email.
 * Password lama wajib benar supaya sesi yang dicuri tidak bisa mengganti
 * password tanpa diketahui pemiliknya.
 */
const changePassword = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
            return;
        }
        const parsed = exports.changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: parsed.error.issues[0]?.message || 'Data yang dikirim tidak valid.' });
            return;
        }
        const { password_lama, password_baru } = parsed.data;
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
            return;
        }
        const passwordLamaBenar = await bcrypt_1.default.compare(password_lama, user.password_hash);
        if (!passwordLamaBenar) {
            res.status(400).json({ message: 'Password lama salah.' });
            return;
        }
        const samaDenganLama = await bcrypt_1.default.compare(password_baru, user.password_hash);
        if (samaDenganLama) {
            res.status(400).json({ message: 'Password baru harus berbeda dari password lama.' });
            return;
        }
        const password_hash = await bcrypt_1.default.hash(password_baru, 10);
        await prisma_1.default.user.update({ where: { id: userId }, data: { password_hash } });
        await (0, audit_service_1.logActivity)(userId, 'CHANGE_PASSWORD', 'User', 'Pengguna mengganti password akunnya sendiri', userId);
        res.status(200).json({ message: 'Password berhasil diganti. Gunakan password baru pada login berikutnya.' });
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;
// ==========================================================================
// LUPA PASSWORD: OTP ke email + tautan reset sekali pakai
// ==========================================================================
const RESET_OTP_TTL_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 30;
const MAX_RESET_ATTEMPTS = 5;
const RESET_COOLDOWN_SECONDS = 60;
/** Pesan netral: tidak membocorkan apakah akun dengan data itu ada. */
const PESAN_RESET_NETRAL = 'Jika nama, NIM, dan email yang Anda masukkan cocok dengan akun kami, kode OTP dan tautan reset password sudah dikirim ke email terdaftar.';
/** Token disimpan sebagai hash SHA-256 agar tautannya bisa dicari tanpa menyimpan token asli. */
const hashTokenReset = (token) => crypto_1.default.createHash('sha256').update(token).digest('hex');
const rapikan = (nilai) => String(nilai ?? '').trim();
const rapikanNama = (nilai) => nilai.trim().replace(/\s+/g, ' ').toLowerCase();
/** Email yang dipakai untuk reset: kolom User.email didahulukan, lalu profil. */
const emailAkun = (user) => (user.email || user.profile?.email || '').trim().toLowerCase();
/**
 * Langkah 1 lupa password: cocokkan nama + NIM + email, lalu kirim OTP dan
 * tautan reset ke email terdaftar. Selalu menjawab dengan pesan netral jika
 * data tidak cocok, supaya endpoint ini tidak bisa dipakai menebak data akun.
 */
const mintaResetPassword = async (req, res, next) => {
    try {
        const nama = rapikan(req.body?.nama);
        const nim = rapikan(req.body?.nim).toUpperCase();
        const email = rapikan(req.body?.email).toLowerCase();
        if (!nama || !nim || !email) {
            res.status(400).json({ message: 'Nama, NIM, dan email wajib diisi.' });
            return;
        }
        if (!zod_1.z.string().email().safeParse(email).success) {
            res.status(400).json({ message: 'Format email tidak valid.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({
            where: { nim },
            include: { profile: true },
        });
        // Akun tanpa profil (ADMIN/SUPERADMIN) tidak punya nama, jadi hanya email
        // dan NIM yang dicocokkan. Akun dengan profil wajib cocok ketiganya.
        const namaCocok = user?.profile ? rapikanNama(user.profile.nama) === rapikanNama(nama) : true;
        const emailCocok = user ? emailAkun(user) === email : false;
        if (!user || !namaCocok || !emailCocok || !email) {
            res.status(200).json({ message: PESAN_RESET_NETRAL });
            return;
        }
        // Batas frekuensi kirim supaya endpoint ini tidak dijadikan alat spam.
        const dataReset = await prisma_1.default.passwordReset.findUnique({ where: { userId: user.id } });
        if (dataReset?.last_sent_at) {
            const lewatDetik = Math.floor((Date.now() - dataReset.last_sent_at.getTime()) / 1000);
            const sisaDetik = RESET_COOLDOWN_SECONDS - lewatDetik;
            if (sisaDetik > 0) {
                res.status(429).json({ message: `Mohon tunggu ${sisaDetik} detik sebelum meminta kode baru.` });
                return;
            }
        }
        const kode = crypto_1.default.randomInt(0, 1_000_000).toString().padStart(6, '0');
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const isiReset = {
            otp_hash: await bcrypt_1.default.hash(kode, 10),
            otp_expires_at: new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000),
            // Token dari permintaan sebelumnya otomatis diganti: tautan lama tidak
            // berlaku lagi begitu pengguna meminta kode baru.
            token_hash: hashTokenReset(token),
            token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
            attempts: 0,
            last_sent_at: new Date(),
            used_at: null,
        };
        await prisma_1.default.passwordReset.upsert({
            where: { userId: user.id },
            create: { userId: user.id, ...isiReset },
            update: isiReset,
        });
        const link = `${(0, frontend_url_1.frontendBaseUrl)()}/reset-password?token=${token}`;
        const namaPenerima = user.profile?.nama || user.nim;
        const terkirim = await (0, email_service_1.sendPasswordResetEmail)(email, namaPenerima, kode, link, RESET_OTP_TTL_MINUTES);
        if (!terkirim) {
            res.status(502).json({
                message: `Kode gagal dikirim ke ${(0, frontend_url_1.samarkanEmail)(email)}. Coba lagi beberapa saat lagi.`,
            });
            return;
        }
        await (0, audit_service_1.logActivity)(user.id, 'REQUEST_PASSWORD_RESET', 'User', 'Permintaan reset password: kode OTP dikirim ke email terdaftar', user.id);
        res.status(200).json({
            message: `Kode OTP dan tautan reset sudah dikirim ke ${(0, frontend_url_1.samarkanEmail)(email)}.`,
            email: (0, frontend_url_1.samarkanEmail)(email),
            berlakuMenit: RESET_OTP_TTL_MINUTES,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.mintaResetPassword = mintaResetPassword;
/**
 * Langkah 2 lupa password: memasukkan kode OTP. Kalau benar, server
 * mengembalikan token sekali pakai untuk membuka form password baru.
 */
const verifikasiKodeReset = async (req, res, next) => {
    try {
        const nim = rapikan(req.body?.nim).toUpperCase();
        const kode = rapikan(req.body?.kode);
        if (!nim || !/^\d{6}$/.test(kode)) {
            res.status(400).json({ message: 'NIM wajib diisi dan kode OTP harus 6 digit angka.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { nim } });
        if (!user) {
            res.status(400).json({ message: 'NIM atau kode OTP tidak valid.' });
            return;
        }
        const dataReset = await prisma_1.default.passwordReset.findUnique({ where: { userId: user.id } });
        if (!dataReset?.otp_hash || !dataReset.otp_expires_at) {
            res.status(400).json({ message: 'Belum ada kode aktif. Silakan minta kode baru.' });
            return;
        }
        if (dataReset.otp_expires_at.getTime() < Date.now()) {
            res.status(400).json({ message: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' });
            return;
        }
        if (dataReset.attempts >= MAX_RESET_ATTEMPTS) {
            res.status(429).json({ message: 'Terlalu banyak percobaan salah. Silakan minta kode baru.' });
            return;
        }
        const cocok = await bcrypt_1.default.compare(kode, dataReset.otp_hash);
        if (!cocok) {
            const attempts = dataReset.attempts + 1;
            const habis = attempts >= MAX_RESET_ATTEMPTS;
            await prisma_1.default.passwordReset.update({
                where: { userId: user.id },
                data: {
                    attempts,
                    ...(habis ? { otp_hash: null, otp_expires_at: null, token_hash: null, token_expires_at: null } : {}),
                },
            });
            res.status(400).json({
                message: habis
                    ? 'Kode salah. Batas percobaan habis, silakan minta kode baru.'
                    : `Kode OTP salah. Sisa percobaan: ${MAX_RESET_ATTEMPTS - attempts}.`,
            });
            return;
        }
        // Kode benar: terbitkan token baru untuk form password baru.
        const token = crypto_1.default.randomBytes(32).toString('hex');
        await prisma_1.default.passwordReset.update({
            where: { userId: user.id },
            data: {
                otp_hash: null,
                otp_expires_at: null,
                attempts: 0,
                token_hash: hashTokenReset(token),
                token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
                used_at: null,
            },
        });
        res.status(200).json({
            message: 'Kode OTP benar. Silakan buat password baru.',
            token,
            berlakuMenit: RESET_TOKEN_TTL_MINUTES,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifikasiKodeReset = verifikasiKodeReset;
/**
 * Langkah 3 lupa password: simpan password baru memakai token dari email/
 * verifikasi OTP. Token sekali pakai dan langsung hangus setelah dipakai.
 */
const resetPassword = async (req, res, next) => {
    try {
        const token = rapikan(req.body?.token);
        const passwordBaru = String(req.body?.password_baru ?? '');
        const konfirmasi = String(req.body?.konfirmasi_password ?? '');
        if (!token) {
            res.status(400).json({ message: 'Tautan reset tidak valid. Silakan minta tautan baru.' });
            return;
        }
        if (passwordBaru.length < 8) {
            res.status(400).json({ message: 'Password baru minimal 8 karakter.' });
            return;
        }
        if (passwordBaru !== konfirmasi) {
            res.status(400).json({ message: 'Konfirmasi password tidak cocok.' });
            return;
        }
        const dataReset = await prisma_1.default.passwordReset.findUnique({
            where: { token_hash: hashTokenReset(token) },
        });
        if (!dataReset || dataReset.used_at || !dataReset.token_expires_at) {
            res.status(400).json({ message: 'Tautan reset tidak valid atau sudah dipakai. Silakan minta tautan baru.' });
            return;
        }
        if (dataReset.token_expires_at.getTime() < Date.now()) {
            res.status(400).json({ message: 'Tautan reset sudah kedaluwarsa. Silakan minta tautan baru.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: dataReset.userId } });
        if (!user) {
            res.status(404).json({ message: 'Akun tidak ditemukan.' });
            return;
        }
        if (!user.isActive && !(0, ticket_access_1.isAdminRole)(user.role)) {
            res.status(403).json({
                message: 'Akun ini sudah dinonaktifkan. Silakan hubungi administrator fakultas.',
            });
            return;
        }
        const samaDenganLama = await bcrypt_1.default.compare(passwordBaru, user.password_hash);
        if (samaDenganLama) {
            res.status(400).json({ message: 'Password baru harus berbeda dari password lama.' });
            return;
        }
        const password_hash = await bcrypt_1.default.hash(passwordBaru, 10);
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({ where: { id: user.id }, data: { password_hash } }),
            prisma_1.default.passwordReset.update({
                where: { userId: user.id },
                data: {
                    used_at: new Date(),
                    otp_hash: null,
                    otp_expires_at: null,
                    token_hash: null,
                    token_expires_at: null,
                    attempts: 0,
                },
            }),
        ]);
        await (0, audit_service_1.logActivity)(user.id, 'RESET_PASSWORD', 'User', 'Password diatur ulang melalui tautan lupa password', user.id);
        res.status(200).json({ message: 'Password berhasil diatur ulang. Silakan login dengan password baru.' });
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
