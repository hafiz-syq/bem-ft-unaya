import prisma from './prisma';
import { isAdminRole } from './ticket-access';

/**
 * Aturan tunggal tentang siapa yang boleh membuka arsip surat.
 *
 * Arsip hanya untuk pimpinan inti, bukan seluruh pengurus:
 * - Ketua, Wakil Ketua, dan Sekretaris BEM;
 * - Ketua DPM;
 * - Ketua, Wakil Ketua, dan Sekretaris setiap himpunan.
 *
 * Jabatan dibaca dari tabel Position (slot aktif, bukan jabatan divisi) supaya
 * akses mengikuti kepengurusan yang sedang berlaku, bukan role akun. Admin dan
 * superadmin selalu boleh karena mereka pengelola arsip.
 */

/** Judul jabatan pimpinan inti yang mendapat akses arsip. */
export const JABATAN_INTI = ['KETUA', 'WAKIL KETUA', 'SEKRETARIS'] as const;

/** Menyamakan penulisan jabatan: "wakil  ketua" -> "WAKIL KETUA". */
const normalisasiJabatan = (judul: string): string =>
  judul.trim().toUpperCase().replace(/\s+/g, ' ');

export interface JabatanInti {
  organization: string;
  title: string;
}

/**
 * Jabatan pimpinan inti yang sedang dipegang pengguna.
 *
 * `departmentId: null` berarti hanya jabatan tingkat organisasi (Ketua BEM,
 * Sekretaris Himpunan, dst.). Jabatan tingkat divisi seperti "Ketua Divisi"
 * tidak memberi akses arsip karena bukan pimpinan organisasi.
 */
export async function jabatanIntiPengguna(userId: string): Promise<JabatanInti[]> {
  const posisi = await prisma.position.findMany({
    where: {
      userId,
      isActive: true,
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      positionSlot: { isActive: true, departmentId: null },
    },
    select: {
      positionSlot: {
        select: { title: true, organization: { select: { name: true } } },
      },
    },
  });

  return posisi
    .filter((p) => (JABATAN_INTI as readonly string[]).includes(normalisasiJabatan(p.positionSlot.title)))
    .map((p) => ({ organization: p.positionSlot.organization.name, title: p.positionSlot.title }));
}

/** Apakah pemilik sesi boleh membuka dan mengelola arsip surat. */
export async function bolehAksesArsip(user: { id: string; role: string }): Promise<boolean> {
  if (isAdminRole(user.role)) return true;
  return (await jabatanIntiPengguna(user.id)).length > 0;
}

/**
 * Pemilah surat masuk/keluar hanya untuk admin & superadmin. Pengurus lain
 * tetap melihat seluruh arsip tanpa pilihan arah.
 */
export const bolehPilihArahSurat = (role: string | null | undefined): boolean =>
  isAdminRole(role);

/** Arah surat yang sah. */
export const ARAH_SURAT = ['MASUK', 'KELUAR'] as const;
export type ArahSurat = (typeof ARAH_SURAT)[number];

export const isArahSurat = (nilai: unknown): nilai is ArahSurat =>
  typeof nilai === 'string' && (ARAH_SURAT as readonly string[]).includes(nilai);
