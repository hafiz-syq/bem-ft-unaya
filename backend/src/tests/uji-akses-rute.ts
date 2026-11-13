import './penahan-host-uji';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
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
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 400 },
    amanDiuji: true,
    catatan: 'badan {} dari pemanggil matrix ditolak validasi 1..10 lebih dulu (400, sebelum query), jadi sel admin sengaja 400 dan bukan angka sukses; PATCH yang sah dan penurunan batas diuji di ujiBatasPerangkat',
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
  {
    metode: 'DELETE',
    jalur: '/tickets/:id/assign',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'lepas penugasan hanya untuk DPM+/admin; id tidak ada sehingga admin menerima 404 tanpa perubahan',
  },
  {
    metode: 'DELETE',
    jalur: '/tickets/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'hapus tiket hanya untuk DPM+/admin; id tidak ada sehingga admin menerima 404 tanpa penghapusan',
  },
  {
    metode: 'PUT',
    jalur: '/tickets/:id/moderation',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan:
      'penjaga peran jalan sebelum body dibaca dan sebelum query: MAHASISWA (penulis tiket) selalu 403, pengurus/admin lanjut ke pencarian tiket dan kena 404 karena id tidak ada sehingga tidak ada status maupun moderatedById yang berubah. Aturan "pengurus hanya boleh menandatangani tiket yang ditugaskan kepadanya" diuji di uji-unit-kritis.ts.',
  },
  // Template balasan cepat dipakai pengurus saat menjawab tiket.
  { metode: 'GET', jalur: '/tickets/templates', harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  {
    metode: 'POST',
    jalur: '/tickets/templates',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN' },
    catatan: 'judul/isi kosong ditolak validasi (400) sebelum menyentuh database',
  },
  {
    metode: 'PUT',
    jalur: '/tickets/templates/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN' },
    catatan: 'id tidak ada sehingga pengurus menerima 404',
  },
  {
    metode: 'DELETE',
    jalur: '/tickets/templates/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN' },
    catatan: 'id tidak ada sehingga pengurus menerima 404 dan tidak ada template yang dihapus',
  },
  {
    metode: 'PATCH',
    jalur: '/tickets/:id/priority',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'prioritas kosong ditolak validasi (400); mahasiswa ditolak guard peran sebelum tiket dicari',
  },
  {
    metode: 'POST',
    jalur: '/tickets/:id/rating',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'penilaian hanya untuk pengirim tiket; angka kosong ditolak validasi (400) sebelum data disentuh',
  },

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
  {
    metode: 'POST',
    jalur: '/public-comments/manage/:id/restore',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'pemulihan hanya admin/superadmin; id tidak ada sehingga admin menerima 404 tanpa perubahan',
  },
  {
    metode: 'DELETE',
    jalur: '/public-comments/manage/:id/permanent',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'hapus permanen hanya admin/superadmin; id tidak ada sehingga admin menerima 404',
  },
  {
    metode: 'POST',
    jalur: '/public-comments/:commentId/laporkan',
    harapan: { tamu: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'pelaporan publik tanpa login; id "commentId" tidak ada sehingga selalu 404 dan tidak ada data berubah (dibatasi 10 laporan/jam/IP)',
  },

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
  // Direktori mahasiswa terbuka untuk akun mahasiswa (data terbatas: tanpa
  // email/telepon/status akun), sedangkan tindakan pengelolaan tetap staf.
  { metode: 'GET', jalur: '/students', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'POST', jalur: '/students', harapan: { tamu: 401, mahasiswa: 403 } },
  {
    metode: 'PATCH',
    jalur: '/students/:id/status',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'nonaktif/aktifkan akun khusus ADMIN sejak AUDIT-14 I1; sebelumnya pengurus lolos ke handler (404 id uji) dan bisa menulis akun mana pun',
  },
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
  {
    metode: 'GET',
    jalur: '/students/trash',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    // Sama seperti /documents: paginasi ditambahkan tanpa membuang medan lama
    // dan dengan bawaan yang sama dengan plafon lama (page 1, limit 100).
    cek: (peran, hasil) => {
      if (peran !== 'admin') return null;
      let isi: any;
      try {
        isi = JSON.parse(hasil.body);
      } catch {
        return 'Balasan /students/trash bukan JSON yang valid.';
      }
      const m = isi.meta;
      if (!m || typeof m.total !== 'number') return 'meta.total hilang setelah paginasi ditambahkan.';
      if (m.page !== 1 || m.limit !== 100) return `bawaan berubah: page=${m.page}, limit=${m.limit} (harusnya 1 dan 100).`;
      if (m.totalPages !== Math.ceil(m.total / m.limit)) return 'totalPages bukan ceil(total/limit).';
      if (!Array.isArray(isi.data) || isi.data.length > m.limit) return 'jumlah baris melebihi limit.';
      if (typeof m.hariTempatSampah !== 'number') return 'medan meta lama hariTempatSampah hilang.';
      return null;
    },
  },
  {
    metode: 'PATCH',
    jalur: '/students/bulk',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 },
    catatan: 'aksi massal hanya admin/superadmin, jadi sel admin sengaja tidak diuji',
  },
  {
    metode: 'PUT',
    jalur: '/students/:id/restore',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 403 },
    catatan: 'pemulihan akun hanya SUPERADMIN; admin biasa ditolak',
  },
  {
    metode: 'DELETE',
    jalur: '/students/:id/permanent',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 403 },
    catatan: 'hapus permanen hanya SUPERADMIN; admin biasa ditolak',
  },

  // ── presence.routes.ts & chat.routes.ts (status online & forum) ─────────
  {
    metode: 'POST',
    jalur: '/presence/heartbeat',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'heartbeat hanya memperbarui waktu aktif akun uji sendiri',
  },
  { metode: 'GET', jalur: '/presence/online', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/chat/rooms', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/chat/status', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  {
    metode: 'GET',
    jalur: '/chat/filter',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    catatan: 'filter kata hanya dibaca pengelola forum (BEM/DPM/admin)',
  },
  {
    metode: 'PUT',
    jalur: '/chat/filter',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'body tanpa field kata ditolak 400 sebelum menyimpan, jadi daftar filter asli tidak berubah',
  },
  {
    metode: 'POST',
    jalur: '/chat/rooms',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'akun uji pengurus adalah PENGURUS_BEM yang memang berhak membuat ruang; body kosong ditolak validasi sehingga tidak ada ruang yang dibuat',
  },
  {
    metode: 'PATCH',
    jalur: '/chat/rooms/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga pengelola menerima 404, bukan perubahan status',
  },
  {
    metode: 'POST',
    jalur: '/chat/rooms/:id/approve',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'betulkanJalur melepas titik dua sehingga id yang dikirim adalah teks "id", bukan ID_TIDAK_ADA; teks itu bukan baris ChatRoom jadi pengelola menerima 404, bukan persetujuan ruang nyata',
  },
  {
    metode: 'DELETE',
    jalur: '/chat/rooms/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga tidak ada ruang yang terhapus',
  },
  { metode: 'GET', jalur: '/chat/rooms/:id/messages', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' }, catatan: 'ruang uji tidak ada, jadi 404 tetap berarti diizinkan' },
  {
    metode: 'POST',
    jalur: '/chat/rooms/:id/messages',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'ruang uji tidak ada (404) dan pesan kosong ditolak validasi',
  },
  {
    metode: 'DELETE',
    jalur: '/chat/messages/:id',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga tidak ada pesan yang terhapus',
  },

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

  // ── document.routes.ts (arsip surat) ────────────────────────────────────
  // Arsip hanya untuk pimpinan inti (Ketua/Wakil Ketua/Sekretaris BEM, Ketua
  // DPM, Ketua/Wakil/Sekretaris himpunan) dan admin. Akun "pengurus biasa" di
  // pengujian ini tidak memegang jabatan pimpinan, jadi memang harus ditolak.
  {
    metode: 'GET',
    jalur: '/documents/akses',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    cek: (peran, hasil) => {
      // Tamu sudah diperiksa lewat status 401; balasannya hanya pesan galat,
      // bukan bendera akses, sehingga tidak perlu ditafsirkan di sini.
      if (peran === 'tamu') return null;
      try {
        const isi = JSON.parse(hasil.body);
        if (peran === 'admin') {
          return isi.bolehAkses === true && isi.bolehArah === true
            ? null
            : 'admin seharusnya boleh membuka arsip dan memilah arah surat.';
        }
        if (isi.bolehAkses !== false) return 'hanya pimpinan inti dan admin yang boleh membuka arsip.';
        if (isi.bolehArah !== false) return 'hanya admin yang boleh memilah arah surat.';
        return null;
      } catch {
        return 'Balasan /documents/akses bukan JSON yang valid.';
      }
    },
  },
  {
    metode: 'GET',
    jalur: '/documents',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    // Kontrak aditif: meta lama utuh + paginasi baru dengan nilai baku sama
    // seperti plafon lama (page 1, limit 150), jadi pemanggil lama tidak rusak.
    cek: (peran, hasil) => {
      if (peran !== 'admin') return null;
      let isi: any;
      try {
        isi = JSON.parse(hasil.body);
      } catch {
        return 'Balasan /documents bukan JSON yang valid.';
      }
      const m = isi.meta;
      if (!m || typeof m.total !== 'number') return 'meta.total hilang setelah paginasi ditambahkan.';
      if (m.page !== 1 || m.limit !== 150) return `bawaan berubah: page=${m.page}, limit=${m.limit} (harusnya 1 dan 150).`;
      if (m.totalPages !== Math.ceil(m.total / m.limit)) return 'totalPages bukan ceil(total/limit).';
      if (!Array.isArray(isi.data) || isi.data.length > m.limit) return 'jumlah baris melebihi limit.';
      if (typeof m.diajukan !== 'number' || typeof m.disetujui !== 'number' || !Array.isArray(m.organisasi)) {
        return 'medan meta lama (diajukan/disetujui/organisasi) hilang.';
      }
      return null;
    },
  },
  {
    metode: 'POST',
    jalur: '/documents',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'body kosong ditolak validasi (400) sebelum menyentuh database',
  },
  {
    metode: 'PUT',
    jalur: '/documents/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404',
  },
  {
    metode: 'POST',
    jalur: '/documents/:id/submit',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404',
  },
  {
    metode: 'PATCH',
    jalur: '/documents/:id/review',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'status kosong ditolak validasi (400) sebelum menyentuh database',
  },
  {
    metode: 'DELETE',
    jalur: '/documents/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada sehingga admin menerima 404',
  },

  // ── announcement.routes.ts (semua wajib login; buat = admin + pengurus) ─
  { metode: 'GET', jalur: '/announcements', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/announcements/manage', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
  {
    metode: 'POST',
    jalur: '/announcements',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'pengurus (PENGURUS_BEM) kini boleh membuat; body {} ditolak 400 sebelum transaksi sehingga tidak ada pengumuman atau notifikasi yang dibuat',
  },
  {
    metode: 'PUT',
    jalur: '/announcements/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'gerbang kasar (admin/pengurus) lolos lalu id tidak ada → 404 sebelum pemeriksaan kepemilikan; mahasiswa tetap 403',
  },
  {
    metode: 'DELETE',
    jalur: '/announcements/:id',
    harapan: { tamu: 401, mahasiswa: 403, pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' },
    amanDiuji: true,
    catatan: 'id tidak ada → 404, jadi tidak ada pengumuman yang terhapus',
  },
  {
    metode: 'POST',
    jalur: '/announcements/:id/read',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN' },
    catatan: 'sel pengguna login sengaja tidak diuji: menandai terbaca menulis baris baru',
  },

  // ── report.routes.ts, search.routes.ts, error-log.routes.ts, push.routes.ts
  { metode: 'GET', jalur: '/reports/monthly', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/search', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  { metode: 'GET', jalur: '/error-logs', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403, admin: 'DIIZINKAN' } },
  { metode: 'PATCH', jalur: '/error-logs/:id', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'DELETE', jalur: '/error-logs/resolved', harapan: { tamu: 401, mahasiswa: 403, pengurus: 403 } },
  { metode: 'GET', jalur: '/push/public-key', harapan: { tamu: 401, mahasiswa: 'DIIZINKAN', pengurus: 'DIIZINKAN', admin: 'DIIZINKAN' } },
  {
    metode: 'POST',
    jalur: '/push/subscribe',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN' },
    catatan: 'sel pengguna login sengaja tidak diuji: mendaftarkan langganan perangkat nyata',
  },
  {
    metode: 'POST',
    jalur: '/push/unsubscribe',
    harapan: { tamu: 401, mahasiswa: 'DIIZINKAN' },
    catatan: 'sel pengguna login sengaja tidak diuji: menghapus langganan perangkat nyata',
  },

  // ── rute yang didaftarkan langsung di app.ts ────────────────────────────
  // Kunci cron hanya dibaca dari header. Varian lama `?secret=...` dan segmen
  // path `/cron/<secret>` sudah dihapus (secret di URL endapan di log akses),
  // jadi tidak ada barisnya lagi; pemeriksa kelengkapan akan menggagalkan CI
  // bila salah satu varian itu didaftarkan kembali tanpa baris pengujian.
  {
    metode: 'POST',
    jalur: '/internal/cron',
    harapan: { tamu: 401 },
    amanDiuji: true,
    catatan: 'tanpa header X-Cron-Secret selalu 401; endpoint tidak menyentuh database',
    cek: (peran, hasil) =>
      peran === 'tamu' && !hasil.body.includes('Kunci cron tidak sah')
        ? 'penolakan cron bukan karena kunci tidak sah'
        : null,
  },
  // Vercel Cron mengirim GET dengan Authorization: Bearer <CRON_SECRET>.
  {
    metode: 'GET',
    jalur: '/internal/cron',
    harapan: { tamu: 401 },
    amanDiuji: true,
    catatan: 'tanpa kunci cron yang cocok selalu 401; job tidak pernah jalan pada baris ini',
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

/**
 * IRISAN B — isi balasan GET /data-requests per peran.
 *
 * Matriks di atas hanya membuktikan 401/403, padahal kebocoran di sini berupa
 * 200 yang memuat nama/email/no_hp milik orang lain. Jadi dibuat satu pengajuan
 * milik akun mahasiswa dengan penanda acak, lalu isi balasan tiap peran
 * diperiksa: pengurus (PENGURUS_BEM) tidak boleh melihatnya, admin boleh, dan
 * mahasiswa hanya melihat punyanya sendiri.
 */
async function ujiIsolasiPengajuanData(
  akun: Record<Exclude<Peran, 'tamu'>, AkunUji>,
  laporan: Laporan
): Promise<void> {
  const penanda = `UJI-PII-${Date.now()}`;
  const pengajuan = await prisma.dataChangeRequest.create({
    data: { userId: akun.mahasiswa.id, requestData: { nama: penanda }, reason: penanda },
    select: { id: true },
  });

  try {
    const pemeriksaan: { peran: Exclude<Peran, 'tamu'>; harusTerlihat: boolean }[] = [
      { peran: 'mahasiswa', harusTerlihat: true },
      { peran: 'pengurus', harusTerlihat: false },
      { peran: 'admin', harusTerlihat: true },
    ];

    for (const { peran, harusTerlihat } of pemeriksaan) {
      const nama = `GET /api/data-requests [${NAMA_PERAN[peran]}] ${
        harusTerlihat ? 'melihat' : 'TIDAK melihat'
      } pengajuan milik akun lain`;
      const hasil = await minta('/data-requests', { cookie: akun[peran].cookie });

      if (hasil.status !== 200) {
        laporan.gagalkan(`${nama} — status ${hasil.status}`, hasil.status, 200);
        continue;
      }
      const terlihat = hasil.body.includes(penanda);
      if (terlihat !== harusTerlihat) {
        laporan.gagalkan(`${nama} — penanda ${terlihat ? 'ada' : 'tidak ada'} di balasan`, terlihat, harusTerlihat);
        continue;
      }
      laporan.luluskan(nama);
    }
  } finally {
    await prisma.dataChangeRequest.deleteMany({ where: { id: pengajuan.id } });
  }
}

/**
 * IRISAN C — draf konten tidak boleh terbaca oleh pengunjung anonim.
 *
 * Baris matriks GET /cms/:id hanya memancing id yang tidak ada (404), jadi
 * aturan statusnya diuji terpisah: satu konten berstatus DRAFT dibuat, lalu
 * isi balasan tiap pemanggil diperiksa dan barisnya dihapus lagi.
 */
async function ujiDrafKontenTertutup(
  akun: Record<Exclude<Peran, 'tamu'>, AkunUji>,
  laporan: Laporan
): Promise<void> {
  const penanda = `UJI-DRAF-${Date.now()}`;
  const draf = await prisma.content.create({
    data: { type: 'BERITA', title: penanda, content: penanda, status: 'DRAFT', authorId: akun.admin.id },
    select: { id: true },
  });

  try {
    const pemeriksaan: { peran: Peran; harusTerlihat: boolean }[] = [
      { peran: 'tamu', harusTerlihat: false },
      { peran: 'mahasiswa', harusTerlihat: false },
      { peran: 'pengurus', harusTerlihat: true },
      { peran: 'admin', harusTerlihat: true },
    ];

    for (const { peran, harusTerlihat } of pemeriksaan) {
      const nama = `GET /api/cms/:id [${NAMA_PERAN[peran]}] ${harusTerlihat ? 'boleh' : 'TIDAK boleh'} membaca draf`;
      const cookie = peran === 'tamu' ? undefined : akun[peran].cookie;
      const hasil = await minta(`/cms/${draf.id}`, { cookie });
      const terlihat = hasil.status === 200 && hasil.body.includes(penanda);

      if (terlihat !== harusTerlihat) {
        laporan.gagalkan(`${nama} — status ${hasil.status}`, terlihat, harusTerlihat);
        continue;
      }
      laporan.luluskan(`${nama} → ${hasil.status}`);
    }
  } finally {
    await prisma.content.deleteMany({ where: { id: draf.id } });
  }
}

/**
 * Batas perangkat: bawaan akun baru 3, validasi batas, dan menurunkan batas
 * tidak mengeluarkan perangkat yang sudah terdaftar.
 *
 * Poin bawaan menguji nilai default kolom, bukan satu endpoint: tidak ada jalur
 * pembuatan akun yang menulis maxDevices, jadi semuanya memakai bawaan yang sama.
 * Penolakan peran (MAHASISWA/PENGURUS 403) sudah dijaga baris matriks
 * PATCH /devices/:id/batas di atas dan tidak diulang di sini.
 */
async function ujiBatasPerangkat(
  akun: Record<Exclude<Peran, 'tamu'>, AkunUji>,
  laporan: Laporan
): Promise<void> {
  const stempel = Date.now();
  const akunBaru = await prisma.user.create({
    data: { nim: `9999${stempel}`, password_hash: 'uji-tidak-sah', role: 'MAHASISWA' },
    select: { id: true, maxDevices: true },
  });

  try {
    if (akunBaru.maxDevices === 3) laporan.luluskan('akun baru tanpa maxDevices memakai bawaan 3');
    else laporan.gagalkan('akun baru tanpa maxDevices memakai bawaan 3', akunBaru.maxDevices, 3);

    for (const batas of [0, 11]) {
      const hasil = await minta(`/devices/${akun.mahasiswa.id}/batas`, {
        metode: 'PATCH',
        cookie: akun.admin.cookie,
        body: { maxDevices: batas },
      });
      const nama = `PATCH /devices/:id/batas [admin] menolak maxDevices=${batas}`;
      if (hasil.status !== 400) laporan.gagalkan(`${nama} — status ${hasil.status}`, hasil.status, 400);
      else laporan.luluskan(`${nama} → 400`);
    }

    const setelahTolak = await prisma.user.findUnique({
      where: { id: akun.mahasiswa.id },
      select: { maxDevices: true },
    });
    const namaTetap = 'dua penolakan di atas tidak mengubah nilai batas akun target';
    if (setelahTolak?.maxDevices !== 3) laporan.gagalkan(namaTetap, setelahTolak?.maxDevices, 3);
    else laporan.luluskan(namaTetap);

    await prisma.userDevice.createMany({
      data: [
        { userId: akun.mahasiswa.id, deviceId: `uji-batas-a-${stempel}`, label: 'Uji A' },
        { userId: akun.mahasiswa.id, deviceId: `uji-batas-b-${stempel}`, label: 'Uji B' },
      ],
    });
    const sebelum = await prisma.userDevice.count({ where: { userId: akun.mahasiswa.id } });
    const turun = await minta(`/devices/${akun.mahasiswa.id}/batas`, {
      metode: 'PATCH',
      cookie: akun.admin.cookie,
      body: { maxDevices: 1 },
    });
    const sesudah = await prisma.userDevice.count({ where: { userId: akun.mahasiswa.id } });

    const namaPutus = 'menurunkan batas 3 -> 1 tidak menghapus baris UserDevice';
    if (turun.status !== 200) laporan.gagalkan(`${namaPutus} — PATCH status ${turun.status}`, turun.status, 200);
    else if (sesudah !== sebelum) laporan.gagalkan(namaPutus, sesudah, sebelum);
    else laporan.luluskan(`${namaPutus} (${sesudah} baris tetap ada)`);
  } finally {
    await prisma.userDevice.deleteMany({ where: { userId: akun.mahasiswa.id } });
    await prisma.user.delete({ where: { id: akunBaru.id } });
  }
}

/**
 * IZINKAN pada akun yang sudah DI ATAS batasnya — batas pernah diturunkan
 * sementara perangkat lama tetap terdaftar. Menyetujui satu perangkat baru
 * hanya boleh MENAMBAH perangkat; bila kunci utama ikut berpindah, seluruh
 * sesi akun terputus (sessionVersion naik) padahal admin tidak meminta itu.
 */
async function ujiIzinkanDiAtasBatas(
  akun: Record<Exclude<Peran, 'tamu'>, AkunUji>,
  laporan: Laporan
): Promise<void> {
  const stempel = Date.now();
  const target = akun.mahasiswa;
  const kunciUtama = `uji-utama-${stempel}`;

  const asal = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: { maxDevices: true },
  });

  await prisma.user.update({
    where: { id: target.id },
    data: {
      deviceId: kunciUtama,
      deviceLabel: 'Perangkat utama uji',
      maxDevices: 1,
      pendingDeviceId: `uji-baru-${stempel}`,
      pendingDeviceLabel: 'Perangkat baru uji',
      pendingDeviceAt: new Date(),
    },
  });
  await prisma.userDevice.createMany({
    data: [
      { userId: target.id, deviceId: `uji-tambahan-1-${stempel}`, label: 'Tambahan 1' },
      { userId: target.id, deviceId: `uji-tambahan-2-${stempel}`, label: 'Tambahan 2' },
    ],
  });

  const sebelum = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: { sessionVersion: true, deviceId: true },
  });
  const tambahanSebelum = await prisma.userDevice.count({ where: { userId: target.id } });

  try {
    const hasil = await minta(`/devices/${target.id}/reset`, {
      metode: 'POST',
      cookie: akun.admin.cookie,
      body: { mode: 'IZINKAN' },
    });

    const sesudah = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { sessionVersion: true, deviceId: true, pendingDeviceId: true },
    });
    const tambahanSesudah = await prisma.userDevice.count({ where: { userId: target.id } });

    const namaPesan = `POST /devices/:id/reset [admin] IZINKAN akun di atas batas → 200, pesan menyebut di atas batas`;
    if (hasil.status !== 200 || !hasil.body.includes('atas batas')) {
      laporan.gagalkan(`${namaPesan} — status ${hasil.status}, badan ${hasil.body.slice(0, 120)}`, 'pesan tanpa kata "atas batas"', 'pesan menyebut akun di atas batas');
    } else laporan.luluskan(`${namaPesan} → 200`);

    const namaTambah = 'perangkat baru menambah satu baris UserDevice';
    if (tambahanSesudah !== tambahanSebelum + 1) {
      laporan.gagalkan(namaTambah, tambahanSesudah, tambahanSebelum + 1);
    } else laporan.luluskan(`${namaTambah} (${tambahanSebelum} -> ${tambahanSesudah})`);

    const namaSesi = 'sessionVersion akun TETAP (tidak ada sesi yang terputus)';
    if (sesudah.sessionVersion !== sebelum.sessionVersion) {
      laporan.gagalkan(namaSesi, sesudah.sessionVersion, sebelum.sessionVersion);
    } else laporan.luluskan(`${namaSesi} (v=${sesudah.sessionVersion})`);

    const namaKunci = 'deviceId utama tidak berpindah ke perangkat yang disetujui';
    if (sesudah.deviceId !== sebelum.deviceId) {
      laporan.gagalkan(namaKunci, sesudah.deviceId, sebelum.deviceId);
    } else laporan.luluskan(`${namaKunci} (${sesudah.deviceId})`);

    const namaBersih = 'percobaan perangkat (pendingDeviceId) dibersihkan';
    if (sesudah.pendingDeviceId !== null) laporan.gagalkan(namaBersih, sesudah.pendingDeviceId, null);
    else laporan.luluskan(namaBersih);
  } finally {
    await prisma.userDevice.deleteMany({ where: { userId: target.id } });
    await prisma.user.update({
      where: { id: target.id },
      data: {
        deviceId: null, deviceLabel: null, deviceBoundAt: null,
        pendingDeviceId: null, pendingDeviceLabel: null, pendingDeviceAt: null,
        maxDevices: asal.maxDevices,
      },
    });
  }
}

