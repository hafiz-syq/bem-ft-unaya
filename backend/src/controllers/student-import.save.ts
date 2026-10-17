import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

/**
 * Simpan akun mahasiswa (dipakai oleh simpanImpor).
 *
 * Satu sumber kebenaran untuk dua pemakai:
 * - skrip CLI `npm run seed` (membaca data/TEKNIK.pdf)
 * - endpoint unggah di halaman Data Mahasiswa (admin)
 *
 * Perbedaan perlakuannya sengaja:
 * - seed berhenti total begitu menemukan baris bermasalah (dijalankan sekali di
 *   awal proyek, jadi lebih baik gagal terang-terangan),
 * - unggahan lewat halaman admin TIDAK berhenti; baris bermasalah dilaporkan dan
 *   dilewati supaya satu baris rusak tidak menggagalkan 300 baris yang sehat.
 */

export interface HasilSimpan {
  dibuat: number;
  /** Sudah ada di sistem sebelum impor (akun tidak ditimpa). */
  dilewati: string[];
  /** Gagal ditulis ke database, mis. karena bentrok NIM yang muncul bersamaan. */
  gagal: string[];
}

export interface BarisMahasiswa {
  nama: string;
  nim: string;
  program_studi: string;
}

/** Ukuran batch penyisipan, sama seperti seed, agar transaksi tetap pendek. */
const UKURAN_BATCH = 50;

/**
 * Membuat akun untuk baris yang belum terdaftar.
 * Password awal = NIM dan wajib diganti saat login pertama, sama seperti seed.
 * NIM yang sudah ada dilewati, bukan ditimpa.
 */
export async function simpanMahasiswa(baris: BarisMahasiswa[]): Promise<HasilSimpan> {
  const terdaftar = await cariNimTerdaftar(baris.map((b) => b.nim));
  const baru = baris.filter((b) => !terdaftar.has(b.nim));

  const gagal: string[] = [];
  let dibuat = 0;

  for (let i = 0; i < baru.length; i += UKURAN_BATCH) {
    const batch = await siapkanPassword(baru.slice(i, i + UKURAN_BATCH));

    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    } catch {
      // Satu baris gagal membatalkan seluruh batch, jadi batch ini diulang baris
      // per baris supaya sisa baris yang sehat tetap masuk.
      for (const m of batch) {
        try {
          await prisma.user.create({
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
        } catch {
          gagal.push(m.nim);
        }
      }
    }
  }

  return { dibuat, dilewati: [...terdaftar], gagal };
}

/** Mengembalikan daftar NIM dari baris-baris ini yang sudah terdaftar di sistem. */
async function cariNimTerdaftar(nims: string[]): Promise<Set<string>> {
  if (nims.length === 0) return new Set();

  const ada = await prisma.user.findMany({
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
async function siapkanPassword(
  baris: BarisMahasiswa[]
): Promise<(BarisMahasiswa & { password_hash: string })[]> {
  const hasil: (BarisMahasiswa & { password_hash: string })[] = new Array(baris.length);
  let indeks = 0;

  const pekerja = Array.from({ length: Math.min(4, baris.length) }, async () => {
    while (indeks < baris.length) {
      const i = indeks++;
      const b = baris[i];
      hasil[i] = { ...b, password_hash: await bcrypt.hash(b.nim, 10) };
    }
  });

  await Promise.all(pekerja);
  return hasil;
}
