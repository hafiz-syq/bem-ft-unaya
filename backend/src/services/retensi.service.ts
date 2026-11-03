import prisma from '../lib/prisma';

/**
 * Retensi baris log & jejak tamu.
 *
 * Tabel di bawah hanya bertambah — tidak ada satu pun jalur lain yang
 * menghapusnya — sehingga suatu hari penuh dan memperlambat setiap baca.
 * Memangkas AuditLog berarti memusnahkan catatan kepatuhan, jadi seluruh
 * langkah di file ini berhenti di belakang RETENSI_AKTIF=1 dan angka
 * ambangnya masih usulan yang harus disetujui pemilik produk sebelum
 * penghapusan permanen dinyalakan di mana pun.
 */
export const HARI_NOTIFIKASI = 180;
export const HARI_AUDIT = 365;
export const HARI_ERROR_LOG = 90;
export const HARI_PESAN_CHAT = 365;
export const HARI_JEJAK_TAMU = 365;

// shortcut: satu batch per tabel per jalan cron; kalau baris tertinggal lebih
// banyak, ia menyusut beberapa hari berikutnya. Menaikkan level = loop sampai
// nol baris terhapus bila suatu tabel perlu dikosongkan cepat.
const BATCH = 5000;

export type HasilRetensi = {
  aktif: boolean;
  notifikasi: number;
  auditLog: number;
  errorLog: number;
  pesanChat: number;
  jejakTamu: number;
};

const tanggalBatas = (hari: number) => new Date(Date.now() - hari * 86_400_000);

const retensiAktif = () => (process.env.RETENSI_AKTIF || '').trim() === '1';

export async function pangkasRetensi(): Promise<HasilRetensi> {
  if (!retensiAktif()) {
    return { aktif: false, notifikasi: 0, auditLog: 0, errorLog: 0, pesanChat: 0, jejakTamu: 0 };
  }

  // DELETE ... LIMIT: MySQL tidak memberi Prisma "take" pada deleteMany, dan
  // tanpa batas sebuah cron bisa mengunci tabel melewati timeout function.
  const notifikasi = await prisma.$executeRaw`
    DELETE FROM Notification WHERE createdAt < ${tanggalBatas(HARI_NOTIFIKASI)} LIMIT ${BATCH}`;
  const auditLog = await prisma.$executeRaw`
    DELETE FROM AuditLog WHERE createdAt < ${tanggalBatas(HARI_AUDIT)} LIMIT ${BATCH}`;
  const errorLog = await prisma.$executeRaw`
    DELETE FROM ErrorLog WHERE createdAt < ${tanggalBatas(HARI_ERROR_LOG)} LIMIT ${BATCH}`;
  const pesanChat = await prisma.$executeRaw`
    DELETE FROM ChatMessage WHERE createdAt < ${tanggalBatas(HARI_PESAN_CHAT)} LIMIT ${BATCH}`;

  // Jejak tamu bukan dihapus barisnya, hanya PII-nya: komentarnya tetap ada
  // supaya riwayat moderasi tidak kehilangan konteks.
  const jejakTamu = await prisma.$executeRaw`
    UPDATE GalleryComment SET guestIp = NULL, guestUserAgent = NULL
    WHERE createdAt < ${tanggalBatas(HARI_JEJAK_TAMU)} AND guestIp IS NOT NULL LIMIT ${BATCH}`;

  return { aktif: true, notifikasi, auditLog, errorLog, pesanChat, jejakTamu };
}