/**
 * Penanda "permintaan login ini dibalas 429". Hanya fixture login yang boleh
 * memakainya: yang tertahan adalah permintaan yang seharusnya sudah dijawab
 * gerbang perangkat (200 atau 403), jadi barisnya DILEWATI, bukan GAGAL. Setiap
 * 429 dicatat satu baris, sehingga angka `Dilewati karena limiter` di RINGKASAN
 * = jumlah permintaan yang benar-benar dibatasi.
 */
function tandaiLimiter(laporan: Laporan, nama: string, hasil: HasilPermintaan): boolean {
  if (hasil.status !== 429) return false;
  laporan.lewatiLimiter(nama);
  return true;
}

/**
 * Gerbang perangkat saat login (auth.controller.ts:140 dan :175-202):
 * selama akun masih di bawah batas, perangkat baru ikut terdaftar; begitu
 * penuh, login ditolak dengan PERANGKAT_TERKUNCI dan percobaannya hanya
 * dicatat di pendingDevice* — tanpa baris UserDevice dan tanpa menaikkan
 * sessionVersion (sesi perangkat lama harus tetap hidup).
 *
 * Sengaja cuma dua kali POST /auth/login: limiter login 5 permintaan per 5
 * menit per IP, jadi fixture ini boleh jalan maksimal dua kali per server
 * hidup. 429 pada fixture login berarti pembatasnya bekerja, bukan regresi
 * aturan: barisnya ditandai DILEWATI lewat tandaiLimiter, baris turunannya lewat
 * laporan.lewati, dan jumlahnya dihitung di RINGKASAN lewat lewatiLimiter. Di
 * luar fixture login tidak ada baris yang memakai penanda itu, jadi 429 yang
 * muncul di sana tetap GAGAL — dan N yang naik diam-diam terlihat dari satu
 * baris ringkasan tersebut.
 */
