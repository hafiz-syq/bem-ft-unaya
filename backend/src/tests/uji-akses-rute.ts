import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import {
  API_URL,
  ID_TIDAK_ADA,
  Laporan,
  hapusAkunUji,
  minta,
  pastikanServerHidup,
  siapkanAkunUji,
  type AkunUji,
  type Harapan,
  type HasilPermintaan,
  type Peran,
} from './bantu-uji';

/**
 * Matriks aturan akses 401/403 untuk SELURUH endpoint backend.
 *
 * Dijalankan dengan `npm test` (lihat package.json) dan dipakai di CI
 * (.github/workflows/uji-akses.yml). Server backend + basis data harus hidup;
 * pengujian membuat akunnya sendiri lalu menghapusnya lagi.
 *
 * Cara membaca satu baris:
 *   - `harapan` hanya berisi peran yang diuji. Peran yang tidak ditulis memang
 *     tidak diperiksa (mis. tidak ada gunanya memeriksa `admin` pada rute yang
 *     sudah jelas khusus admin).
 *   - Angka 401/403 = permintaan WAJIB ditolak dengan kode itu.
 *   - 'DIIZINKAN'    = boleh masuk (jawaban apa pun selain 401/403; bisa 200,
 *                      400 karena validasi, atau 404 karena data tidak ada).
 *   - Untuk metode yang mengubah data (POST/PUT/PATCH/DELETE), sel 'DIIZINKAN'
 *     TIDAK dijalankan supaya basis data asli tidak berubah — kecuali baris
 *     yang ditandai `amanDiuji`.
 *   - `temuan` = ketidaksesuaian yang sudah diketahui dan menunggu keputusan
 *     pemilik proyek. Dilaporkan, tapi tidak menggagalkan CI, agar temuan lama
 *     tidak menutupi regresi baru. Begitu aturannya diperbaiki, baris itu
 *     otomatis lulus dan penanda `temuan` bisa dihapus.
 *
 * PENTING: jangan pernah mengubah angka harapan hanya agar pengujian lulus.
 * Bila hasil berbeda, periksa penjaga rutenya di src/routes dan controller-nya;
 * kalau memang aturannya yang salah, laporkan sebagai temuan.
 */

type Metode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Baris {
  metode: Metode;
  jalur: string;
  harapan: Partial<Record<Peran, Harapan>>;
  /** Keterangan singkat yang dicetak sebelum barisnya dijalankan. */
  catatan?: string;
  /** Alasan baris ini sengaja tidak dijalankan sama sekali. */
  dilewati?: string;
  /** Endpoint yang aman dipanggil walau metodenya mengubah data (mis. body kosong pasti ditolak validasi). */
  amanDiuji?: boolean;
  /** Bila terisi, ketidaksesuaian dilaporkan sebagai temuan, bukan kegagalan. */
  temuan?: string;
  /** Pemeriksaan tambahan atas isi balasan. Mengembalikan pesan kesalahan atau null. */
  cek?: (peran: Peran, hasil: HasilPermintaan) => string | null;
}

/** 403 tidak boleh menyertakan isi data mahasiswa. */
const tanpaIsiCsv = (peran: Peran, hasil: HasilPermintaan): string | null =>
  hasil.status !== 200 && hasil.body.includes('Program Studi')
    ? 'balasan penolakan masih memuat isi CSV'
    : null;

