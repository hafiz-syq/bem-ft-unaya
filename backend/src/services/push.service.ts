import webpush from 'web-push';
import prisma from '../lib/prisma';

/**
 * Notifikasi browser (Web Push).
 *
 * Fitur ini aktif hanya bila VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, dan
 * VAPID_SUBJECT diisi di environment. Tanpa kunci, aplikasi tetap berjalan
 * normal; tombol notifikasi di UI otomatis menyembunyikan dirinya.
 */
export interface PayloadPush {
  title: string;
  body: string;
  url?: string;
}

let sudahDisiapkan = false;

export const kunciPublikPush = (): string | null => {
  const kunci = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  return kunci || null;
};

const siapkanWebPush = (): boolean => {
  if (sudahDisiapkan) return true;
  const publik = kunciPublikPush();
  const privat = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subjek = String(process.env.VAPID_SUBJECT || 'mailto:admin@bem-ft-unaya.local').trim();

  if (!publik || !privat) return false;

  webpush.setVapidDetails(subjek, publik, privat);
  sudahDisiapkan = true;
  return true;
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
      JSON.stringify(payload)
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
  if (!siapkanWebPush()) return;

  const langganan = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(langganan.map((l) => kirimKeSatuLangganan(l, payload)));
}

export async function kirimPushKeBanyak(userIds: string[], payload: PayloadPush): Promise<void> {
  if (!siapkanWebPush() || userIds.length === 0) return;

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
