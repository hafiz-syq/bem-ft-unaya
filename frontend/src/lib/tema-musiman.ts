/**
 * Tema musiman situs.
 *
 * Satu sumber label & nilai untuk halaman pengaturan superadmin, badge musiman,
 * dan spanduk di halaman depan. Nilai yang disimpan di server HARUS sama dengan
 * daftar di sini (lihat site-theme.controller.ts).
 */
export type TemaMusiman = 'NONE' | 'RAMADAN' | 'LEBARAN' | 'NUSANTARA';

export const DAFTAR_TEMA: TemaMusiman[] = ['NONE', 'RAMADAN', 'LEBARAN', 'NUSANTARA'];

export const LABEL_TEMA: Record<TemaMusiman, string> = {
  NONE: 'Netral',
  RAMADAN: 'Ramadan',
  LEBARAN: 'Idulfitri',
  NUSANTARA: 'Nusantara',
};

export const KETERANGAN_TEMA: Record<TemaMusiman, string> = {
  NONE: 'Tampilan bawaan dengan aksen kuning keemasan sepanjang tahun.',
  RAMADAN:
    'Aksen ungu malam dengan hiasan bulan sabit dan lentera. Cocok dipasang selama bulan Ramadan.',
  LEBARAN:
    'Aksen hijau zamrud dengan nuansa ketupat dan berkah Idulfitri. Cocok dipasang pada pekan Lebaran.',
  NUSANTARA:
    'Aksen merah putih dengan semangat kebangsaan. Cocok untuk Agustus, Sumpah Pemuda, dan hari nasional.',
};

/** Kalimat singkat yang tampil di spanduk halaman depan saat tema aktif. */
export const UCAPAN_TEMA: Record<TemaMusiman, string | null> = {
  NONE: null,
  RAMADAN: 'Marhaban ya Ramadan — bulan penuh berkah, sabar, dan ampunan.',
  LEBARAN: 'Selamat Idulfitri — mohon maaf lahir dan batin dari keluarga besar BEM FT UNAYA.',
  NUSANTARA: 'Bangga berbudaya, bersatu untuk Nusantara — dari teknik untuk Indonesia.',
};

/** Tiga warna contoh untuk kartu pilihan tema di halaman pengaturan. */
export const CONTOH_WARNA: Record<TemaMusiman, { utama: string; kedua: string; ketiga: string }> = {
  NONE: { utama: '#fbbf24', kedua: '#f59e0b', ketiga: '#fff7ed' },
  RAMADAN: { utama: '#a78bfa', kedua: '#7c3aed', ketiga: '#1e1b4b' },
  LEBARAN: { utama: '#34d399', kedua: '#059669', ketiga: '#ecfdf5' },
  NUSANTARA: { utama: '#f87171', kedua: '#dc2626', ketiga: '#fef2f2' },
};

/** Nilai dari server tidak pernah dipercaya mentah-mentah. */
export const temaDikenal = (nilai: unknown): nilai is TemaMusiman =>
  typeof nilai === 'string' && (DAFTAR_TEMA as string[]).includes(nilai);
