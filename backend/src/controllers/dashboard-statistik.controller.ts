import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isAdminRole } from '../lib/ticket-access';

/**
 * Statistik dashboard yang dipakai SEMUA role.
 *
 * Endpoint terpisah dari /dashboard/stats supaya bentuk data lama (yang sudah
 * dipakai kartu ringkasan) tidak berubah. Isinya:
 * - kartu: angka ringkas yang relevan untuk role pemilik sesi,
 * - trenTiket: jumlah tiket per bulan (grafik batang),
 * - distribusi: tiket per organisasi tujuan / per jenis,
 * - antrean: pekerjaan yang menunggu tindakan admin & pengurus.
 *
 * Semua grafik dihitung di server dan dikirim sebagai deret angka sederhana,
 * sehingga frontend tidak perlu library chart.
 */

const NAMA_BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/** Deret 12 bulan terakhir (termasuk bulan berjalan), berurutan lama → baru. */
const labelBulan = (jumlahBulan: number): { key: string; label: string }[] => {
  const sekarang = new Date();
  const hasil: { key: string; label: string }[] = [];
  for (let i = jumlahBulan - 1; i >= 0; i--) {
    const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - i, 1);
    hasil.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${NAMA_BULAN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
  }
  return hasil;
};

const kunciBulan = (tanggal: Date): string =>
  `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, '0')}`;

/** Rata-rata jam sampai balasan pertama (dibulatkan 1 desimal). */
const rataResponsJam = (baris: { createdAt: Date; replies: { createdAt: Date }[] }[]): number => {
  const selisih = baris
    .filter((t) => t.replies.length > 0)
    .map((t) => (t.replies[0].createdAt.getTime() - t.createdAt.getTime()) / 3_600_000)
    .filter((jam) => jam >= 0);

  if (selisih.length === 0) return 0;
  const total = selisih.reduce((a, b) => a + b, 0);
  return Math.round((total / selisih.length) * 10) / 10;
};

export const getDashboardStatistik = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    const pengelola = isAdminRole(user.role) || user.role === 'PENGURUS';
    const bulan = labelBulan(12);

    if (pengelola) {
      const duaBelasBulanLalu = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);

      const [
        totalTiket,
        tiketAktif,
        tiketSelesai,
        tiketMenungguModerasi,
        totalMahasiswa,
        totalPengurus,
        menungguKomentar,
        menungguKomentarGaleri,
        akunNonaktif,
        akunDiperpanjang,
        tikets,
      ] = await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.count({ where: { status: { in: ['DIKIRIM', 'DITINJAU', 'DIPROSES'] } } }),
        prisma.ticket.count({ where: { status: 'SELESAI' } }),
        prisma.ticket.count({ where: { moderationStatus: 'PENDING_MODERATION' } }),
        prisma.user.count({ where: { role: 'MAHASISWA' } }),
        prisma.user.count({ where: { role: { in: ['PENGURUS', 'ADMIN', 'SUPERADMIN'] } } }),
        prisma.publicComment.count({ where: { status: 'PENDING' } }),
        prisma.galleryComment.count({ where: { status: 'PENDING' } }),
        prisma.user.count({ where: { isActive: false, deactivationType: 'AUTO' } }),
        prisma.user.count({ where: { perpanjanganHingga: { gt: new Date() } } }),
        // Dibatasi 2000 tiket terakhir agar respons tetap cepat walau data besar.
        prisma.ticket.findMany({
          where: { createdAt: { gte: duaBelasBulanLalu } },
          orderBy: { createdAt: 'desc' },
          take: 2000,
          select: {
            id: true,
            type: true,
            targetOrganization: true,
            status: true,
            createdAt: true,
            replies: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
          },
        }),
      ]);

      const petaTren = new Map(bulan.map((b) => [b.key, 0]));
      const petaDistribusi = new Map<string, number>();
      const petaStatus = new Map<string, number>();

      for (const tiket of tikets) {
        const key = kunciBulan(tiket.createdAt);
        if (petaTren.has(key)) petaTren.set(key, (petaTren.get(key) ?? 0) + 1);

        const target = tiket.targetOrganization ?? 'TIDAK_DITENTUKAN';
        petaDistribusi.set(target, (petaDistribusi.get(target) ?? 0) + 1);

        petaStatus.set(tiket.status, (petaStatus.get(tiket.status) ?? 0) + 1);
      }

      res.status(200).json({
        data: {
          role: user.role,
          kartu: {
            totalTiket,
            tiketAktif,
            tiketSelesai,
            tiketMenungguModerasi,
            rataResponsJam: rataResponsJam(tikets),
            totalMahasiswa,
            totalPengurus,
            menungguKomentar,
            menungguKomentarGaleri,
            akunNonaktif,
            akunDiperpanjang,
          },
          trenTiket: bulan.map((b) => ({ label: b.label, nilai: petaTren.get(b.key) ?? 0 })),
          distribusi: Array.from(petaDistribusi.entries())
            .map(([target, nilai]) => ({ label: target, nilai }))
            .sort((a, b) => b.nilai - a.nilai),
          statusTiket: Array.from(petaStatus.entries()).map(([status, nilai]) => ({ label: status, nilai })),
        },
      });
      return;
    }

    // --- MAHASISWA: statistik tiket milik sendiri ---
    const bulanEnam = labelBulan(6);
    const enamBulanLalu = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);

    const [tiketSaya, totalKomentarGaleri] = await Promise.all([
      prisma.ticket.findMany({
        where: { senderId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          type: true,
          targetOrganization: true,
          status: true,
          createdAt: true,
          replies: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        },
      }),
      prisma.galleryComment.count({ where: { authorId: user.id } }),
    ]);

    const petaTren = new Map(bulanEnam.map((b) => [b.key, 0]));
    const petaStatus = new Map<string, number>();
    let ditanggapi = 0;

    for (const tiket of tiketSaya) {
      if (tiket.createdAt >= enamBulanLalu) {
        const key = kunciBulan(tiket.createdAt);
        if (petaTren.has(key)) petaTren.set(key, (petaTren.get(key) ?? 0) + 1);
      }
      petaStatus.set(tiket.status, (petaStatus.get(tiket.status) ?? 0) + 1);
      if (tiket.replies.length > 0) ditanggapi += 1;
    }

    res.status(200).json({
      data: {
        role: user.role,
        kartu: {
          totalTiket: tiketSaya.length,
          tiketAktif: tiketSaya.filter((t) => ['DIKIRIM', 'DITINJAU', 'DIPROSES'].includes(t.status)).length,
          tiketSelesai: tiketSaya.filter((t) => t.status === 'SELESAI').length,
          rataResponsJam: rataResponsJam(tiketSaya),
          ditanggapi,
          totalKomentarGaleri,
        },
        trenTiket: bulanEnam.map((b) => ({ label: b.label, nilai: petaTren.get(b.key) ?? 0 })),
        statusTiket: Array.from(petaStatus.entries()).map(([status, nilai]) => ({ label: status, nilai })),
      },
    });
  } catch (error) {
    next(error);
  }
};
