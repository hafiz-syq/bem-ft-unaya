/**
 * Menyimpan gambar halaman ke cache offline sejak servis pekerja terpasang.
 *
 * Service worker hanya bisa menyimpan gambar yang pernah diminta. Pada
 * kunjungan pertama, gambar landing yang baru muncul setelah data API dimuat
 * belum tentu sempat lewat cache, sehingga saat pengunjung langsung offline
 * bagian tersebut bisa kosong. Modul ini mengirim daftar gambar yang sedang
 * tampil ke service worker agar disimpan sekali, tanpa menunggu kunjungan
 * berikutnya.
 *
 * Aset statis (foto fakultas + ikon) sudah masuk daftar precache di sw.js;
 * yang dikirim dari sini adalah gambar dinamis (mis. foto dari Cloudinary).
 */

/** Batas jumlah gambar per kiriman supaya pesan tetap ringan. */
const MAKS_GAMBAR = 60;

/** Mengumpulkan URL gambar yang saat ini terpasang di halaman. */
const kumpulkanGambar = (): string[] => {
  if (typeof document === 'undefined') return [];

  const daftar = new Set<string>();

  for (const gambar of Array.from(document.images)) {
    const url = gambar.currentSrc || gambar.src;
    if (!url || !/^https?:/i.test(url)) continue;
    daftar.add(url);
    if (daftar.size >= MAKS_GAMBAR) break;
  }

  return [...daftar];
};

/**
 * Kirim sekali (plus dua percobaan susulan untuk gambar yang dimuat belakangan)
 * daftar gambar ke service worker aktif. Aman dipanggil walau servis pekerja
 * tidak tersedia: fungsi ini tidak melakukan apa pun tanpa controller.
 */
export function pasangPrecacheGambar(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const kirim = () => {
    const pekerja = navigator.serviceWorker.controller;
    if (!pekerja) return;

    const urls = kumpulkanGambar();
    if (urls.length === 0) return;

    pekerja.postMessage({ type: 'PRACACHE_GAMBAR', urls });
  };

  kirim();
  // Konten landing berasal dari API, jadi sebagian gambar baru terpasang
  // beberapa detik setelah halaman siap. Dua percobaan susulan menangkapnya.
  window.setTimeout(kirim, 2_500);
  window.setTimeout(kirim, 6_000);
}
