import prisma from './prisma';

/**
 * Filter kata forum diskusi.
 *
 * Daftar kata disimpan di SiteSetting (tanpa tabel baru) dengan kunci
 * `forum_kata_terlarang`. Hasil baca di-cache singkat karena halaman forum
 * melakukan polling pesan tiap beberapa detik; tanpa cache, setiap polling
 * akan menambah satu query pengaturan. Perubahan dari admin langsung
 * memperbarui cache instance yang menanganinya, sedangkan instance lain
 * menyegarkan paling lambat 30 detik kemudian.
 */

const KUNCI = 'forum_kata_terlarang';
const UMUR_CACHE_MS = 30_000;
const MAKS_KATA = 200;
const MAKS_PANJANG = 50;

let cache: { kata: string[]; pada: number } | null = null;

/** Membersihkan input dari body (array atau teks dipisah baris/koma). */
const normalkan = (nilai: unknown): string[] => {
  const mentah = Array.isArray(nilai)
    ? nilai
    : typeof nilai === 'string'
      ? nilai.split(/[\n,;]+/)
      : [];

  const hasil: string[] = [];
  const terlihat = new Set<string>();

  for (const item of mentah) {
    const kata = String(item ?? '').trim().toLowerCase().slice(0, MAKS_PANJANG);
    if (!kata || terlihat.has(kata)) continue;
    terlihat.add(kata);
    hasil.push(kata);
    if (hasil.length >= MAKS_KATA) break;
  }

  return hasil;
};

const bacaDariDatabase = async (): Promise<string[]> => {
  const baris = await prisma.siteSetting.findUnique({
    where: { key: KUNCI },
    select: { value: true },
  });
  if (!baris?.value) return [];

  try {
    return normalkan(JSON.parse(baris.value));
  } catch {
    // Data lama mungkin tersimpan sebagai teks dipisah koma.
    return normalkan(baris.value);
  }
};

/** Daftar kata terlarang aktif (cached sebentar). */
export const bacaKataTerlarang = async (): Promise<string[]> => {
  if (cache && Date.now() - cache.pada < UMUR_CACHE_MS) return cache.kata;

  const kata = await bacaDariDatabase();
  cache = { kata, pada: Date.now() };
  return kata;
};

/** Simpan daftar kata dan langsung segarkan cache instance ini. */
export const simpanKataTerlarang = async (nilai: unknown): Promise<string[]> => {
  const kata = normalkan(nilai);

  await prisma.siteSetting.upsert({
    where: { key: KUNCI },
    update: { value: JSON.stringify(kata) },
    create: { key: KUNCI, value: JSON.stringify(kata) },
  });

  cache = { kata, pada: Date.now() };
  return kata;
};

const escapeRegex = (teks: string): string => teks.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Menyamarkan kata terlarang menjadi bintang.
 *
 * Pencocokan memakai batas huruf/angka supaya "bass" tidak ikut menyamarkan
 * "bassist", tetapi tetap menangkap kata di awal/akhir kalimat dan tanda baca.
 * Kata dengan spasi dicocokkan dengan spasi yang fleksibel.
 */
export const saringKata = (teks: string, kata: string[]): string => {
  if (!teks || kata.length === 0) return teks;

  // Kata terpanjang lebih dulu agar frasa "dua kata" tidak dipotong sebagian.
  const daftar = [...kata].sort((a, b) => b.length - a.length);
  let hasil = teks;

  for (const k of daftar) {
    const pola = k
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegex)
      .join('\\s+');
    if (!pola) continue;

    const regex = new RegExp(`(^|[^\\p{L}\\p{N}])(${pola})(?=$|[^\\p{L}\\p{N}])`, 'giu');
    hasil = hasil.replace(regex, (_cocok, awalan: string, sasaran: string) =>
      `${awalan}${'*'.repeat(Math.max(3, Math.min(sasaran.length, 8)))}`
    );
  }

  return hasil;
};