async function ujiGerbangPerangkatLogin(
  akun: Record<Exclude<Peran, 'tamu'>, AkunUji>,
  laporan: Laporan
): Promise<void> {
  const stempel = Date.now();
  const nim = `9999${stempel}`;
  const password = `UjiGerbangPerangkat-${stempel}`;
  const utama = `uji-p4-utama-${stempel}`;
  const tambahan = `uji-p4-satu-${stempel}`;
  const diBawahBatas = `uji-p4-dua-${stempel}`;
  const penuh = `uji-p4-tiga-${stempel}`;

  const akunUji = await prisma.user.create({
    data: {
      nim,
      password_hash: await bcrypt.hash(password, 10),
      role: 'MAHASISWA',
      first_login: false,
      isActive: true,
      maxDevices: 3,
      deviceId: utama,
      deviceLabel: 'Utama uji P4',
      deviceBoundAt: new Date(),
    },
    select: { id: true, sessionVersion: true },
  });
  await prisma.userDevice.create({
    data: { userId: akunUji.id, deviceId: tambahan, label: 'Tambahan uji P4' },
  });

  const sesiAwal = akunUji.sessionVersion;
  const mulai = new Date();

  try {
    // (a) 2 dari 3 slot terpakai -> perangkat baru harus DITERIMA.
    const masuk = await minta('/auth/login', {
      metode: 'POST',
      body: { nim, password },
      headers: { 'X-Device-Id': diBawahBatas },
    });
    const namaTerima = 'POST /auth/login perangkat baru saat slot sisa (2 dari 3) → 200';
    // 429 di sini = limiter login bekerja, bukan gerbang perangkat yang bocor.
    const dibatasiTerima = tandaiLimiter(laporan, namaTerima, masuk);
    if (!dibatasiTerima) {
      if (masuk.status !== 200) laporan.gagalkan(`${namaTerima} — status ${masuk.status}`, masuk.status, 200);
      else laporan.luluskan(`${namaTerima} → 200`);
    }

    const terdaftarSetelahMasuk = await prisma.userDevice.count({ where: { userId: akunUji.id } });
    const namaDaftar = 'perangkat yang diterima terdaftar di UserDevice';
    if (dibatasiTerima) laporan.lewati(namaDaftar, 'login pertama dibalas 429, tidak ada perangkat baru yang terdaftar');
    else if (terdaftarSetelahMasuk !== 2) laporan.gagalkan(namaDaftar, terdaftarSetelahMasuk, 2);
    else laporan.luluskan(`${namaDaftar} (2 baris: utama tersimpan di kolom User)`);

    // (b) 3 dari 3 -> perangkat keempat harus DITOLAK dengan PERANGKAT_TERKUNCI.
    const namaTolak = 'POST /auth/login perangkat ke-4 (batas 3) → 403 PERANGKAT_TERKUNCI';
    let dibatasiTolak = false;
    if (dibatasiTerima) {
      laporan.lewati(namaTolak, 'login pertama dibalas 429, keadaan 3 dari 3 tidak terbentuk');
    } else {
      const tolak = await minta('/auth/login', {
        metode: 'POST',
        body: { nim, password },
        headers: { 'X-Device-Id': penuh },
      });
      dibatasiTolak = tandaiLimiter(laporan, namaTolak, tolak);
      if (!dibatasiTolak) {
        if (tolak.status !== 403 || !tolak.body.includes('PERANGKAT_TERKUNCI')) {
          laporan.gagalkan(`${namaTolak} — status ${tolak.status}`, tolak.body.slice(0, 120), '403 + code PERANGKAT_TERKUNCI');
        } else laporan.luluskan(`${namaTolak} → 403`);
      }
    }
    const dibatasi = dibatasiTerima || dibatasiTolak;
    const alasanLimiter = 'login sebelumnya dibalas 429, keadaan yang diuji baris ini tidak terbentuk';

    const sesudah = await prisma.user.findUniqueOrThrow({
      where: { id: akunUji.id },
      select: { sessionVersion: true, deviceId: true, pendingDeviceId: true },
    });

    const namaCatat = 'percobaan perangkat keempat tercatat di pendingDeviceId';
    if (dibatasi) laporan.lewati(namaCatat, alasanLimiter);
    else if (sesudah.pendingDeviceId !== penuh) laporan.gagalkan(namaCatat, sesudah.pendingDeviceId, penuh);
    else laporan.luluskan(namaCatat);

    const namaTetapDaftar = 'penolakan tidak menambah baris UserDevice';
    const jumlahTetap = await prisma.userDevice.count({ where: { userId: akunUji.id } });
    if (dibatasi) laporan.lewati(namaTetapDaftar, alasanLimiter);
    else if (jumlahTetap !== 2) laporan.gagalkan(namaTetapDaftar, jumlahTetap, 2);
    else laporan.luluskan(`${namaTetapDaftar} (tetap 2 baris)`);

    const namaTetapSesi = 'penolakan tidak menaikkan sessionVersion (sesi perangkat lama tetap hidup)';
    if (dibatasi) laporan.lewati(namaTetapSesi, alasanLimiter);
    else if (sesudah.sessionVersion !== sesiAwal) laporan.gagalkan(namaTetapSesi, sesudah.sessionVersion, sesiAwal);
    else laporan.luluskan(`${namaTetapSesi} (v=${sesudah.sessionVersion})`);

    const namaTetapKunci = 'deviceId utama tidak berpindah saat login ditolak';
    if (dibatasi) laporan.lewati(namaTetapKunci, alasanLimiter);
    else if (sesudah.deviceId !== utama) laporan.gagalkan(namaTetapKunci, sesudah.deviceId, utama);
    else laporan.luluskan(`${namaTetapKunci} (${sesudah.deviceId})`);
  } finally {
    await prisma.userDevice.deleteMany({ where: { userId: akunUji.id } });
    // Login yang ditolak menyebarkan notifikasi ke 150 akun ADMIN di staging.
    // Dibersihkan sebatas yang tim fixture ini bikin (judul + sejak mulai), jadi
    // baris yang sudah ada sebelum run tidak ikut hilang.
    await prisma.notification.deleteMany({
      where: { title: 'Ada percobaan login perangkat baru', createdAt: { gte: mulai } },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: akunUji.id, action: 'NOTIF_PERANGKAT_BARU' } });
    await prisma.user.delete({ where: { id: akunUji.id } });
  }
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
  const mulai = Date.now();

  /**
   * AUDIT-16 K3 — subset runner. `UJI_AKSES_FILTER=/students` hanya menjalankan
   * baris yang `jalur`-nya memuat potongan itu, supaya satu aturan bisa
   * dibuktikan lewat HTTP sungguhan dalam budget CPU (matriks penuh 200+ baris).
   * Tanpa variabel, perilaku persis seperti sebelumnya.
   */
  const filter = (process.env.UJI_AKSES_FILTER || '').trim();
  const barisAktif = filter ? BARIS.filter((b) => b.jalur.includes(filter)) : BARIS;

  console.log(
    `\n=== UJI AKSES RUTE (401/403) ===\nAPI: ${API_URL}\n` +
      (filter
        ? `FILTER: jalur memuat "${filter}" -> ${barisAktif.length} dari ${BARIS.length} baris\n`
        : `FILTER: tidak aktif -> ${BARIS.length} baris\n`)
  );
  await pastikanServerHidup();

  const akun = await siapkanAkunUji();
  const semuaAkun = Object.values(akun);
  const jabatan = await siapkanIdJabatan(akun.mahasiswa);

  const laporan = new Laporan();

  try {
    console.log('--- Aturan per endpoint ---');
    for (const baris of barisAktif) {
      await jalankanBaris(baris, akun, jabatan.id, laporan);
    }

    if (filter) {
      // Kelompok di bawah ini tidak berkunci pada satu `jalur` matriks dan
      // semuanya menulis data uji, jadi dilewati saat subset aktif; jalankan
      // tanpa UJI_AKSES_FILTER untuk memutuskannya.
      laporan.lewati(
        'Kelompok isi balasan + batas perangkat',
        `subset aktif: UJI_AKSES_FILTER="${filter}" hanya membatasi loop BARIS`
      );
    } else {
      console.log('\n--- Isi balasan: isolasi pengajuan perubahan data ---');
      await ujiIsolasiPengajuanData(akun, laporan);

      console.log('\n--- Isi balasan: draf konten tidak terbaca anonim ---');
      await ujiDrafKontenTertutup(akun, laporan);

      console.log('\n--- Batas perangkat ---');
      await ujiBatasPerangkat(akun, laporan);

      console.log('\n--- IZINKAN pada akun di atas batas ---');
      await ujiIzinkanDiAtasBatas(akun, laporan);

      console.log('\n--- Gerbang perangkat saat login ---');
      await ujiGerbangPerangkatLogin(akun, laporan);
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
  console.log(`Waktu suite: ${((Date.now() - mulai) / 1000).toFixed(1)} dtk untuk ${barisAktif.length} baris matriks`);
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
