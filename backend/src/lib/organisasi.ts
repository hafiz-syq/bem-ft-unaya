/**
 * Tipe organisasi dan penjenjangannya untuk arsip surat.
 *
 * Arsip hanya menyebar ke tingkat yang lebih tinggi:
 *   HIMPUNAN (1)  — surat himpunan hanya terlihat himpunan itu sendiri,
 *                   lalu BEM, DPM, dan admin;
 *   BEM (2)       — surat BEM terlihat BEM, DPM, dan admin;
 *   DPM (3)       — surat DPM hanya terlihat DPM dan admin.
 */

export const JENIS_ORGANISASI = ['HIMPUNAN', 'BEM', 'DPM'] as const;
export type JenisOrganisasi = (typeof JENIS_ORGANISASI)[number];

export const isJenisOrganisasi = (nilai: unknown): nilai is JenisOrganisasi =>
  typeof nilai === 'string' && (JENIS_ORGANISASI as readonly string[]).includes(nilai);

/** Tampilan label tipe organisasi di UI. */
export const LABEL_JENIS: Record<JenisOrganisasi, string> = {
  HIMPUNAN: 'Himpunan',
  BEM: 'BEM',
  DPM: 'DPM',
};

/** Tingkat visibilitas arsip: makin besar, makin tinggi kedudukannya. */
export const TINGKAT_ORGANISASI: Record<JenisOrganisasi, number> = {
  HIMPUNAN: 1,
  BEM: 2,
  DPM: 3,
};

/**
 * Tingkat sebuah organisasi. Nilai tak dikenal diperlakukan sebagai himpunan
 * (tingkat terendah) supaya kesalahan pengetikan tidak pernah melebarkan akses.
 */
export const tingkatOrganisasi = (kind: string | null | undefined): number =>
  isJenisOrganisasi(kind) ? TINGKAT_ORGANISASI[kind] : TINGKAT_ORGANISASI.HIMPUNAN;
