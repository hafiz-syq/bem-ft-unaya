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

    // Kirim query raw ke Prisma agar kita bisa kelompokkan berdasarkan bulan.
    // Prisma tidak mendukung extract() secara native di semua DB, jadi kita
    // mengambil data mentah kemudian kelompokkan manual di sisi Node.
    const komentarMentah = await prisma.publicComment.findMany({
      where: {
        createdAt: {
          gte: duaBelasBulankeLalu,
          lt: satuDuaBelasBulankeDepan,
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Kelompokkan per bulan (format YYYY-MM)
    const petaBulanan = new Map<string, { total: number; approved: number; rejected: number }>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(
        sekarang.getFullYear(),
        sekarang.getMonth() - (11 - i),
        1
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      petaBulanan.set(key, { total: 0, approved: 0, rejected: 0 });
    }

    for (const baris of komentarMentah) {
      const d = baris.createdAt as Date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = petaBulanan.get(key) ?? { total: 0, approved: 0, rejected: 0 };
      existing.total += 1;
      if (baris.status === 'APPROVED') existing.approved += 1;
      if (baris.status === 'REJECTED') existing.rejected += 1;
      petaBulanan.set(key, existing);
    }

    const komentarPerBulan: ChartSeriesPoint[] = [];
    const urutanKunci = Array.from(petaBulanan.keys()).sort();
    for (const k of urutanKunci) {
      komentarPerBulan.push({
        label: k,
        nilai: petaBulanan.get(k)!.total,
      });
    }

    // --- 2. Tren impor mahasiswa per bulan (berdasarkan audit log IMPORT_STUDENTS_SIMPAN) ---
    const imporMentah = await prisma.auditLog.findMany({
      where: {
        action: 'IMPORT_STUDENTS_SIMPAN',
        createdAt: {
          gte: duaBelasBulankeLalu,
          lt: satuDuaBelasBulankeDepan,
        },
      },
      select: {
        createdAt: true,
        metadata: true,
      },
    });

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

    for (const baris of imporMentah) {
      const d = baris.createdAt as Date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      petaBulananImpor.set(key, (petaBulananImpor.get(key) ?? 0) + 1);
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
    // Total dari metadata log, batasi 1000 baris terakhir agar tidak berat
    const imporBarisTerakhir = await prisma.auditLog.findMany({
      where: { action: 'IMPORT_STUDENTS_SIMPAN' },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: { metadata: true },
    });

    let totalDibuat = 0;
    let totalDilewati = 0;
    let totalGagal = 0;

    for (const baris of imporBarisTerakhir) {
      const m = (baris.metadata as any) ?? {};
      totalDibuat += Number(m.akunDibuat ?? 0);
      totalDilewati += Number(m.akunDilewati ?? 0);
      totalGagal += Number(m.akunGagal ?? 0);
    }

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
          totalImpor: imporBarisTerakhir.length,
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
