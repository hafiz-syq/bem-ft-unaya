import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

/**
 * Dashboard Charts — tren komentar publik dan impor mahasiswa.
 * Endpoint: GET /api/dashboard/charts
 * Akses: ADMIN atau PENGURUS
 */

export interface ChartSeriesPoint {
  label: string;   // label sumbu-X (mis. "2024-11")
  nilai: number;
}

export interface DashboardCharts {
  komentarPerBulan: ChartSeriesPoint[];
  imporPerBulan: ChartSeriesPoint[];
  komentarPerStatus: {
    menunggu: number;
    disetujui: number;
    ditolak: number;
  };
  imporTotal: {
    totalImpor: number;     // total aksi IMPORT_STUDENTS_SIMPAN dalam log
    totalDibuat: number;    // jumlah akun yang berhasil dibuat (dari metadata log)
    totalDilewati: number;  // jumlah akun yang dilewati
    totalGagal: number;     // jumlah akun yang gagal dibuat
  };
}

export const getDashboardCharts = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // --- 1. Tren komentar publik per bulan (12 bulan terakhir) ---
    const sekarang = new Date();
    const satuDuaBelasBulankeDepan = new Date(
      sekarang.getFullYear(),
      sekarang.getMonth() + 1,
      1
    );
    const duaBelasBulankeLalu = new Date(
      sekarang.getFullYear(),
      sekarang.getMonth() - 11,
      1
    );

    // Kelompok per bulan dikerjakan database lewat DATE_FORMAT. Sebelumnya
    // seluruh baris 12 bulan diambil lalu dihitung di Node: query 40x lebih
    // besar dari hasilnya dan membebani memori function serverless.
    // shortcut: bulan dihitung dari nilai createdAt apa adanya (UTC di Vercel),
    // sama seperti produksi hari ini karena fungsi berjalan di zona UTC.
    const barisKomentar = await prisma.$queryRaw<{ bulan: string; total: bigint }[]>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS bulan, COUNT(*) AS total
      FROM PublicComment
      WHERE createdAt >= ${duaBelasBulankeLalu} AND createdAt < ${satuDuaBelasBulankeDepan}
      GROUP BY bulan
    `;

    const petaBulanan = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(
        sekarang.getFullYear(),
        sekarang.getMonth() - (11 - i),
        1
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      petaBulanan.set(key, 0);
    }
    for (const baris of barisKomentar) {
      petaBulanan.set(baris.bulan, Number(baris.total));
    }

    const komentarPerBulan: ChartSeriesPoint[] = [];
    const urutanKunci = Array.from(petaBulanan.keys()).sort();
    for (const k of urutanKunci) {
      komentarPerBulan.push({
        label: k,
        nilai: petaBulanan.get(k)!,
      });
    }

    // --- 2. Tren impor mahasiswa per bulan (berdasarkan audit log IMPORT_STUDENTS_SIMPAN) ---
    const barisImpor = await prisma.$queryRaw<{ bulan: string; total: bigint }[]>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS bulan, COUNT(*) AS total
      FROM AuditLog
      WHERE action = 'IMPORT_STUDENTS_SIMPAN'
        AND createdAt >= ${duaBelasBulankeLalu} AND createdAt < ${satuDuaBelasBulankeDepan}
      GROUP BY bulan
    `;

    const petaBulananImpor = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(
        sekarang.getFullYear(),
        sekarang.getMonth() - (11 - i),
        1
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      petaBulananImpor.set(key, 0);
    }
    for (const baris of barisImpor) {
      petaBulananImpor.set(baris.bulan, Number(baris.total));
    }

    const imporPerBulan: ChartSeriesPoint[] = [];
    for (const k of Array.from(petaBulananImpor.keys()).sort()) {
      imporPerBulan.push({
        label: k,
        nilai: petaBulananImpor.get(k)!,
      });
    }

    // --- 3. Status komentar (selalu terbaru) ---
    const [menunggu, disetujui, ditolak] = await Promise.all([
      prisma.publicComment.count({ where: { status: 'PENDING' } }),
      prisma.publicComment.count({ where: { status: 'APPROVED' } }),
      prisma.publicComment.count({ where: { status: 'REJECTED' } }),
    ]);

    // --- 4. Ringkasan impor (akumulasi dari log, bukan real-time) ---
    // Jumlahnya dihitung di DB atas SEMUA baris. Versi lama membaca 1000 baris
    // terakhir lalu menjumlah metadata di Node, jadi angkanya diam-diam kurang
    // begitu jumlah log melewati 1000.
    const [ringkasanImpor] = await prisma.$queryRaw<
      { totalImpor: bigint; dibuat: bigint | null; dilewati: bigint | null; gagal: bigint | null }[]
    >`
      SELECT COUNT(*) AS totalImpor,
             SUM(CAST(JSON_EXTRACT(metadata, '$.akunDibuat') AS SIGNED)) AS dibuat,
             SUM(CAST(JSON_EXTRACT(metadata, '$.akunDilewati') AS SIGNED)) AS dilewati,
             SUM(CAST(JSON_EXTRACT(metadata, '$.akunGagal') AS SIGNED)) AS gagal
      FROM AuditLog
      WHERE action = 'IMPORT_STUDENTS_SIMPAN'
    `;

    const totalImpor = Number(ringkasanImpor?.totalImpor ?? 0);
    const totalDibuat = Number(ringkasanImpor?.dibuat ?? 0);
    const totalDilewati = Number(ringkasanImpor?.dilewati ?? 0);
    const totalGagal = Number(ringkasanImpor?.gagal ?? 0);

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
          totalImpor,
          totalDibuat,
          totalDilewati,
          totalGagal,
        },
      },
    } as const);
  } catch (error) {
    next(error);
  }
};

/** Endpoint kecil untuk format CSV laporan impor.
 * Dipanggil frontend bila ingin mendownload hasil impor dalam bentuk CSV.
 * URL: GET /api/dashboard/charts/export-impor?namaBerkas=xxx&totalDibaca=x&bermasalah=x&...
 * (Data diambil dari query params, bukan dari DB, karena frontend sudah punya datanya
 *   dari langkah pratinjau atau setelah simpan.)
 */
export const exportImporCsv = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      namaBerkas,
      totalDibaca,
      bermasalah,
      laporan,            // JSON string: array array [nama,nim,prodi,status]
      laporanBermasalah, // JSON string: array array [nama,nim,status]
      laporanGagalDb,    // JSON string: array NIM yang gagal DB
      keteranganKolom,   // JSON string: array nama kolom
    } = req.query;

    const kolom = JSON.parse(keteranganKolom as string || '["Nama","NIM","Program Studi","Status"]');
    const barisSiap = JSON.parse(laporan as string || '[]') as string[][];
    const barisBermasalah = JSON.parse(laporanBermasalah as string || '[]') as string[][];
    const barisGagalDb = JSON.parse(laporanGagalDb as string || '[]') as string[];

    // Gabung semua baris: siap, bermasalah, gagal DB
    const semuaBaris: string[][] = [
      ...barisSiap,
      ...barisBermasalah.map((b: string[]) => [...b, 'DIBUANG']),
      ...barisGagalDb.map((nim) => [nim, '', '', 'GAGAL_DB']),
    ];

    // CSV content
    const header = kolom.join(',') + '\n';
    const rows = semuaBaris.map((row) =>
      row.map((cell) => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ).join('\n');

    const csv = header + rows;
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-impor-${namaBerkas || 'import'}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
