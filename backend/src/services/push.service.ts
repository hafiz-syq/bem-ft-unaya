import webpush from 'web-push';
import prisma from '../lib/prisma';

/**
 * Notifikasi browser (Web Push).
 *
 * Kunci VAPID dibaca dari environment bila tersedia. Bila tidak, pasangan kunci
 * dibuat SEKALI lalu disimpan di tabel SiteSetting, sehingga notifikasi
 * perangkat tetap aktif tanpa perlu menyetel environment tambahan. Kunci yang
 * disimpan di database dipakai bersama oleh semua instans server (Vercel),
 * jadi langganan push yang sudah dibuat tidak pernah kehilangan pasangannya.
 *
 * Bila environment diisi, nilai environment selalu menang. Ini memungkinkan
 * pemilik situs memakai kunci sendiri tanpa menghapus baris database.
 */
export interface PayloadPush {
  title: string;
  body: string;
  url?: string;
  /** Tag notifikasi: notifikasi dengan tag sama saling menggantikan. */
  tag?: string;
}

interface KonfigurasiVapid {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const KUNCI_SETTING = 'vapid_keys';
const SUBJEK_BAWAAN = 'mailto:admin@bem-ft-unaya.vercel.app';

let konfigurasi: KonfigurasiVapid | null = null;
let janjiMenyiapkan: Promise<KonfigurasiVapid | null> | null = null;

const subjekVapid = (): string => {
  const nilai = String(process.env.VAPID_SUBJECT || '').trim();
  return nilai || SUBJEK_BAWAAN;
};

const kunciDariEnvironment = (): KonfigurasiVapid | null => {
  const publik = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privat = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!publik || !privat) return null;
  return { publicKey: publik, privateKey: privat, subject: subjekVapid() };
};

/**
 * Membaca pasangan kunci dari database. Bila belum ada, satu pasangan baru
 * dibuat. `upsert` dengan update kosong membuat instans yang berlomba hanya
 * menulis satu kali; instans lain membaca baris yang sama.
 */
const kunciDariDatabase = async (): Promise<KonfigurasiVapid> => {
  const dibuat = webpush.generateVAPIDKeys();

  const baris = await prisma.siteSetting.upsert({
    where: { key: KUNCI_SETTING },
    update: {},
    create: {
      key: KUNCI_SETTING,
      value: JSON.stringify({
        publicKey: dibuat.publicKey,
        privateKey: dibuat.privateKey,
        subject: subjekVapid(),
      }),
    },
  });

  const tersimpan = JSON.parse(baris.value) as Partial<KonfigurasiVapid>;
  if (!tersimpan.publicKey || !tersimpan.privateKey) {
    throw new Error('Kunci VAPID tersimpan tidak valid.');
  }

  return {
    publicKey: tersimpan.publicKey,
    privateKey: tersimpan.privateKey,
    subject: tersimpan.subject || subjekVapid(),
  };
};

const pastikanKonfigurasi = async (): Promise<KonfigurasiVapid | null> => {
  if (konfigurasi) return konfigurasi;
  if (janjiMenyiapkan) return janjiMenyiapkan;

  janjiMenyiapkan = (async () => {
    let nilai = kunciDariEnvironment();

    if (!nilai) {
      try {
        nilai = await kunciDariDatabase();
      } catch (error) {
        console.error('[push] Kunci VAPID tidak dapat dimuat:', error);
        return null;
      }
    }

    try {
      webpush.setVapidDetails(nilai.subject, nilai.publicKey, nilai.privateKey);
    } catch (error) {
      console.error('[push] Kunci VAPID tidak valid:', error);
      return null;
    }

    konfigurasi = nilai;
    return nilai;
  })().finally(() => {
    janjiMenyiapkan = null;
  });

  return janjiMenyiapkan;
};

/** Kunci publik VAPID untuk didaftarkan browser. Null = fitur tidak tersedia. */
export const kunciPublikPush = async (): Promise<string | null> => {
  const nilai = await pastikanKonfigurasi();
  return nilai?.publicKey ?? null;
};

export async function simpanLanggananPush(
  userId: string,
  langganan: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: langganan.endpoint },
    update: { userId, p256dh: langganan.keys.p256dh, auth: langganan.keys.auth },
    create: {
      userId,
      endpoint: langganan.endpoint,
      p256dh: langganan.keys.p256dh,
      auth: langganan.keys.auth,
    },
  });
}

export async function hapusLanggananPush(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

async function kirimKeSatuLangganan(
  langganan: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PayloadPush
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: langganan.endpoint,
        keys: { p256dh: langganan.p256dh, auth: langganan.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: 'normal' }
    );
  } catch (error: any) {
    // 404/410 = langganan sudah dicabut browser. Hapus agar tidak dicoba terus.
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { id: langganan.id } }).catch(() => undefined);
      return;
    }
    console.error(`[push] Gagal mengirim ke ${langganan.endpoint.slice(0, 60)}…:`, error?.message || error);
  }
}

export async function kirimPushKePengguna(userId: string, payload: PayloadPush): Promise<void> {
  if (!(await pastikanKonfigurasi())) return;

  const langganan = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(langganan.map((l) => kirimKeSatuLangganan(l, payload)));
}

export async function kirimPushKeBanyak(userIds: string[], payload: PayloadPush): Promise<void> {
  if (!(await pastikanKonfigurasi()) || userIds.length === 0) return;

  // Dibatasi agar satu pengumuman massal tidak membuka ribuan koneksi sekaligus.
  const unik = [...new Set(userIds)].slice(0, 2000);
  for (let i = 0; i < unik.length; i += 100) {
    const potongan = unik.slice(i, i + 100);
    const langganan = await prisma.pushSubscription.findMany({
      where: { userId: { in: potongan } },
    });
    await Promise.all(langganan.map((l) => kirimKeSatuLangganan(l, payload)));
  }
}