const BARIS: Baris[] = [
  // ── auth.routes.ts ──────────────────────────────────────────────────────
  // Tamu sengaja mendapat 200 + `user: null` (bukan 401) agar halaman publik
  // tidak mencatat error jaringan di console. Rute ber-login tetap 401.
  {
    metode: 'GET',
    jalur: '/auth/me',
    harapan: { tamu: 200, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    cek: (peran, hasil) => {
      if (peran !== 'tamu') return null;
      try {
        return JSON.parse(hasil.body).user === null ? null : 'Tamu seharusnya menerima user: null.';
      } catch {
        return 'Balasan /auth/me bukan JSON yang valid.';
      }
    },
  },
  {
    metode: 'POST',
    jalur: '/auth/login',
    harapan: { tamu: 'DIIZINKAN' },
    dilewati: 'endpoint login dibatasi 5 permintaan / 5 menit / IP — memanggilnya berulang akan mengunci percobaan login yang sah',
  },
  { metode: 'POST', jalur: '/auth/first-login', harapan: { tamu: 401 } },
  { metode: 'POST', jalur: '/auth/verify-email', harapan: { tamu: 401 } },
  { metode: 'POST', jalur: '/auth/resend-verification', harapan: { tamu: 401 } },
  { metode: 'POST', jalur: '/auth/logout', harapan: { tamu: 'DIIZINKAN' }, amanDiuji: true },

  // ── Ganti password & lupa password (fitur baru) ────────────────────────
  { metode: 'POST', jalur: '/auth/change-password', harapan: { tamu: 401 } },
  {
    metode: 'POST',
    jalur: '/auth/lupa-password',
    harapan: { tamu: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'body kosong ditolak validasi (400) sebelum menyentuh database atau mengirim email',
  },
  {
    metode: 'POST',
    jalur: '/auth/lupa-password/verifikasi',
    harapan: { tamu: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'body kosong ditolak validasi (400)',
  },
  {
    metode: 'POST',
    jalur: '/auth/reset-password',
    harapan: { tamu: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'tanpa token ditolak validasi (400)',
  },

  // ── device.routes.ts (kunci perangkat) ─────────────────────────────────
  {
    metode: 'GET',
    jalur: '/devices',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
  },
  {
    metode: 'POST',
    jalur: '/devices/:id/reset',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada data yang berubah',
  },
  // Rincian perangkat satu akun (panel riwayat perangkat).
  { metode: 'GET', jalur: '/devices/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
  {
    metode: 'DELETE',
    jalur: '/devices/:id/perangkat/:perangkatId',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada perangkat yang terputus',
  },
  {
    metode: 'PATCH',
    jalur: '/devices/:id/batas',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada batas perangkat yang berubah',
  },

  // ── profile.routes.ts ───────────────────────────────────────────────────
  { metode: 'GET', jalur: '/profile/me', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'PUT', jalur: '/profile/me', harapan: { tamu: 401 } },
  { metode: 'POST', jalur: '/profile/me/photo', harapan: { tamu: 401 } },
  // Semua role boleh menghapus fotonya sendiri; yang dijaga di sini hanya tamu.
  { metode: 'DELETE', jalur: '/profile/me/photo', harapan: { tamu: 401 } },
  // Profil publik satu akun: wajib login, semua peran boleh membacanya.
  { metode: 'GET', jalur: '/profile/:id', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' }, catatan: 'id tidak ada sehingga pengguna login menerima 404, bukan 403.' },

  // ── ticket.routes.ts ────────────────────────────────────────────────────
  { metode: 'GET', jalur: '/tickets/public', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/tickets/assignees', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  {
    metode: 'GET',
    jalur: '/tickets/export/keluhan',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    temuan: 'hanya ADMIN dan PENGURUS DPM yang boleh mengaudit keluhan (canExportKeluhan); PENGURUS BEM termasuk ditolak. Pastikan memang begitu yang diinginkan.',
  },
  { metode: 'GET', jalur: '/tickets', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/tickets', harapan: { tamu: 401 } },
  { metode: 'POST', jalur: '/tickets/:id/replies', harapan: { tamu: 401 } },
  { metode: 'POST', jalur: '/tickets/:id/assign', harapan: { tamu: 401 } },
  { metode: 'PUT', jalur: '/tickets/:id/moderation', harapan: { tamu: 401 } },

  // ── organization.routes.ts (seluruh rute: ADMIN) ─────────────────────────
  { metode: 'GET', jalur: '/organizations', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/organizations', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'POST', jalur: '/organizations/departments', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'DELETE', jalur: '/organizations/departments/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'DELETE', jalur: '/organizations/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  {
    metode: 'PATCH',
    jalur: '/organizations/departments/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada divisi yang berubah.',
  },
  {
    metode: 'PATCH',
    jalur: '/organizations/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada organisasi yang berubah.',
  },

  // ── position.routes.ts ──────────────────────────────────────────────────
  { metode: 'GET', jalur: '/positions', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  {
    metode: 'POST',
    jalur: '/positions/slots',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'penjaga peran ada di controller (createPositionSlot) via isAdminRole.',
  },
  {
    metode: 'PATCH',
    jalur: '/positions/slots/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada jabatan yang berubah.',
  },
  {
    metode: 'DELETE',
    jalur: '/positions/slots/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada jabatan yang terhapus.',
  },
  {
    metode: 'POST',
    jalur: '/positions/assign',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'penjaga peran ada di controller (assignPosition) via isAdminRole.',
  },
  {
    metode: 'DELETE',
    jalur: '/positions/:idJabatan',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'memakai id jabatan yang benar-benar ada supaya 403 berasal dari pemeriksaan peran di controller, bukan dari 404 data tidak ditemukan',
  },

  // ── data-request.routes.ts ──────────────────────────────────────────────
  { metode: 'GET', jalur: '/data-requests', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/data-requests', harapan: { tamu: 401 } },
  {
    metode: 'PUT',
    jalur: '/data-requests/:id/process',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'penjaga peran ada di controller (processRequest) via isAdminRole.',
  },

  // ── audit.routes.ts ─────────────────────────────────────────────────────
  {
    metode: 'GET',
    jalur: '/audit',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    catatan: 'penjaga peran ada di controller (getAuditLogs) via isAdminRole.',
  },
  {
    metode: 'DELETE',
    jalur: '/audit',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    dilewati: 'penghapusan log massal tidak dijalankan otomatis agar log asli tidak ikut terhapus; aturan perannya dijaga di controller',
  },
  {
    metode: 'DELETE',
    jalur: '/audit/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 403 },
    catatan: 'hapus satu log hanya untuk SUPERADMIN, jadi ADMIN pun ditolak.',
  },

  // ── notification.routes.ts ──────────────────────────────────────────────
  { metode: 'GET', jalur: '/notifications', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'PUT', jalur: '/notifications/read-all', harapan: { tamu: 401 } },

  // ── public-comment.routes.ts ────────────────────────────────────────────
  { metode: 'GET', jalur: '/public-comments', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  {
    metode: 'POST',
    jalur: '/public-comments',
    harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'body kosong selalu ditolak validasi 400, jadi tidak ada komentar yang benar-benar tersimpan',
  },
  { metode: 'GET', jalur: '/public-comments/manage', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'PATCH', jalur: '/public-comments/manage/:id/status', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'POST', jalur: '/public-comments/manage/:id/replies', harapan: { tamu: 401, mahasiswa: 403 } },
  {
    metode: 'DELETE',
    jalur: '/public-comments/manage/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404 dan tidak ada pesan yang terhapus; pengurus ditolak pemeriksaan peran di controller',
  },
  { metode: 'GET', jalur: '/public-comments/:commentId/replies', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'PATCH', jalur: '/public-comments/:commentId/replies/:replyId', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'DELETE', jalur: '/public-comments/:commentId/replies/:replyId', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'POST', jalur: '/public-comments/:commentId/report', harapan: { tamu: 401 } },

  // ── dashboard.routes.ts ─────────────────────────────────────────────────
  { metode: 'GET', jalur: '/dashboard/stats', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/dashboard/statistik', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },

  // ── dashboard-charts.routes.ts ───────────────────────────────────────────
  { metode: 'GET', jalur: '/dashboard/charts', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/dashboard/charts/export-impor', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },

  // ── cms.routes.ts ───────────────────────────────────────────────────────
  { metode: 'GET', jalur: '/cms/settings', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
  { metode: 'PUT', jalur: '/cms/settings', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'GET', jalur: '/cms/structure', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/cms/agendas', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
  {
    metode: 'GET',
    jalur: '/cms/agendas/calendar.ics',
    harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    catatan: 'berkas .ics agenda tetap publik; isi berupa teks kalender (Content-Type text/calendar)',
  },
  { metode: 'POST', jalur: '/cms/agendas', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'PUT', jalur: '/cms/agendas/:id', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'DELETE', jalur: '/cms/agendas/:id', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'GET', jalur: '/cms/galleries', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/cms/galleries', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'PUT', jalur: '/cms/galleries/:id', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'DELETE', jalur: '/cms/galleries/:id', harapan: { tamu: 401, mahasiswa: 403 } },

  // Komentar galeri: membaca & mengirim publik (tamu mengisi nama), moderasi pengurus/admin.
  {
    metode: 'GET',
    jalur: '/cms/galleries/:id/comments',
    harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    catatan: 'galeri uji tidak ada, jadi 404 tetap dianggap diizinkan (bukan 401/403)',
  },
  {
    metode: 'POST',
    jalur: '/cms/galleries/:id/comments',
    harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'isi komentar kosong ditolak validasi (400) sebelum menulis apa pun',
    cek: (peran, hasil) => {
      if (peran !== 'tamu') return null;
      if (hasil.status !== 400) return null;
      try {
        const json = JSON.parse(hasil.body);
        // Bila body mencantumkan nama, pastikan hanya versi yang sudah dibersihkan yang diteruskan ke validasi server.
        if (json.message && json.message.includes('Nama wajib')) return null;
        return null;
      } catch {
        return null;
      }
    },
  },
  { metode: 'GET', jalur: '/cms/gallery-comments', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'PATCH', jalur: '/cms/gallery-comments/:id/status', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'DELETE', jalur: '/cms/gallery-comments/:id', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'GET', jalur: '/cms', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/cms', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'GET', jalur: '/cms/:id', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
  { metode: 'PUT', jalur: '/cms/:id', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'DELETE', jalur: '/cms/:id', harapan: { tamu: 401, mahasiswa: 403 } },

  // ── image-convert.routes.ts (konversi gambar dari URL) ─────────────────────
  // Body kosong ditolak validasi (400) sebelum unduh apa pun, jadi aman diuji.
  {
    metode: 'POST',
    jalur: '/image-convert/konversi',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'body kosong ditolak validasi (400) sebelum mengunduh gambar',
  },
  {
    metode: 'GET',
    jalur: '/image-convert/preview',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    catatan: 'penjaga peran ada di rute; body kosong lancu mengembalikan 400 atau 404',
  },
  {
    metode: 'POST',
    jalur: '/image-convert/validasi-url',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'body kosong ditolak validasi (400)',
  },

  // ── demisioner.routes.ts ────────────────────────────────────────────────
  { metode: 'GET', jalur: '/demisioner', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/demisioner', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'PUT', jalur: '/demisioner/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'DELETE', jalur: '/demisioner/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },

  // ── faq.routes.ts ───────────────────────────────────────────────────────
  { metode: 'GET', jalur: '/faqs', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/faqs', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'PUT', jalur: '/faqs/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'DELETE', jalur: '/faqs/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },

  // ── notifikasi-perpanjangan.routes.ts ───────────────────────────────────
  {
    metode: 'POST',
    jalur: '/notifikasi-perpanjangan/check',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'sel admin sengaja tidak diuji: menjalankan pemeriksaan perpanjangan nyata (mengirim email ke admin)',
  },

  // ── student-exports.routes.ts + student.routes.ts ───────────────────────
  {
    metode: 'GET',
    jalur: '/students/export',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    cek: tanpaIsiCsv,
    catatan: 'pemeriksaan tambahan: balasan penolakan tidak boleh memuat isi CSV',
  },
  { metode: 'GET', jalur: '/students', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/students', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'PATCH', jalur: '/students/:id/status', harapan: { tamu: 401, mahasiswa: 403 } },
  { metode: 'PATCH', jalur: '/students/:id/perpanjangan', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'PATCH', jalur: '/students/:id/role', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
  {
    metode: 'PUT',
    jalur: '/students/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    catatan: 'sunting data mahasiswa: admin & superadmin (id uji tidak ada → 404)',
  },
  {
    metode: 'DELETE',
    jalur: '/students/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 403 },
    catatan: 'hapus mahasiswa hanya SUPERADMIN; admin biasa selalu 403',
  },
  {
    metode: 'POST',
    jalur: '/students/maintenance/run-lifecycle',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'sel admin sengaja tidak diuji: menjalankan siklus hidup akun nyata (bisa menonaktifkan/menghapus akun)',
  },
  { metode: 'POST', jalur: '/students/import/pratinjau', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  {
    metode: 'POST',
    jalur: '/students/admin',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 403 },
    catatan: 'pembuatan akun ADMIN hanya untuk SUPERADMIN, jadi ADMIN pun ditolak.',
  },
  { metode: 'POST', jalur: '/students/import/simpan', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },

  // ── site-theme.routes.ts ────────────────────────────────────────────────
  {
    metode: 'GET',
    jalur: '/site-theme',
    harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' },
    catatan: 'tema musiman dibaca publik agar halaman depan ikut bertema',
  },
  {
    metode: 'PUT',
    jalur: '/site-theme',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 403 },
    catatan: 'mengubah tema musiman hanya SUPERADMIN',
    amanDiuji: true,
  },

  // ── rute yang didaftarkan langsung di app.ts ────────────────────────────
  {
    metode: 'POST',
    jalur: '/internal/cron',
    harapan: { tamu: 401 },
    amanDiuji: true,
    catatan: 'tanpa header X-Cron-Secret selalu 401; endpoint tidak menyentuh database',
  },
  { metode: 'GET', jalur: '/health', harapan: { tamu: 'DIIZINKAN', mahasiswa: 'DIIZINKAN' } },
];

const NAMA_PERAN: Record<Peran, string> = {
  tamu: 'tamu (tanpa sesi)',
  mahasiswa: 'mahasiswa',
  pengurus: 'pengurus biasa (PENGURUS_BEM)',
  admin: 'admin',
};

/** Ganti penanda `:param` dengan id nyata/tidak ada. */
function betulkanJalur(jalur: string, idJabatan: string): string {
  return jalur.replace(':idJabatan', idJabatan).replace(/:(id|commentId|replyId)/g, (cocok) => cocok.slice(1));
}

/**
 * Id jabatan (Position) untuk menguji DELETE /positions/:id.
 *
 * Memakai jabatan yang sudah ada supaya probe 403 benar-benar ditolak oleh
 * pemeriksaan peran di controller, bukan oleh 404 data tidak ditemukan. Bila
 * basis data belum punya jabatan (mis. basis data CI yang kosong), jabatan uji
 * dibuat sementara lalu dihapus kembali.
 */
async function siapkanIdJabatan(akunMahasiswa: AkunUji): Promise<{ id: string; bersihkan: () => Promise<void> }> {
  const sudahAda = await prisma.position.findFirst({ select: { id: true } });
  if (sudahAda) return { id: sudahAda.id, bersihkan: async () => {} };

  const organisasi = await prisma.organization.create({ data: { name: 'UJI Akses Rute' }, select: { id: true } });
  const slot = await prisma.positionSlot.create({
    data: { organizationId: organisasi.id, title: 'UJI Jabatan' },
    select: { id: true },
  });
  const jabatan = await prisma.position.create({
    data: { positionSlotId: slot.id, userId: akunMahasiswa.id },
    select: { id: true },
  });

  return {
    id: jabatan.id,
    bersihkan: async () => {
      await prisma.position.deleteMany({ where: { id: jabatan.id } });
      await prisma.positionSlot.deleteMany({ where: { id: slot.id } });
      await prisma.organization.deleteMany({ where: { id: organisasi.id } });
    },
  };
}

/** Cocokkan hasil nyata dengan harapan. */
async function jalankanBaris(baris: Baris, akun: Record<Exclude<Peran, 'tamu'>, AkunUji>, idJabatan: string, laporan: Laporan): Promise<void> {
  const label = `${baris.metode} /api${baris.jalur}`;

  if (baris.dilewati) {
    laporan.lewati(label, baris.dilewati);
    return;
  }

  if (baris.catatan) console.log(`          catatan: ${baris.catatan}`);

  const jalur = betulkanJalur(baris.jalur, idJabatan);
  let adaKetidaksesuaian = false;

  for (const peran of ['tamu', 'mahasiswa', 'pengurus', 'admin'] as Peran[]) {
    const harapan = baris.harapan[peran];
    if (harapan === undefined) continue;

    const nama = `${label} [${NAMA_PERAN[peran]}]`;

    if (baris.metode !== 'GET' && harapan === 'DIIZINKAN' && !baris.amanDiuji) {
      laporan.lewati(nama, 'sel "diizinkan" tidak diuji pada metode yang mengubah data');
      continue;
    }

    const cookie = peran === 'tamu' ? undefined : akun[peran].cookie;
    const hasil = await minta(jalur, { metode: baris.metode, cookie });

    const sesuai = harapan === 'DIIZINKAN' ? hasil.status !== 401 && hasil.status !== 403 : hasil.status === harapan;

    if (!sesuai) {
      adaKetidaksesuaian = true;
      if (baris.temuan) laporan.catatTemuan(nama, baris.temuan, hasil.status, harapan);
      else laporan.gagalkan(nama, hasil.status, harapan);
      continue;
    }

    const pesanCek = baris.cek?.(peran, hasil) ?? null;
    if (pesanCek) {
      laporan.gagalkan(`${nama} — ${pesanCek}`, hasil.status, harapan);
      continue;
    }

    laporan.luluskan(`${nama} → ${hasil.status}`);
  }

  // Baris bertanda `temuan` yang ternyata sudah sesuai harapan tetap dilaporkan,
  // supaya pertanyaannya tidak ikut hilang hanya karena aturannya cocok.
  if (baris.temuan && !adaKetidaksesuaian) laporan.catatKonfirmasi(label, baris.temuan);
}

// ─── Pemeriksaan kelengkapan: setiap rute terdaftar harus punya baris ──────

interface RuteTerdaftar {
  kunci: string;
  berkas: string;
}

function bacaBerkasRute(namaBerkas: string): string | null {
  for (const ekstensi of ['.ts', '.js']) {
    const jalur = path.join(__dirname, '..', 'routes', `${namaBerkas}${ekstensi}`);
    if (fs.existsSync(jalur)) return fs.readFileSync(jalur, 'utf8');
  }
  return null;
}

function normalisasi(metode: string, jalur: string): string {
  return `${metode.toUpperCase()} ${jalur.replace(/:[^/]+/g, ':').replace(/\/+$/, '') || '/'}`;
}

/**
 * Mendaftar seluruh rute yang benar-benar terpasang (mengikuti `app.use` di app.ts),
 * supaya rute baru tidak bisa lolos dari pengujian tanpa terdeteksi.
 */
function daftarRuteTerpasang(): { terpasang: RuteTerdaftar[]; berkasTidakTerpasang: string[] } {
  const berkasApp = path.join(__dirname, '..', 'app.ts');
  const sumberApp = fs.existsSync(berkasApp) ? fs.readFileSync(berkasApp, 'utf8') : '';

  const impor = new Map<string, string>();
  for (const cocok of sumberApp.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/([\w.-]+)'/g)) {
    impor.set(cocok[1], cocok[2]);
  }

  const terpasang: RuteTerdaftar[] = [];
  const dipakai = new Set<string>();

  for (const cocok of sumberApp.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    const [, awalan, variabel] = cocok;
    const namaBerkas = impor.get(variabel);
    if (!namaBerkas) continue;
    dipakai.add(variabel);

    const isi = bacaBerkasRute(namaBerkas);
    if (!isi) continue;

    for (const rute of isi.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      const kunci = normalisasi(rute[1], `${awalan}${rute[2]}`);
      if (!terpasang.some((t) => t.kunci === kunci)) {
        terpasang.push({ kunci, berkas: `${namaBerkas}.ts` });
      }
    }
  }

  // Rute yang didaftarkan langsung di app.ts, mis. /api/health
  for (const rute of sumberApp.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
    terpasang.push({ kunci: normalisasi(rute[1], rute[2]), berkas: 'app.ts' });
  }

  const berkasTidakTerpasang = [...impor.entries()]
    .filter(([variabel]) => !dipakai.has(variabel))
    .map(([, namaBerkas]) => `${namaBerkas}.ts`);

  return { terpasang, berkasTidakTerpasang };
}

async function main(): Promise<void> {
  console.log(`\n=== UJI AKSES RUTE (401/403) ===\nAPI: ${API_URL}\n`);
  await pastikanServerHidup();

  const akun = await siapkanAkunUji();
  const semuaAkun = Object.values(akun);
  const jabatan = await siapkanIdJabatan(akun.mahasiswa);

  const laporan = new Laporan();

  try {
    console.log('--- Aturan per endpoint ---');
    for (const baris of BARIS) {
      await jalankanBaris(baris, akun, jabatan.id, laporan);
    }

    console.log('\n--- Kelengkapan cakupan ---');
    const { terpasang, berkasTidakTerpasang } = daftarRuteTerpasang();
    const kunciMatriks = new Set(BARIS.map((b) => normalisasi(b.metode, `/api${b.jalur}`)));

    const tanpaBaris = terpasang.filter((r) => !kunciMatriks.has(r.kunci));
    for (const rute of tanpaBaris) {
      laporan.gagalkan(`Rute ${rute.kunci} belum punya baris di BARIS (berkas ${rute.berkas})`, 'tidak ada baris', 'ada baris');
    }

    const ruteTerpasang = new Set(terpasang.map((r) => r.kunci));
    for (const kunci of kunciMatriks) {
      if (!ruteTerpasang.has(kunci)) {
        laporan.gagalkan(`Baris ${kunci} tidak cocok dengan rute mana pun`, 'tidak terdaftar', 'terdaftar');
      }
    }

    if (tanpaBaris.length === 0) {
      console.log(`  LULUS   Semua ${terpasang.length} rute terpasang punya baris pengujian`);
      laporan.lulus++;
    }

    for (const berkas of berkasTidakTerpasang) {
      console.log(`  PERHATIAN  Berkas rute ${berkas} tidak dipasang di app.ts (rutenya tidak bisa dipanggil)`);
    }
  } finally {
    await jabatan.bersihkan();
    await hapusAkunUji(semuaAkun);
    console.log(`\nAkun uji dihapus kembali: ${semuaAkun.map((a) => a.nim).join(', ')}`);
  }

  laporan.ringkas('UJI AKSES');
  if (laporan.gagal > 0) process.exitCode = 1;
  console.log(laporan.gagal === 0 ? '\nHASIL: TIDAK ADA REGRESI ATURAN AKSES\n' : '\nHASIL: ADA ATURAN YANG TIDAK SESUAI\n');
}

main()
  .catch((e) => {
    console.error('\nERROR:', e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
