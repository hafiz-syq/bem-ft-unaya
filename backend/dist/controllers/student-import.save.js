"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpanMahasiswa = simpanMahasiswa;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../lib/prisma"));
/** Ukuran batch penyisipan, sama seperti seed, agar transaksi tetap pendek. */
const UKURAN_BATCH = 50;
/**
 * Membuat akun untuk baris yang belum terdaftar.
 * Password awal = NIM dan wajib diganti saat login pertama, sama seperti seed.
 * NIM yang sudah ada dilewati, bukan ditimpa.
 */
async function simpanMahasiswa(baris) {
    const terdaftar = await cariNimTerdaftar(baris.map((b) => b.nim));
    const baru = baris.filter((b) => !terdaftar.has(b.nim));
    const gagal = [];
    let dibuat = 0;
    for (let i = 0; i < baru.length; i += UKURAN_BATCH) {
        const batch = await siapkanPassword(baru.slice(i, i + UKURAN_BATCH));
        try {
            await prisma_1.default.$transaction(async (tx) => {
                for (const m of batch) {
                    await tx.user.create({
                        data: {
                            nim: m.nim,
                            password_hash: m.password_hash,
                            role: 'MAHASISWA',
                            first_login: true,
                            profile: {
                                create: { nama: m.nama, nim: m.nim, program_studi: m.program_studi },
                            },
                        },
                    });
                }
            });
            dibuat += batch.length;
        }
        catch {
            // Satu baris gagal membatalkan seluruh batch, jadi batch ini diulang baris
            // per baris supaya sisa baris yang sehat tetap masuk.
            for (const m of batch) {
                try {
                    await prisma_1.default.user.create({
                        data: {
                            nim: m.nim,
                            password_hash: m.password_hash,
                            role: 'MAHASISWA',
                            first_login: true,
                            profile: {
                                create: { nama: m.nama, nim: m.nim, program_studi: m.program_studi },
                            },
                        },
                    });
                    dibuat++;
                }
                catch {
                    gagal.push(m.nim);
                }
            }
        }
    }
    return { dibuat, dilewati: [...terdaftar], gagal };
}
/** Mengembalikan daftar NIM dari baris-baris ini yang sudah terdaftar di sistem. */
async function cariNimTerdaftar(nims) {
    if (nims.length === 0)
        return new Set();
    const ada = await prisma_1.default.user.findMany({
        where: { nim: { in: nims } },
        select: { nim: true },
    });
    return new Set(ada.map((u) => u.nim));
}
/**
 * Menghitung hash password untuk sekumpulan baris.
 * Dijalankan maksimal 4 sekaligus karena bcrypt memakai threadpool Node — dengan
 * cara ini ratusan NIM selesai dalam hitungan detik, bukan menit.
 */
async function siapkanPassword(baris) {
    const hasil = new Array(baris.length);
    let indeks = 0;
    const pekerja = Array.from({ length: Math.min(4, baris.length) }, async () => {
        while (indeks < baris.length) {
            const i = indeks++;
            const b = baris[i];
            hasil[i] = { ...b, password_hash: await bcrypt_1.default.hash(b.nim, 10) };
        }
    });
    await Promise.all(pekerja);
    return hasil;
}
