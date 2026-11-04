/**
 * Store kecil "pasang aplikasi" (PWA), dipisah dari React supaya:
 * 1) peristiwa beforeinstallprompt tertangkap sedini mungkin — peramban bisa
 *    mengirimnya sebelum komponen pertama kali ter-render, dan peristiwa itu
 *    tidak dikirim ulang di sesi yang sama;
 * 2) keputusan mode bisa dites tanpa browser (ikut pola offline-keputusan.ts).
 */

export type ModePasang = 'sembunyi' | 'otomatis' | 'manual';

export interface KondisiPasang {
  /** Halaman sudah berjalan sebagai aplikasi terpasang (mode standalone). */
  terpasang: boolean;
  /** Safari iOS/iPadOS: tidak mengenal beforeinstallprompt, pasang manual. */
  ios: boolean;
  /** Peramban sudah mengirim peristiwa beforeinstallprompt. */
  punyaPrompt: boolean;
}

export const tentukanMode = (kondisi: KondisiPasang): ModePasang => {
  if (kondisi.terpasang) return 'sembunyi';
  if (kondisi.ios) return 'manual';
  return kondisi.punyaPrompt ? 'otomatis' : 'sembunyi';
};

interface PeristiwaPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Pengamat = () => void;

let promptTersimpan: PeristiwaPrompt | null = null;
let sudahTerpasang = false;
const daftarPengamat = new Set<Pengamat>();

const beriTahu = (): void => daftarPengamat.forEach((pengamat) => pengamat());

/** Safari Apple tidak mengenal beforeinstallprompt; pemasangannya lewat Bagikan. */
const adalahIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const berjalanSebagaiAplikasi = (): boolean =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

// Guard window: modul ini ikut ter-evaluasi saat build oleh landing-prerender.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Menahan banner bawaan peramban supaya keputusan ada di tangan tombol ini.
    event.preventDefault();
    promptTersimpan = event as PeristiwaPrompt;
    sudahTerpasang = false;
    beriTahu();
  });
  window.addEventListener('appinstalled', () => {
    promptTersimpan = null;
    sudahTerpasang = true;
    beriTahu();
  });
}

export const modeSaatIni = (): ModePasang =>
  tentukanMode({
    terpasang: sudahTerpasang || berjalanSebagaiAplikasi(),
    ios: adalahIOS(),
    punyaPrompt: promptTersimpan !== null,
  });

export const berlanggananMode = (pengamat: Pengamat): (() => void) => {
  daftarPengamat.add(pengamat);
  return () => {
    daftarPengamat.delete(pengamat);
  };
};

/** Menampilkan dialog pasang peramban. undefined bila tidak ada prompt tersisa. */
export const mintaPasang = async (): Promise<'accepted' | 'dismissed' | undefined> => {
  const prompt = promptTersimpan;
  if (!prompt) return undefined;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  // Peramban tidak mengirim ulang prompt di sesi yang sama; muat ulang halaman
  // memunculkannya lagi bila pengunjung berubah pikiran.
  promptTersimpan = null;
  beriTahu();
  return outcome;
};
