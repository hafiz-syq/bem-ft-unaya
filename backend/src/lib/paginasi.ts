/**
 * Jumlah halaman dari total baris dan batas per halaman.
 *
 * Dibiarkan 0 ketika total 0: pemanggil lama menganggap "tidak ada halaman
 * berikutnya", bukan "satu halaman kosong".
 */
export const batasHalaman = (total: number, limit: number): number => Math.ceil(total / limit);
