import { Request, Response, NextFunction } from 'express';
import { logActivity } from '../services/audit.service';
import {
  parsingPdfMahasiswa,
  cariNimTerdaftar,
} from '../services/student-import.service';
import { simpanMahasiswa } from '../controllers/student-import.save';

/**
 * Impor massal akun mahasiswa dari PDF, dijalankan admin dari halaman Data
 * Mahasiswa. Terbagi dua langkah supaya admin bisa memeriksa hasil pembacaan
 * sebelum menulis ratusan akun:
 *
 * 1. POST /api/students/import/pratinjau — hanya membaca & melaporkan.
 * 2. POST /api/students/import/simpan     — benar-benar membuat akunnya.
 *
 * Berkas PDF dikirim ulang pada langkah kedua (dan tidak disimpan di server),
 * sehingga tidak ada keadaan sementara yang bisa basi antara dua langkah.
 */

/** Batas jumlah baris detail yang dikirim ke layar, agar respons tetap ringkas. */
const BATAS_DETAIL = 50;

/** Pesan baku kalau PDF tidak bisa diparsing sama sekali. */
const PESAN_PDF_TIDAK_BISA = 'Berkas PDF tidak dapat dibaca. Pastikan berkasnya PDF asli (bukan hasil pindai/gambar). Untuk PDF hasil pindai, isinya perlu diketik ulang atau dijalankan OCR terlebih dahulu.';

/** Sematkan ringkasan impor ke log aktivitas supaya AudtLog tetap menangkap
 * siapa, kapan, dan berapa yg dibuat/dilewati/gagal. */
const catatImporMassal = async (
  actorId: string,
  fileName: string | null,
  hasilParsing: {
    totalDibaca: number;
    bermasalah: number;
  },
  simpan: {
    dibuat: number;
    dilewati: number; // berisi NIM-nya, bukan jumlah
    gagal: number;    // berisi NIM-nya, bukan jumlah
  }
) => {
  await logActivity(
    actorId,
    'IMPORT_STUDENTS_SIMPAN',
    'PublicComment',
    `Impor mahasiswa dari "${fileName ?? 'N/A'}": ${hasilParsing.totalDibaca} baris terbaca, ${hasilParsing.bermasalah} bermasalah, ${simpan.dibuat} dibuat, ${simpan.dilewati} sudah ada sebelumnya (dilewati), ${simpan.gagal} gagal dibuat DB.`,
    undefined,
    {
      fileName: fileName ?? null,
      totalDibaca: hasilParsing.totalDibaca,
      bermasalah: hasilParsing.bermasalah,
      dibuat: simpan.dibuat,
      dilewati: simpan.dilewati,
      gagal: simpan.gagal,
    },
  );
};

