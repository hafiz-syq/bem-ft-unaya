/**
 * Keputusan murni satu percobaan kirim ulang antrean luring — tanpa IndexedDB
 * dan tanpa axios, supaya bisa dites dengan `node --test` (frontend/uji/).
 * Dipakai prosesAntrean() di offline.ts. Service worker (public/sw.js) tidak
 * dapat mengimpor modul dari src, jadi ia menyimpan salinan kondisinya sendiri
 * dan perubahan di sini wajib dicermin di sana.
 */

/**
 * Batas percobaan gagal untuk entri yang dipertahankan; setelah ini dibuang.
 * shortcut: plafon tetap tanpa backoff/jeda antarflush; naikkan ke retry-after
 * per entri bila server butuh jeda yang lebih panjang dari satu putaran flush.
 */
export const BATAS_PERCOBAAN = 5;

/**
 * Penolakan yang benar-benar permanen terhadap ISI data — body yang sama akan
 * ditolak lagi, jadi entri layak dibuang. Semua 4xx lain justru sering
 * sementara: 401 = sesi kedaluwarsa (termasuk bump sessionVersion),
 * 403 = peran berubah, 429 = limiter login (5 permintaan per 5 menit per IP)
 * yang normal terjadi saat banyak entri diputar ulang sekaligus. Membuangnya =
 * menghapus tulisan
 * pengguna karena keadaan yang bukan salah data mereka.
 */
export const STATUS_PERMANEN = [400, 422];

export type KeputusanKirim = 'hapus' | 'buang' | 'pertahankan' | 'hentikan';

/**
 * sukses: pengiriman mengembalikan 2xx (axios resolve).
 * status: status respons ketika gagal; undefined = tanpa respons (jaringan).
 * coba: jumlah kegagalan entri ini SEBELUM percobaan sekarang.
 */
export const keputusanKirim = (
  sukses: boolean,
  status: number | undefined,
  coba: number
): KeputusanKirim => {
  if (sukses) return 'hapus';
  if (status === undefined || status < 400 || status >= 500) return 'hentikan';
  if (STATUS_PERMANEN.includes(status)) return 'buang';
  return coba + 1 >= BATAS_PERCOBAAN ? 'buang' : 'pertahankan';
};
