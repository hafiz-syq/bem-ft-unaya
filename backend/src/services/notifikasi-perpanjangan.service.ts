import prisma from '../lib/prisma';
import { sendEmailNotification } from './email.service';
import { logSystemActivity } from './audit.service';
import { checkAndNotifyExpiringExtensions } from '../lib/notifikasi-perpanjangan.helper';

/**
 * Notifikasi bila perpanjangan mau habis (30/7 hari sebelum akun dinonaktifkan).
 *
 * Dikumpulkan sekali sehari oleh job di index.ts (lihat notifikasiPerpanjanganHabis).
 * Email dikirim ke admin + menampilkan banner di dashboard.
 */

/** threshold dalam hari: beri tahu admin bila perpanjangan tinggal N hari lagi */
const PERTAHANAN_30_HARI = 30;
const PERTAHANAN_7_HARI = 7;

/**
 * Cari semua accounts yang akan berakhir dalam waktu dekat.
 * Mengembalikan daftar akun yang masih aktif TAPI perpanjanganHingga-nya
 * hampir tercapai (hanya tersisa 30 atau 7 hari).
 */
export async function cariPerpanjanganYangMauHabis(
  hariSisa: number
): Promise<
  {
    id: string;
    nim: string;
    nama: string | null;
    program_studi: string;
    email: string | null;
    no_hp: string | null;
    perpanjanganHingga: Date | null;
    sisaHari: number;
  }[]
