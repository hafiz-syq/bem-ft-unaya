import prisma from './prisma';
import { Prisma } from '@prisma/client';
import { isAdminRole } from './ticket-access';
import { tingkatOrganisasi } from './organisasi';

/**
 * Aturan tunggal tentang siapa yang boleh membuka arsip surat dan surat siapa
 * yang boleh ia lihat.
 *
 * Dua lapis:
 *
 * 1. Pintu halaman — arsip hanya untuk pimpinan inti, bukan seluruh pengurus:
 *    Ketua/Wakil Ketua/Sekretaris BEM, Ketua DPM, dan Ketua/Wakil Ketua/
 *    Sekretaris setiap himpunan. Jabatan dibaca dari tabel Position (slot
 *    aktif, bukan jabatan divisi) supaya akses mengikuti kepengurusan yang
 *    sedang berlaku, bukan role akun. Admin dan superadmin selalu boleh.
 *
 * 2. Ruang lingkup surat — setiap surat terikat pada organisasi yang
 *    menerbitkan/menerimanya, dan hanya menyebar ke tingkat di atasnya:
 *    himpunan (tingkat 1) -> BEM (2) -> DPM (3) -> admin. Contohnya surat DPM
 *    hanya terlihat DPM serta admin, surat BEM terlihat DPM dan admin, surat
 *    himpunan terlihat himpunan itu sendiri, BEM, DPM, dan admin.
 */

/** Judul jabatan pimpinan inti yang mendapat akses arsip. */
export const JABATAN_INTI = ['KETUA', 'WAKIL KETUA', 'SEKRETARIS'] as const;

/** Menyamakan penulisan jabatan: "wakil  ketua" -> "WAKIL KETUA". */
const normalisasiJabatan = (judul: string): string =>
  judul.trim().toUpperCase().replace(/\s+/g, ' ');

export interface JabatanInti {
  organizationId: string;
  organization: string;
  /** Tipe organisasi (HIMPUNAN/BEM/DPM) untuk menentukan tingkat visibilitas. */
  kind: string;
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
        select: {
          title: true,
          organization: { select: { id: true, name: true, kind: true } },
        },
      },
    },
  });

  return posisi
    .filter((p) => (JABATAN_INTI as readonly string[]).includes(normalisasiJabatan(p.positionSlot.title)))
    .map((p) => ({
      organizationId: p.positionSlot.organization.id,
      organization: p.positionSlot.organization.name,
      kind: p.positionSlot.organization.kind,
      title: p.positionSlot.title,
    }));
}

/** Apakah pemilik sesi boleh membuka halaman arsip surat. */
export async function bolehAksesArsip(user: { id: string; role: string }): Promise<boolean> {
  if (isAdminRole(user.role)) return true;
  return (await jabatanIntiPengguna(user.id)).length > 0;
}

/**
 * Ruang lingkup arsip milik satu pengguna.
 *
 * `organisasiTerlihat` = organisasi yang dipegang sendiri, plus seluruh
 * organisasi ber-tipe lebih rendah (himpunan terlihat oleh BEM/DPM, dst.).
 * Surat tanpa organisasi tidak termasuk di sini — hanya admin dan pembuatnya
 * yang boleh melihatnya.
 */
export interface CakupanArsip {
  admin: boolean;
  /** Tingkat tertinggi yang dipegang; 0 bila bukan pimpinan inti mana pun. */
  tingkat: number;
  /** Organisasi yang dipegang pengguna; surat organisasi ini selalu terlihat. */
  organisasiSendiri: string[];
  /** Semua id organisasi yang boleh dilihat pengguna. */
  organisasiTerlihat: string[];
}

/** Hitung cakupan arsip pengguna dari jabatan inti yang sedang dipegang. */
export async function cakupanArsipPengguna(user: { id: string; role: string }): Promise<CakupanArsip> {
  if (isAdminRole(user.role)) {
    return { admin: true, tingkat: 0, organisasiSendiri: [], organisasiTerlihat: [] };
  }

  const jabatan = await jabatanIntiPengguna(user.id);
  const organisasiSendiri = [...new Set(jabatan.map((j) => j.organizationId))];
  if (organisasiSendiri.length === 0) {
    return { admin: false, tingkat: 0, organisasiSendiri: [], organisasiTerlihat: [] };
  }

  const tingkat = Math.max(...jabatan.map((j) => tingkatOrganisasi(j.kind)));

  // Semua organisasi, termasuk yang nonaktif: arsip lama tidak boleh hilang
  // dari pandangan pimpinan di atasnya hanya karena organisasinya dinonaktifkan.
  const semua = await prisma.organization.findMany({ select: { id: true, kind: true } });
  const tingkatLebihRendah = semua
    .filter((o) => tingkatOrganisasi(o.kind) < tingkat)
    .map((o) => o.id);

  return {
    admin: false,
    tingkat,
    organisasiSendiri,
    organisasiTerlihat: [...new Set([...organisasiSendiri, ...tingkatLebihRendah])],
  };
}

/**
 * Penyaring Prisma untuk daftar & hitungan arsip sesuai cakupan pengguna.
 * Gabungkan lewat `AND` agar tidak bertabrakan dengan penyaring lain.
 */
export function whereCakupanArsip(cakupan: CakupanArsip, userId: string): Prisma.DocumentWhereInput {
  if (cakupan.admin) return {};
  if (cakupan.organisasiTerlihat.length === 0) return { createdById: userId };
  return {
    OR: [{ organizationId: { in: cakupan.organisasiTerlihat } }, { createdById: userId }],
  };
}

/** Apakah satu dokumen tertentu boleh dilihat pengguna dengan cakupan ini. */
export function bolehLihatDokumen(
  cakupan: CakupanArsip,
  userId: string,
  dokumen: { organizationId: string | null; createdById: string }
): boolean {
  if (cakupan.admin) return true;
  if (dokumen.createdById === userId) return true;
  return Boolean(dokumen.organizationId) && cakupan.organisasiTerlihat.includes(dokumen.organizationId!);
}

/**
 * Pemilah surat masuk/keluar hanya untuk admin & superadmin. Pengurus lain
 * tetap melihat surat dalam cakupannya tanpa pilihan arah.
 */
export const bolehPilihArahSurat = (role: string | null | undefined): boolean =>
  isAdminRole(role);

/** Arah surat yang sah. */
export const ARAH_SURAT = ['MASUK', 'KELUAR'] as const;
export type ArahSurat = (typeof ARAH_SURAT)[number];

export const isArahSurat = (nilai: unknown): nilai is ArahSurat =>
  typeof nilai === 'string' && (ARAH_SURAT as readonly string[]).includes(nilai);
