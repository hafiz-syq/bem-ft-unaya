import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

/** Impor massal akun mahasiswa dari berkas PDF.

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

// Pembaca PDF.
//
// Sebelumnya dipakai pdf-parse, yang membawa pdfjs 1.10 (rilis 2014). Versi itu
// tidak stabil di Node versi sekarang: dokumen pertama dalam sebuah proses server
// sering gagal dengan galat palsu "Command token too long" / "bad XRef entry",
// sehingga admin yang mengunggah PDF bisa menerima pesan "berkas tidak dapat
// dibaca" padahal berkasnya sahih. Karena jalur impor ini menyentuh data akun,
// pemakaiannya diganti pdfjs-dist yang masih dirawat.
// Build "modern" dipakai, bukan "legacy". Build legacy, saat modul diimpor,
// mencoba memuat paket native `canvas` untuk mem-polyfill DOMMatrix/Path2D dan
// mencetak peringatan "Cannot polyfill ..." di setiap start server. Jalur ini
// hanya membaca teks PDF (tidak pernah merender halaman), jadi polyfill tersebut
// tidak dibutuhkan dan build modern tidak menyentuh `canvas` sama sekali.
// eslint-disable-next-line @typescript-eslint/no-var-requires
// Ubah dari:
// const pdfjsLib = require('pdfjs-dist');

// Menjadi:
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

export interface BarisMahasiswa {
  nama: string;
  nim: string;
  program_studi: string;
}

export interface BarisBermasalah {
  nim: string;
  nama: string;
  alasan: string;
}

export interface HasilParsing {
  /** Baris yang lolos validasi dan siap dibuatkan akunnya. */
  valid: BarisMahasiswa[];
  /** Baris yang dibuang beserta alasannya, untuk ditampilkan ke admin. */
  bermasalah: BarisBermasalah[];
  /** Jumlah kecocokan mentah di dalam teks PDF (sebelum validasi). */
  totalDibaca: number;
}

/** NIM yang dikenali sistem: 8 digit, boleh diakhiri satu huruf. */
const POLA_NIM = /^\d{8}[A-Za-z]?$/;

/**
 * Pola baris data pada PDF akademik: "Nama | NIM | Program Studi".
 * Nama dan NIM boleh tertukar urutannya, pemisahnya pipa atau spasi.
 * Hanya tiga program studi teknik yang dikenali, sama seperti seed.
 */
const POLA_BARIS =
  /(?:([A-Za-z\.\',\ -]+?)\s*\|?\s*(\d{8}[A-Za-z]?)|(\d{8}[A-Za-z]?)\s*\|?\s*([A-Za-z\.\',\ -]+?))\s*\|?\s*(SISTEM INFORMASI|TEKNIK MESIN|TEKNIK SIPIL)/gi;

/**
 * Mengambil seluruh teks dari PDF, satu baris per baris aslinya.
 */
async function bacaIsiPdf(buffer: Buffer): Promise<string> {
  // Salinan bersih: unggahan datang sebagai tampilan (view) memori yang lebih
  // besar dari isinya, jadi jangan langsung memberi bufer mentahnya ke pdfjs.
  const tugas = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const dokumen = await tugas.promise;

  const baris: string[] = [];
  for (let nomor = 1; nomor <= dokumen.numPages; nomor++) {
    const halaman = await dokumen.getPage(nomor);
    const isi = await halaman.getTextContent();
    // hasEOL menandai akhir baris teks, sehingga susunan baris tetap seperti
    // aslinya dan baris data yang satu tidak menyatu dengan berikutnya.
    for (const potongan of isi.items as { str?: string; hasEOL?: boolean }[]) {
      baris.push(potongan.str ?? '');
      if (potongan.hasEOL) baris.push('\n');
    }
  }

  await dokumen.destroy();
  return baris.join('');
}

/**
 * Memisahkan isi PDF menjadi baris valid dan baris bermasalah.
 */
export async function parsingPdfMahasiswa(buffer: Buffer): Promise<HasilParsing> {
  const teks = await bacaIsiPdf(buffer);

  const valid: BarisMahasiswa[] = [];
  const bermasalah: BarisBermasalah[] = [];
  const nimSudahDipakai = new Set<string>();
  const kecocokan = [...teks.matchAll(POLA_BARIS)];

  for (const match of kecocokan) {
    const nama = String(match[1] || match[4] || '').replace(/\n/g, ' ').trim();
    const nim = String(match[2] || match[3] || '').trim().toUpperCase();
    const prodi = String(match[5] || '').trim().toUpperCase();

    // Baris kepala tabel ("Nama Mahasiswa") bukan data.
    if (nama.toLowerCase().includes('nama mahasiswa')) continue;

    if (!nama || !nim || !prodi) {
      bermasalah.push({ nim, nama, alasan: 'Kolom nama/nim/program studi tidak lengkap' });
      continue;
    }

    if (!POLA_NIM.test(nim)) {
      bermasalah.push({ nim, nama, alasan: 'Format NIM tidak dikenali (harus 8 digit)' });
      continue;
    }

    if (nimSudahDipakai.has(nim)) {
      bermasalah.push({ nim, nama, alasan: 'NIM muncul lebih dari sekali di berkas ini' });
      continue;
    }

    nimSudahDipakai.add(nim);
    valid.push({ nama, nim, program_studi: prodi });
  }

  return { valid, bermasalah, totalDibaca: kecocokan.length };
}

/** Mengembalikan daftar NIM dari baris-baris ini yang sudah terdaftar di sistem. */
export async function cariNimTerdaftar(nims: string[]): Promise<Set<string>> {
  if (nims.length === 0) return new Set();

  const ada = await prisma.user.findMany({
    where: { nim: { in: nims } },
    select: { nim: true },
  });

  return new Set(ada.map((u) => u.nim));
}
