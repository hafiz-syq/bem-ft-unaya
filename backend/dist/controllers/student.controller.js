"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireOfficer = exports.runLifecycle = exports.updateStudentRole = exports.perpanjangAkun = exports.updateStudentStatus = exports.createStudent = exports.getStudents = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("../services/audit.service");
const account_lifecycle_service_1 = require("../services/account-lifecycle.service");
const ticket_access_1 = require("../lib/ticket-access");
/**
 * Data akun yang ditampilkan di halaman Data Mahasiswa.
 * Hanya shape ini yang dikirim ke klien supaya hash password tidak pernah bocor.
 */
const akunSelect = {
    id: true,
    nim: true,
    role: true,
    isActive: true,
    first_login: true,
    deactivatedAt: true,
    deactivationType: true,
    tenggatHapus: true,
    perpanjanganHingga: true,
    foto: true,
    createdAt: true,
    profile: {
        select: {
            nama: true,
            nim: true,
            program_studi: true,
            email: true,
            no_hp: true,
            foto: true,
            email_verified_at: true,
        },
    },
    positions: {
        where: { isActive: true },
        select: {
            id: true,
            positionSlot: { select: { title: true, organization: { select: { name: true } } } },
        },
    },
};
// 1. Daftar akun (Mahasiswa & Pengurus) dengan pencarian, filter status, dan role
const getStudents = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const search = req.query.search || '';
        const status = req.query.status || 'ALL';
        const role = req.query.role || 'ALL';
        const skip = (page - 1) * limit;
        // Role ADMIN tidak pernah muncul di daftar ini.
        const where = { role: { not: 'ADMIN' } };
        if (role !== 'ALL' && ticket_access_1.ASSIGNABLE_ROLES.includes(role)) {
            where.role = role === 'ADMIN' ? { not: 'ADMIN' } : role;
        }
        if (status === 'AKTIF')
            where.isActive = true;
        else if (status === 'NONAKTIF')
            where.isActive = false;
        if (search) {
            where.OR = [
                { nim: { contains: search } },
                { profile: { nama: { contains: search } } },
            ];
        }
        const [akun, total] = await Promise.all([
            prisma_1.default.user.findMany({
                where,
                skip,
                take: limit,
                select: akunSelect,
                orderBy: { nim: 'asc' },
            }),
            prisma_1.default.user.count({ where }),
        ]);
        const sekarang = new Date();
        const data = akun.map((a) => ({
            ...a,
            angkatan: (0, account_lifecycle_service_1.hitungAngkatan)(a.nim),
            email_verified: Boolean(a.profile?.email_verified_at),
            jabatan: a.positions[0]?.positionSlot.title ?? null,
            organisasi: a.positions[0]?.positionSlot.organization.name ?? null,
            // Tanggal terhapus dihitung server supaya aturan bawaan (nonaktif + 1 tahun)
            // dan hasil geseran admin terbaca sama di semua tampilan.
            tenggatHapusEfektif: (0, account_lifecycle_service_1.tenggatHapusEfektif)(a),
            diperpanjangSampai: a.perpanjanganHingga && a.perpanjanganHingga > sekarang ? a.perpanjanganHingga : null,
        }));
        res.status(200).json({
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getStudents = getStudents;
// 2. Menambah akun mahasiswa baru (langsung bisa login seperti hasil seed)
const createStudent = async (req, res, next) => {
    try {
        const nim = String(req.body.nim || '').trim().toUpperCase();
        const nama = String(req.body.nama || '').trim();
        const program_studi = String(req.body.program_studi || '').trim().toUpperCase();
        const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
        const no_hp = req.body.no_hp ? String(req.body.no_hp).trim() : null;
        if (!nim || !nama || !program_studi) {
            res.status(400).json({ message: 'NIM, Nama, dan Program Studi wajib diisi.' });
            return;
        }
        if (!/^\d{8}[A-Za-z]?$/.test(nim)) {
            res.status(400).json({ message: 'Format NIM tidak valid (contoh: 22140001).' });
            return;
        }
        const sudahAda = await prisma_1.default.user.findUnique({ where: { nim } });
        if (sudahAda) {
            res.status(409).json({ message: `NIM ${nim} sudah terdaftar di sistem.` });
            return;
        }
        // Sama seperti seed: password awal adalah NIM itu sendiri dan wajib diganti
        // pada login pertama.
        const password_hash = await bcrypt_1.default.hash(nim, 10);
        const baru = await prisma_1.default.user.create({
            data: {
                nim,
                password_hash,
                role: 'MAHASISWA',
                first_login: true,
                profile: {
                    create: { nama, nim, program_studi, email, no_hp },
                },
            },
            select: akunSelect,
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'CREATE_STUDENT', 'User', `Menambahkan akun mahasiswa ${nama} (${nim})`, baru.id);
        res.status(201).json({
            message: `Akun ${nama} (${nim}) berhasil dibuat. Password awal sama dengan NIM.`,
            data: { ...baru, angkatan: (0, account_lifecycle_service_1.hitungAngkatan)(baru.nim) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createStudent = createStudent;
// 3. Mengaktifkan / menonaktifkan akun
const updateStudentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const isActive = req.body.isActive === true || req.body.isActive === 'true';
        const target = await prisma_1.default.user.findUnique({
            where: { id },
            select: { id: true, nim: true, role: true, isActive: true, profile: { select: { nama: true } } },
        });
        if (!target) {
            res.status(404).json({ message: 'Akun tidak ditemukan.' });
            return;
        }
        if (target.role === 'ADMIN') {
            res.status(403).json({ message: 'Akun administrator tidak dapat dinonaktifkan dari halaman ini.' });
            return;
        }
        const updated = await prisma_1.default.user.update({
            where: { id },
            // tenggatHapus selalu dibersihkan di sini: akun aktif tidak menunggu
            // penghapusan, dan akun nonaktif MANUAL tidak pernah dihapus otomatis.
            data: isActive
                ? { isActive: true, deactivatedAt: null, deactivationType: null, tenggatHapus: null }
                : { isActive: false, deactivatedAt: new Date(), deactivationType: 'MANUAL', tenggatHapus: null },
            select: akunSelect,
        });
        await (0, audit_service_1.logActivity)(req.user.id, isActive ? 'ACTIVATE_STUDENT' : 'DEACTIVATE_STUDENT', 'User', `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} akun ${target.profile?.nama || target.nim} (${target.nim})`, id);
        res.status(200).json({
            message: `Akun ${target.profile?.nama || target.nim} berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
            data: { ...updated, angkatan: (0, account_lifecycle_service_1.hitungAngkatan)(updated.nim) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateStudentStatus = updateStudentStatus;
// 3b. Memperpanjang masa studi & menggeser tenggat hapus (hanya ADMIN).
//     Satu endpoint dipakai untuk dua hal yang selalu berbarengan saat admin
//     menyelamatkan akun yang sudah lewat 5 tahun: memberi tenggat baru dan
//     (opsional) mengaktifkan kembali akun tersebut.
const perpanjangAkun = async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await prisma_1.default.user.findUnique({
            where: { id },
            select: {
                id: true,
                nim: true,
                role: true,
                isActive: true,
                deactivationType: true,
                perpanjanganHingga: true,
                profile: { select: { nama: true } },
            },
        });
        if (!target) {
            res.status(404).json({ message: 'Akun tidak ditemukan.' });
            return;
        }
        // Siklus hidup hanya mengatur mahasiswa. Akun administrator tidak pernah
        // nonaktif, jadi tidak ada yang bisa diperpanjang di sana.
        if (target.role === 'ADMIN') {
            res.status(403).json({ message: 'Akun administrator tidak mengikuti siklus hidup ini.' });
            return;
        }
        const adaPerpanjangan = Object.prototype.hasOwnProperty.call(req.body, 'perpanjanganHingga');
        const adaTenggat = Object.prototype.hasOwnProperty.call(req.body, 'tenggatHapus');
        const aktifkan = req.body.aktifkan === true || req.body.aktifkan === 'true';
        if (!adaPerpanjangan && !adaTenggat && !aktifkan) {
            res.status(400).json({
                message: 'Isi tanggal perpanjangan, tanggal tenggat hapus, atau aktifkan akunnya.',
            });
            return;
        }
        const perpanjanganHingga = adaPerpanjangan
            ? bacaTanggal(req.body.perpanjanganHingga)
            : undefined;
        const tenggatHapus = adaTenggat ? bacaTanggal(req.body.tenggatHapus) : undefined;
        if (perpanjanganHingga === 'INVALID' || tenggatHapus === 'INVALID') {
            res.status(400).json({ message: 'Format tanggal tidak valid.' });
            return;
        }
        const sekarang = new Date();
        const batasAman = new Date(sekarang.getTime() + 24 * 60 * 60 * 1000);
        if (perpanjanganHingga && perpanjanganHingga <= sekarang) {
            res.status(400).json({
                message: 'Tanggal perpanjangan harus di masa depan. Kosongkan untuk mencabut perpanjangan.',
            });
            return;
        }
        // Tenggat hapus yang sudah lewat akan langsung dieksekusi job berikutnya,
        // jadi beri jeda minimal sehari supaya admin tidak menghapus data tak sengaja.
        if (tenggatHapus && tenggatHapus <= batasAman) {
            res.status(400).json({
                message: 'Tenggat hapus minimal sehari dari sekarang. Kosongkan untuk memakai aturan bawaan.',
            });
            return;
        }
        const updated = await prisma_1.default.user.update({
            where: { id },
            data: {
                ...(perpanjanganHingga !== undefined ? { perpanjanganHingga } : {}),
                ...(tenggatHapus !== undefined ? { tenggatHapus } : {}),
                ...(aktifkan
                    ? { isActive: true, deactivatedAt: null, deactivationType: null }
                    : {}),
            },
            select: akunSelect,
        });
        const nama = target.profile?.nama || target.nim;
        const rincian = [];
        if (perpanjanganHingga !== undefined) {
            rincian.push(perpanjanganHingga
                ? `masa studi diperpanjang sampai ${perpanjanganHingga.toISOString().slice(0, 10)}`
                : 'perpanjangan masa studi dicabut');
        }
        if (tenggatHapus !== undefined) {
            rincian.push(tenggatHapus
                ? `tenggat hapus digeser ke ${tenggatHapus.toISOString().slice(0, 10)}`
                : 'tenggat hapus dikembalikan ke aturan bawaan');
        }
        if (aktifkan)
            rincian.push('akun diaktifkan kembali');
        await (0, audit_service_1.logActivity)(req.user.id, 'PERPANJANG_AKUN', 'User', `Akun ${nama} (${target.nim}): ${rincian.join(', ')}`, id);
        res.status(200).json({
            message: `Pengaturan akun ${nama} diperbarui: ${rincian.join(', ')}.`,
            data: {
                ...updated,
                angkatan: (0, account_lifecycle_service_1.hitungAngkatan)(updated.nim),
                tenggatHapusEfektif: (0, account_lifecycle_service_1.tenggatHapusEfektif)(updated),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.perpanjangAkun = perpanjangAkun;
// 4. Menetapkan role pengurus (hanya ADMIN)
const updateStudentRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const role = String(req.body.role || '').trim().toUpperCase();
        if (!ticket_access_1.ASSIGNABLE_ROLES.includes(role)) {
            res.status(400).json({ message: 'Role tidak dikenali.' });
            return;
        }
        const target = await prisma_1.default.user.findUnique({
            where: { id },
            select: { id: true, nim: true, role: true, profile: { select: { nama: true } } },
        });
        if (!target) {
            res.status(404).json({ message: 'Akun tidak ditemukan.' });
            return;
        }
        // Akun administrator tidak boleh diubah dari halaman ini. Tanpa penjaga ini,
        // satu klik bisa menurunkan admin terakhir dan mengunci seluruh sistem.
        if (target.role === 'ADMIN') {
            res.status(403).json({
                message: 'Role akun administrator tidak dapat diubah dari halaman ini.',
            });
            return;
        }
        const updated = await prisma_1.default.user.update({
            where: { id },
            data: { role: role },
            select: akunSelect,
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'UPDATE_ROLE', 'User', `Mengubah role ${target.profile?.nama || target.nim} dari ${target.role} menjadi ${role}`, id);
        res.status(200).json({
            message: `Role ${target.profile?.nama || target.nim} berhasil diubah menjadi ${role}.`,
            data: { ...updated, angkatan: (0, account_lifecycle_service_1.hitungAngkatan)(updated.nim) },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateStudentRole = updateStudentRole;
// 5. Menjalankan pemeriksaan siklus hidup akun secara manual (hanya ADMIN)
const runLifecycle = async (req, res, next) => {
    try {
        const hasil = await (0, account_lifecycle_service_1.runAccountLifecycleJob)();
        res.status(200).json({
            message: `${hasil.dinonaktifkan} akun dinonaktifkan otomatis, ` +
                `${hasil.dihapus} akun dihapus permanen.`,
            data: hasil,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.runLifecycle = runLifecycle;
const TANGGAL_POLOS = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Membaca isian tanggal dari admin.
 * Tanggal polos (2026-12-31) dibaca sebagai AKHIR hari itu, sehingga
 * "perpanjang sampai 31 Des" berarti masih berlaku sepanjang tanggal tersebut.
 * Mengembalikan null untuk isian kosong (artinya: kembalikan ke aturan bawaan).
 */
const bacaTanggal = (nilai) => {
    if (nilai === null || nilai === undefined || nilai === '')
        return null;
    if (typeof nilai !== 'string')
        return 'INVALID';
    const teks = nilai.trim();
    const tanggal = TANGGAL_POLOS.test(teks)
        ? new Date(`${teks}T23:59:59.999`)
        : new Date(teks);
    return Number.isNaN(tanggal.getTime()) ? 'INVALID' : tanggal;
};
/** Penjaga khusus: hanya pengurus & admin yang boleh menyentuh data mahasiswa. */
const requireOfficer = (req, res, next) => {
    if (!req.user || !(ticket_access_1.OFFICER_ROLES.includes(req.user.role) || req.user.role === 'ADMIN')) {
        res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat mengakses data ini.' });
        return;
    }
    next();
};
exports.requireOfficer = requireOfficer;
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        res.status(403).json({ message: 'Hanya admin yang dapat melakukan tindakan ini.' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
