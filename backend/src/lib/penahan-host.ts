/**
 * SATU-satunya tempat keputusan "host ini boleh dituli?" berada.
 *
 * Dua konsumen memakai logika ini dengan opt-in yang sengaja berbeda:
 *   - src/tests/penahan-host-uji.ts -> suite uji (UJI_BOLEH_PRODUKSI)
 *   - src/lib/penahan-host-tulis.ts -> jalur tulis non-tes: skrip di src/scripts dan
 *     preflight `prisma migrate dev` / `db push` (TULIS_BOLEH_JAUH)
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

/** Opt-in dianggap menyala hanya untuk nilai "1"; spasi di tepi diabaikan. */
export const optInDinyalakan = (nilai: string | undefined): boolean => (nilai || '').trim() === '1';

/** Sensor userinfo agar kata sandi tidak ikut tercetak di log atau terminal. */
export const sembunyikanKredensial = (url: string): string => url.replace(/\/\/[^@]*@/, '//***@');
