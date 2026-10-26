import { Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import { isAdminRole, OFFICER_ROLES } from '../lib/ticket-access';
import { hitungAngkatan } from '../services/account-lifecycle.service';
import { logActivity } from '../services/audit.service';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const bacaPeriode = (nilai: unknown): { mulai: Date; selesai: Date; label: string; kunci: string } => {
  const teks = String(nilai || '').trim();
  const cocok = /^(\d{4})-(\d{2})$/.exec(teks);
  const sekarang = new Date();
  const tahun = cocok ? Number(cocok[1]) : sekarang.getFullYear();
  const bulan = cocok ? Number(cocok[2]) : sekarang.getMonth() + 1;
  const aman = Math.min(12, Math.max(1, bulan));
  return {
    mulai: new Date(tahun, aman - 1, 1),
    selesai: new Date(tahun, aman, 1),
    label: `${NAMA_BULAN[aman - 1]} ${tahun}`,
    kunci: `${tahun}-${String(aman).padStart(2, '0')}`,
  };
};

const gayaJudul = (sheet: ExcelJS.Worksheet, judul: string) => {
  sheet.insertRow(1, [judul]);
  sheet.mergeCells(1, 1, 1, sheet.columnCount || 1);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(1).alignment = { horizontal: 'center' };
  sheet.insertRow(2, []);
  sheet.getRow(3).font = { bold: true };
};

/**
 * Laporan bulanan untuk admin: satu berkas Excel berisi ringkasan, jumlah
 * mahasiswa per angkatan, tiket, buku tamu, dan pengajuan perubahan data.
 */
export const downloadMonthlyReport = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin yang dapat mengunduh laporan bulanan.' });
      return;
    }

    const periode = bacaPeriode(req.query.month);
    const rentang = { gte: periode.mulai, lt: periode.selesai };

    const [
      totalMahasiswa,
      totalPengurus,
      tiketBulanIni,
      penggunaAngkatan,
      komentar,
      pengajuan,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'MAHASISWA', deletedAt: null } }),
      prisma.user.count({
        where: { role: { in: ['PENGURUS', ...OFFICER_ROLES, 'ADMIN', 'SUPERADMIN'] as any }, deletedAt: null },
      }),
      prisma.ticket.findMany({
        where: { createdAt: rentang },
        include: {
          sender: { select: { nim: true, profile: { select: { nama: true, program_studi: true } } } },
          assignments: { where: { isActive: true }, include: { assignee: { select: { nim: true } } } },
          replies: { select: { id: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: { in: ['MAHASISWA', ...OFFICER_ROLES] as any }, deletedAt: null },
        select: { nim: true, isActive: true },
      }),
      prisma.publicComment.findMany({
        where: { createdAt: rentang },
        select: { status: true, isFlagged: true, deletedAt: true },
      }),
      prisma.dataChangeRequest.groupBy({
        by: ['status'],
        where: { createdAt: rentang },
        _count: { _all: true },
      }),
    ]);

    const perAngkatan = new Map<number, { total: number; aktif: number; nonaktif: number }>();
    for (const u of penggunaAngkatan) {
      const tahun = hitungAngkatan(u.nim);
      if (!tahun) continue;
      const isi = perAngkatan.get(tahun) || { total: 0, aktif: 0, nonaktif: 0 };
      isi.total += 1;
      if (u.isActive) isi.aktif += 1;
      else isi.nonaktif += 1;
      perAngkatan.set(tahun, isi);
    }

    const rating = tiketBulanIni.filter((t) => t.rating !== null);
    const rataRating = rating.length
      ? rating.reduce((jumlah, t) => jumlah + (t.rating || 0), 0) / rating.length
      : 0;
    const selesai = tiketBulanIni.filter((t) => t.status === 'SELESAI').length;
    const terlambat = tiketBulanIni.filter(
      (t) =>
        !t.firstResponseAt &&
        t.status !== 'SELESAI' &&
        t.status !== 'DITOLAK' &&
        Date.now() > t.createdAt.getTime() + 24 * 60 * 60 * 1000
    ).length;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BEM-FT UNAYA';
    workbook.created = new Date();

    const ringkasan = workbook.addWorksheet('Ringkasan');
    ringkasan.columns = [
      { header: 'Indikator', key: 'indikator', width: 42 },
      { header: 'Nilai', key: 'nilai', width: 22 },
    ];
    ringkasan.addRows([
      { indikator: 'Periode laporan', nilai: periode.label },
      { indikator: 'Total mahasiswa (akun aktif di sistem)', nilai: totalMahasiswa },
      { indikator: 'Total pengurus & admin', nilai: totalPengurus },
      { indikator: 'Tiket masuk bulan ini', nilai: tiketBulanIni.length },
      { indikator: 'Tiket selesai bulan ini', nilai: selesai },
      { indikator: 'Tiket melewati SLA 24 jam', nilai: terlambat },
      { indikator: 'Rata-rata penilaian tiket', nilai: Number(rataRating.toFixed(2)) },
      { indikator: 'Pesan buku tamu masuk', nilai: komentar.length },
      { indikator: 'Pesan ditandai perlu ditinjau', nilai: komentar.filter((k) => k.isFlagged).length },
      { indikator: 'Pengajuan perubahan data', nilai: pengajuan.reduce((n, p) => n + p._count._all, 0) },
    ]);
    gayaJudul(ringkasan, `Laporan Bulanan BEM-FT UNAYA — ${periode.label}`);

    const angkatan = workbook.addWorksheet('Mahasiswa per Angkatan');
    angkatan.columns = [
      { header: 'Angkatan', key: 'angkatan', width: 14 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Aktif', key: 'aktif', width: 12 },
      { header: 'Nonaktif', key: 'nonaktif', width: 12 },
    ];
    [...perAngkatan.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([tahun, isi]) => angkatan.addRow({ angkatan: tahun, ...isi }));
    gayaJudul(angkatan, `Jumlah Mahasiswa per Angkatan — ${periode.label}`);

    const tiket = workbook.addWorksheet('Tiket');
    tiket.columns = [
      { header: 'No. Tiket', key: 'no', width: 22 },
      { header: 'Tanggal', key: 'tanggal', width: 20 },
      { header: 'Jenis', key: 'jenis', width: 12 },
      { header: 'Kategori', key: 'kategori', width: 16 },
      { header: 'Judul', key: 'judul', width: 36 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Prioritas', key: 'prioritas', width: 12 },
      { header: 'Respons Pertama', key: 'respons', width: 20 },
      { header: 'Selesai', key: 'selesai', width: 20 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Pengirim', key: 'pengirim', width: 28 },
      { header: 'NIM', key: 'nim', width: 16 },
      { header: 'Petugas', key: 'petugas', width: 18 },
    ];
    tiketBulanIni.forEach((t) =>
      tiket.addRow({
        no: t.ticket_no,
        tanggal: t.createdAt.toLocaleString('id-ID'),
        jenis: t.type,
        kategori: t.category,
        judul: t.title,
        status: t.status,
        prioritas: t.priority,
        respons: t.firstResponseAt ? t.firstResponseAt.toLocaleString('id-ID') : '-',
        selesai: t.resolvedAt ? t.resolvedAt.toLocaleString('id-ID') : '-',
        rating: t.rating ?? '-',
        pengirim: t.sender.profile?.nama ?? '-',
        nim: t.sender.nim,
        petugas: t.assignments[0]?.assignee.nim ?? '-',
      })
    );
    gayaJudul(tiket, `Daftar Tiket — ${periode.label}`);

    const bukuTamu = workbook.addWorksheet('Buku Tamu');
    bukuTamu.columns = [
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Jumlah', key: 'jumlah', width: 12 },
    ];
    const hitungStatus = (status: string) => komentar.filter((k) => k.status === status && !k.deletedAt).length;
    bukuTamu.addRows([
      { status: 'Menunggu', jumlah: hitungStatus('PENDING') },
      { status: 'Tayang', jumlah: hitungStatus('APPROVED') },
      { status: 'Ditolak', jumlah: hitungStatus('REJECTED') },
      { status: 'Ditandai', jumlah: komentar.filter((k) => k.isFlagged && !k.deletedAt).length },
      { status: 'Di tempat sampah', jumlah: komentar.filter((k) => k.deletedAt).length },
    ]);
    gayaJudul(bukuTamu, `Rekap Buku Tamu — ${periode.label}`);

    const pengajuanSheet = workbook.addWorksheet('Perubahan Data');
    pengajuanSheet.columns = [
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Jumlah', key: 'jumlah', width: 12 },
    ];
    pengajuan.forEach((p) => pengajuanSheet.addRow({ status: p.status, jumlah: p._count._all }));
    gayaJudul(pengajuanSheet, `Pengajuan Perubahan Data — ${periode.label}`);

    const namaBerkas = `laporan-bem-ft-unaya-${periode.kunci}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${namaBerkas}"`);

    await logActivity(
      req.user.id,
      'DOWNLOAD_MONTHLY_REPORT',
      'Report',
      `Mengunduh laporan bulanan ${periode.label}`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Dipanggil cron pada awal bulan: memberi tahu admin bahwa laporan bulan
 * sebelumnya sudah bisa diunduh. Penanda disimpan di SiteSetting supaya tidak
 * mengirim notifikasi berulang pada bulan yang sama.
 */
export async function kirimPengingatLaporanBulanan(sekarang: Date = new Date()): Promise<boolean> {
  if (sekarang.getDate() !== 1) return false;

  const bulanLalu = new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, 1);
  const kunci = `laporan_bulanan_terakhir`;
  const nilai = `${bulanLalu.getFullYear()}-${String(bulanLalu.getMonth() + 1).padStart(2, '0')}`;

  const tersimpan = await prisma.siteSetting.findUnique({ where: { key: kunci } });
  if (tersimpan?.value === nilai) return false;

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, deletedAt: null },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: 'Laporan Bulanan Siap',
        message: `Laporan bulan ${NAMA_BULAN[bulanLalu.getMonth()]} ${bulanLalu.getFullYear()} dapat diunduh dari dashboard.`,
      })),
    });
  }

  await prisma.siteSetting.upsert({
    where: { key: kunci },
    update: { value: nilai },
    create: { key: kunci, value: nilai },
  });

  return true;
}