> {
  const sekarang = new Date();
  const batasTerdekat = new Date(sekarang.getTime() + hariSisa * 24 * 60 * 60 * 1000);

  const akun = await prisma.user.findMany({
    where: {
      isActive: true,
      role: 'MAHASISWA',
      perpanjanganHingga: {
        gte: sekarang,
        lte: batasTerdekat,
      },
    },
    include: {
      profile: {
        select: {
          nama: true,
          program_studi: true,
          email: true,
          no_hp: true,
        },
      },
    },
    orderBy: {
      perpanjanganHingga: 'asc',
    },
  });

  if (akun.length === 0) return [];

  return akun
    .map((a) => {
      if (!a.perpanjanganHingga) return null;
      const sisaHari = Math.floor(
        (a.perpanjanganHingga.getTime() - sekarang.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (sisaHari < 0 || sisaHari > hariSisa) return null;

      return {
        id: a.id,
        nim: a.nim,
        nama: a.profile?.nama ?? null,
        program_studi: a.profile?.program_studi ?? '-',
        email: a.profile?.email ?? null,
        no_hp: a.profile?.no_hp ?? null,
        perpanjanganHingga: a.perpanjanganHingga ?? new Date(),
        sisaHari,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
}

/**
 * Kirim email notifikasi ke admin tentang akun yang perpanjangan mau habis.
 */
export async function kirimNotifikasiPerpanjangan(
  akunYangMauHabis: Awaited<ReturnType<typeof cariPerpanjanganYangMauHabis>>,
  hariSisa: number
): Promise<void> {
  if (akunYangMauHabis.length === 0) return;

  const adminEmail = process.env.ADMIN_EMAIL || '';

  const listString = akunYangMauHabis
    .map((a) => {
      const nama = a.nama ?? a.nim;
      const tgl = a.perpanjanganHingga ? a.perpanjanganHingga.toLocaleDateString('id-ID') : '-';
      return `<li><strong>${nama}</strong> (${a.nim}) — ${a.program_studi} — Tinggal ${a.sisaHari} hari lagi (perpanjangan sampai ${tgl})</li>`;
    })
    .join('\n');

  const subject = `Peringatan: ${akunYangMauHabis.length} akun mahasiswa perpanjangan mau habis (${hariSisa} hari lagi)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
      <h2 style="color: #333;">Peringatan Perpanjangan Mahasiswa</h2>
      <p>Ada <strong>${akunYangMauHabis.length} akun mahasiswa</strong> yang masa perpanjangannya akan segera habis dalam <strong>${hariSisa} hari</strong> ke depan.</p>
      <p>Silakan ikuti akun ini sebelum masa perpanjangannya berakhir:</p>
      <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
        ${listString}
      </ul>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        Notifikasi ini otomatis dikirim oleh sistem. Jika ada pertanyaan, hubungi administrator.
      </p>
    </div>
  `;

  if (adminEmail) {
    await sendEmailNotification(adminEmail, subject, html);
  }

  await logSystemActivity(
    'NOTIFICATION_PERPANJANGAN_HABIS',
    'System',
    `Notifikasi otomatis: ${akunYangMauHabis.length} akun mahasiswa mendekati akhir masa perpanjangan (${hariSisa} hari lagi).`,
    undefined,
    {
      jumlahAkun: akunYangMauHabis.length,
      hariSisa,
      daftarNim: akunYangMauHabis.map((a) => a.nim),
    }
  );
}

/** Penanda tanggal (YYYY-MM-DD) terakhir email peringatan dikirim, dalam memori proses server. */
let hariTerakhirEmailDikirim: string | null = null;

/**
 * Kirim SATU email gabungan untuk semua akun yang mau habis (30 & 7 hari sekaligus),
 * diurutkan dari yang paling mendesak (sisa hari paling sedikit).
 */
export async function kirimNotifikasiPerpanjanganGabungan(
  akunYangMauHabis: Awaited<ReturnType<typeof cariPerpanjanganYangMauHabis>>
): Promise<void> {
  if (akunYangMauHabis.length === 0) return;

  const adminEmail = process.env.ADMIN_EMAIL || '';
  const urut = [...akunYangMauHabis].sort((a, b) => a.sisaHari - b.sisaHari);
  const mendesak = urut.filter((a) => a.sisaHari <= PERTAHANAN_7_HARI);

  const listString = urut
    .map((a) => {
      const nama = a.nama ?? a.nim;
      const tgl = a.perpanjanganHingga ? a.perpanjanganHingga.toLocaleDateString('id-ID') : '-';
      const lencana = a.sisaHari <= PERTAHANAN_7_HARI
        ? ' <strong style="color:#dc2626;">[MENDESAK]</strong>'
        : '';
      return `<li><strong>${nama}</strong> (${a.nim}) — ${a.program_studi} — Tinggal ${a.sisaHari} hari lagi (perpanjangan sampai ${tgl})${lencana}</li>`;
    })
    .join('\n');

  const subject = `Peringatan: ${urut.length} akun mahasiswa perpanjangan mau habis (${mendesak.length} tinggal ≤${PERTAHANAN_7_HARI} hari)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
      <h2 style="color: #333;">Peringatan Perpanjangan Mahasiswa</h2>
      <p>Ada <strong>${urut.length} akun mahasiswa</strong> yang masa perpanjangannya akan segera habis, dengan rincian:</p>
      <ul>
        <li><strong>${urut.length - mendesak.length} akun</strong> masih tersisa 8–${PERTAHANAN_30_HARI} hari</li>
        <li><strong>${mendesak.length} akun</strong> tinggal ≤${PERTAHANAN_7_HARI} hari (ditandai MENDESAK)</li>
      </ul>
      <p>Silakan tindak lanjuti akun ini sebelum masa perpanjangannya berakhir:</p>
      <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
        ${listString}
      </ul>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        Notifikasi ini otomatis dikirim oleh sistem (maksimal satu kali sehari). Jika ada pertanyaan, hubungi administrator.
      </p>
    </div>
  `;

  if (adminEmail) {
    await sendEmailNotification(adminEmail, subject, html);
  }

  await logSystemActivity(
    'NOTIFICATION_PERPANJANGAN_HABIS',
    'System',
    `Notifikasi otomatis (email gabungan): ${urut.length} akun mahasiswa mendekati akhir masa perpanjangan (${mendesak.length} di antaranya ≤${PERTAHANAN_7_HARI} hari).`,
    undefined,
    {
      jumlahAkun: urut.length,
      jumlahMendesak: mendesak.length,
      daftarNim: urut.map((a) => a.nim),
    }
  );
}

/**
 * Jalankan pemeriksaan dan kirim notifikasi bila ada akun yang perpanjangan mau habis.
 * Email paling banyak sekali per hari (guard in-memory per tanggal server).
 */
export async function pemeriksaanPerpanjanganHarian(): Promise<
  Record<string, number>
> {
  // Gunakan helper untuk pengecekan utama dan kirim notifikasi
  const { checked } = await checkAndNotifyExpiringExtensions();

  // Jendela 30 hari sudah mencakup akun 7 hari, jadi cukup satu query.
  const akun30Hari = await cariPerpanjanganYangMauHabis(PERTAHANAN_30_HARI);
  const akun7Hari = await cariPerpanjanganYangMauHabis(PERTAHANAN_7_HARI);

  const hariIni = new Date().toISOString().slice(0, 10);
  const sudahDikirimHariIni = hariTerakhirEmailDikirim === hariIni;

  if (!sudahDikirimHariIni && akun30Hari.length > 0) {
    await kirimNotifikasiPerpanjanganGabungan(akun30Hari);
    hariTerakhirEmailDikirim = hariIni;
  }

  return {
    '30_hari': akun30Hari.length,
    '7_hari': akun7Hari.length,
    ...(sudahDikirimHariIni ? { 'lewati_sudah_dikirim': 1 } : {}),
  };
}
