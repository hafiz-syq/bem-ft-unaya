/**
 * Penanda perangkat untuk kunci \"satu akun, satu perangkat\".
 *
 * Browser membuat ID acak yang disimpan di localStorage lalu mengirimkannya
 * pada header `X-Device-Id` di setiap permintaan. Server tidak memakai
 * fingerprint browser (yang rapuh dan sensitif); cukup ID yang stabil selama
 * penyimpanan browser tidak dibersihkan.
 */

const POLA_ID_PERANGKAT = /^[A-Za-z0-9_-]{8,64}$/;

/** Membaca ID perangkat dari header (utama) atau body (cadangan). */
export const bacaDeviceId = (req: any): string | null => {
  const mentah =
    req?.headers?.['x-device-id'] ??
    req?.get?.('x-device-id') ??
    req?.body?.deviceId;

  if (typeof mentah !== 'string') return null;

  const bersih = mentah.trim();
  return POLA_ID_PERANGKAT.test(bersih) ? bersih : null;
};

/** Label perangkat yang mudah dibaca admin, mis. \"Chrome di Android\". */
export const labelPerangkat = (req: any): string => {
  const ua = String(req?.headers?.['user-agent'] ?? '');

  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
      : /Chrome\//.test(ua) ? 'Chrome'
        : /Firefox\//.test(ua) ? 'Firefox'
          : /Safari\//.test(ua) ? 'Safari'
            : null;

  const sistem = /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
      : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X/.test(ua) ? 'macOS'
          : /Linux/.test(ua) ? 'Linux'
            : null;

  const label = [browser, sistem].filter(Boolean).join(' di ');
  return (label || 'Perangkat tidak dikenal').slice(0, 160);
};

/**
 * Alasan sesi lama tidak boleh dipakai lagi, atau `null` bila masih sah.
 * - Versi sesi berubah: admin membuka/memindahkan kunci perangkat.
 * - ID perangkat tidak dikenali: token dipakai dari perangkat yang tidak
 *   terdaftar untuk akun ini.
 *
 * `perangkat` berisi perangkat tambahan (UserDevice) selain perangkat utama di
 * `deviceId`. Akun yang belum pernah mengikat perangkat apa pun tetap bebas.
 */
export const periksaSesiPerangkat = (
  akun: { deviceId: string | null; sessionVersion: number; perangkat?: string[] },
  decoded: { deviceId?: string | null; v?: number }
): string | null => {
  if ((decoded.v ?? 0) !== (akun.sessionVersion ?? 0)) {
    return 'Sesi ini sudah berakhir karena akses perangkat dibuka oleh admin. Silakan login kembali.';
  }

  const terdaftar = [akun.deviceId, ...(akun.perangkat ?? [])].filter(Boolean) as string[];

  // Belum ada perangkat terikat: cara lama tetap berlaku (bebas login).
  if (terdaftar.length === 0) return null;

  if (decoded.deviceId && terdaftar.includes(decoded.deviceId)) return null;

  return 'Akun ini sedang aktif di perangkat lain. Silakan login kembali atau hubungi admin untuk mengizinkan perangkat baru.';
};
