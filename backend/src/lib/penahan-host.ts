/**
 * SATU-satunya tempat keputusan "host ini boleh ditulis?" berada.
 *
 * Dua konsumen memakai logika ini dengan opt-in yang sengaja berbeda:
 *   - src/tests/penahan-host-uji.ts -> suite uji (UJI_BOLEH_PRODUKSI)
 *   - src/scripts/penahan-host-tulis.ts -> jalur tulis non-tes: skrip di src/scripts
 *     dan preflight `prisma migrate dev` / `db push` (TULIS_BOLEH_JAUH)
 *   - src/tests/bantu-uji.ts -> host API_URL yang boleh ditulis lewat HTTP
 *     (audiens: AUDIT-16 K1; memakai adalahHostUrlLokal, bukan regex mysql di atas)
 *
 * Regex host dan penyensor kredensial tidak boleh ditulis ulang di tempat lain;
 * kalau ada yang menyalinnya, matriks kelompok J di uji-unit-kritis tidak lagi
 * membuktikan perilaku yang benar-benar dipakai. Modul ini sendiri tidak punya
 * efek samping supaya bisa diimpor tes tanpa mematikan proses.
 */

/** Nama env opt-in, dipisah supaya menyetujui suite uji tidak membuka skrip tulis. */
export const NAMA_ENV_UJI = 'UJI_BOLEH_PRODUKSI';
export const NAMA_ENV_TULIS = 'TULIS_BOLEH_JAUH';

/** true bila URL menunjuk mesin ini; kosong dianggap aman (tidak ada yang bisa ditulis). */
export const adalahHostLokal = (url: string): boolean =>
  !url || /@(?:localhost|127\.0\.0\.1|\[::1\]|::1)(?::\d+)?\//i.test(url);

/**
 * Versi untuk URL HTTP tanpa userinfo (mis. `http://localhost:3000/api`), yang
 * dipakai suite uji untuk memutuskan server mana yang boleh ia tulis
 * (AUDIT-16 K1). `adalahHostLokal` TIDAK cocok di sini: regexnya expecting
 * bentuk `mysql://user:pass@host/db` dan memberi false untuk URL http.
 * Hostname diambil dengan `new URL()` lalu dibandingkan daftar literal, jadi
 * `http://localhost.meniru.example.com` tidak menyulundup.
 */
const HOST_API_LOKAL = ['localhost', '127.0.0.1', '::1'];

export const adalahHostUrlLokal = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return HOST_API_LOKAL.includes(hostname);
  } catch {
    return false;
  }
};

/** Opt-in dianggap menyala hanya untuk nilai "1"; spasi di tepi diabaikan. */
export const optInDinyalakan = (nilai: string | undefined): boolean => (nilai || '').trim() === '1';

/** Sensor userinfo agar kata sandi tidak ikut tercetak di log atau terminal. */
export const sembunyikanKredensial = (url: string): string => url.replace(/\/\/[^@]*@/, '//***@');
