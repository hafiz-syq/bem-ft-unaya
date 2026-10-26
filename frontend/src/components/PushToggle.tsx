import { useEffect, useState } from 'react';
import { api } from '../lib/axios';
import { Bell, BellOff, Loader2 } from 'lucide-react';

const kunciKeUint8 = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const aman = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const mentah = window.atob(aman);
  const hasil = new Uint8Array(new ArrayBuffer(mentah.length));
  for (let i = 0; i < mentah.length; i += 1) hasil[i] = mentah.charCodeAt(i);
  return hasil;
};

/**
 * Tombol aktif/nonaktif notifikasi browser. Disembunyikan bila browser tidak
 * mendukung Web Push atau server belum memiliki kunci VAPID.
 */
export default function PushToggle() {
  const [didukung, setDidukung] = useState(false);
  const [aktif, setAktif] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    let batal = false;

    const periksa = async () => {
      const cocok =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      if (!cocok) return;

      try {
        const res = await api.get('/push/public-key');
        if (batal || !res.data.enabled) return;
        setDidukung(true);

        const daftar = await navigator.serviceWorker.register('/sw.js');
        const langganan = await daftar.pushManager.getSubscription();
        if (!batal) setAktif(Boolean(langganan));
      } catch (error) {
        console.error('Notifikasi browser tidak tersedia:', error);
      }
    };

    periksa();
    return () => {
      batal = true;
    };
  }, []);

  if (!didukung) return null;

  const aktifkan = async () => {
    setSibuk(true);
    setPesan('');
    try {
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') {
        setPesan('Izin notifikasi ditolak. Ubah dari pengaturan browser.');
        return;
      }

      const res = await api.get('/push/public-key');
      if (!res.data.publicKey) {
        setPesan('Kunci notifikasi server belum diatur.');
        return;
      }

      const daftar = await navigator.serviceWorker.ready;
      const langganan = await daftar.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: kunciKeUint8(res.data.publicKey),
      });

      await api.post('/push/subscribe', langganan.toJSON());
      setAktif(true);
      setPesan('Notifikasi browser aktif untuk perangkat ini.');
    } catch (error) {
      console.error(error);
      setPesan('Gagal mengaktifkan notifikasi.');
    } finally {
      setSibuk(false);
    }
  };

  const matikan = async () => {
    setSibuk(true);
    setPesan('');
    try {
      const daftar = await navigator.serviceWorker.ready;
      const langganan = await daftar.pushManager.getSubscription();
      if (langganan) {
        await api.post('/push/unsubscribe', { endpoint: langganan.endpoint });
        await langganan.unsubscribe();
      }
      setAktif(false);
      setPesan('Notifikasi browser dimatikan.');
    } catch (error) {
      console.error(error);
      setPesan('Gagal mematikan notifikasi.');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
      <button
        type="button"
        onClick={aktif ? matikan : aktifkan}
        disabled={sibuk}
        className={`flex w-full items-center gap-2 px-2 py-2 text-xs font-bold rounded-lg transition disabled:opacity-50 ${aktif ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60' : 'text-gray-600 bg-gray-50 hover:bg-gray-100 dark:text-gray-300 dark:bg-gray-800'}`}
      >
        {sibuk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : aktif ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
        {aktif ? 'Notifikasi browser aktif' : 'Aktifkan notifikasi browser'}
      </button>
      {pesan && <p className="mt-1 text-[10px] leading-snug text-gray-500 dark:text-gray-400">{pesan}</p>}
    </div>
  );
}