/** Langkah 1: baca berkas dan laporkan apa yang akan terjadi. */
export const pratinjauImpor = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Unggah berkas PDF berisi data mahasiswa terlebih dahulu.' });
      return;
    }

    let hasil;
    try {
      hasil = await parsingPdfMahasiswa(req.file.buffer);
    } catch (error) {
      console.error(
        '[impor mahasiswa] Gagal membaca PDF:',
        error instanceof Error ? error.message : error
      );
      res.status(400).json({ message: PESAN_PDF_TIDAK_BISA });
      return;
    }

    // NIM yang sudah ada di sistem (sudah terdaftar) dikumpulkan di sini.
    const nimSudah = await cariNimTerdaftar(hasil.valid.map((v) => v.nim));
    const siap = hasil.valid.filter((v) => !nimSudah.has(v.nim));
    const sudahTerdaftar = hasil.valid.filter((v) => nimSudah.has(v.nim)).length;

    res.status(200).json({
      message: `${siap.length} akun siap dibuat dari ${hasil.totalDibaca} baris yang terbaca.`,
      data: {
        totalDibaca: hasil.totalDibaca,
        valid: hasil.valid.length,
        siapDiimpor: siap.length,
        sudahTerdaftar,
        bermasalah: hasil.bermasalah.length,
        contoh: siap.slice(0, 10),
        daftarBermasalah: hasil.bermasalah.slice(0, BATAS_DETAIL),
        daftarTerdaftar: Array.from(nimSudah).slice(0, BATAS_DETAIL).map((nim) => ({
          nim,
          ada: true,
        })),
        // Data untuk laporan CSV/PDF (baris siap + bermasalah)
        laporan: hasil.valid
          .filter((v) => !nimSudah.has(v.nim))
          .map((v) => [v.nama, v.nim, v.program_studi, 'SIAP']),
        laporanBermasalah: hasil.bermasalah.map((b) =>
          [b.nama ?? '', b.nim ?? '', '', `DIBUANG: ${b.alasan}`]
        ),
        keteranganKolom: ['Nama', 'NIM', 'Program Studi', 'Status'],
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Langkah 2: buat akunnya. NIM yang sudah terdaftar dilewati, akun tidak ditimpa. */
export const simpanImpor = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Unggah berkas PDF berisi data mahasiswa terlebih dahulu.' });
      return;
    }

    let hasil;
    try {
      hasil = await parsingPdfMahasiswa(req.file.buffer);
    } catch (error) {
      console.error(
        '[impor mahasiswa] Gagal membaca PDF:',
        error instanceof Error ? error.message : error
      );
      res.status(400).json({ message: PESAN_PDF_TIDAK_BISA });
      return;
    }

    if (hasil.valid.length === 0) {
      res.status(400).json({ message: PESAN_PDF_TIDAK_BISA });
      return;
    }

    // NIM yang sudah ada dilewati, bukan ditimpa.
    const hasilSimpan = await simpanMahasiswa(hasil.valid);

    // Catat riwayat impor massal di audit log berawetan
    await catatImporMassal(
      req.user.id,
      req.file.originalname ?? null,
      {
        totalDibaca: hasil.totalDibaca,
        bermasalah: hasil.bermasalah.length,
      },
      {
        dibuat: hasilSimpan.dibuat,
        dilewati: hasilSimpan.dilewati.length,
        gagal: hasilSimpan.gagal.length,
      }
    );

    res.status(201).json({
      message: `${hasilSimpan.dibuat} akun mahasiswa berhasil dibuat. ${hasilSimpan.dilewati.length} NIM dilewati karena sudah terdaftar.${hasil.bermasalah.length > 0 ? `, dan ${hasil.bermasalah.length} baris bermasalah di berkas tidak diimpor.` : '.'} Password awal setiap akun sama dengan NIM-nya.`,
      data: {
        dibuat: hasilSimpan.dibuat,
        dilewati: hasilSimpan.dilewati.length,
        gagal: hasilSimpan.gagal.length,
        bermasalah: hasil.bermasalah.length,
        daftarGagal: hasilSimpan.gagal.slice(0, BATAS_DETAIL),
        // Laporan CSV/PDF: baris yang berhasil disimpan + bermasalah + gagal DB
        laporan: hasil.valid
          .filter((v) => !new Set(hasilSimpan.dilewati).has(v.nim))
          .map((v) => [v.nama, v.nim, v.program_studi, 'SIAP']),
        laporanBermasalah: hasil.bermasalah.map((b) =>
          [b.nama ?? '', b.nim ?? '', '', `DIBUANG: ${b.alasan}`]
        ),
        laporanGagalDb: hasilSimpan.gagal.map((nim) => [nim, '', '', 'GAGAL_DB']),
        keteranganKolom: ['Nama', 'NIM', 'Program Studi', 'Status'],
        // Metadata tambahan untuk laporan detail audit
        auditMetadata: {
          fileName: req.file.originalname ?? null,
          totalDibaca: hasil.totalDibaca,
          bermasalah: hasil.bermasalah.length,
          dibuat: hasilSimpan.dibuat,
          dilewati: hasilSimpan.dilewati.length,
          gagal: hasilSimpan.gagal.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Ekspor laporan hasil impor (baris lolos/tolak) dalam bentuk CSV.
 * Endpoint ini dipanggil frontend untuk men-download hasil pratinjau+simpan.
 * Dipisah dari controller utama agar respons pratinjau tetap ringan.
 */
export const exportLaporanImpor = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { laporan, laporanBermasalah, laporanGagalDb, keteranganKolom } = req.body as {
      laporan: string[][];
      laporanBermasalah: string[][];
      laporanGagalDb: string[][];
      keteranganKolom: string[];
    };

    // Gabung semua baris menjadi satu CSV
    const semuaBaris = [
      ...laporan,
      // Tambahkan pemisah visual antar bagian (opsianal)
      ...(laporanBermasalah.length > 0 ? [[...keteranganKolom]] : []),
      ...laporanBermasalah,
      ...(laporanGagalDb.length > 0 ? [[...keteranganKolom]] : []),
      ...laporanGagalDb,
    ];

    const csvContent = [
      keteranganKolom.join(','),
      ...semuaBaris.map((row) =>
        row.map((cell: string) => {
          if (cell.includes(',') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-impor-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    res.status(200).json({ message: 'Laporan berhasil diekspor ke CSV.' });
  } catch (error) {
    next(error);
  }
};

// Ekspor ulang fungsi simpanMahasiswa supaya seed script tetap bisa pakai fungsi yang sama
export { simpanMahasiswa } from '../controllers/student-import.save';
