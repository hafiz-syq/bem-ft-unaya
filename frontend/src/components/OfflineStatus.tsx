import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import {
  EVENT_ANTREAN,
  EVENT_TERSINKRON,
  hitungAntrean,
  pasangPemantauKoneksi,
  prosesAntrean,
  type HasilAntrean,
} from '../lib/offline';

/**
 * Indikator mode offline & sinkronisasi.
 *
 * Tampil sebagai bilah kecil di bawah layar:
 * - oranye saat offline (menampilkan jumlah perubahan yang menunggu),
 * - biru saat sedang mengirim antrean,
 * - hijau sebentar setelah antrean berhasil dikirim.
 *
 * Komponen ini tidak merender apa pun saat online dan antrean kosong, sehingga
 * tidak mengganggu tata letak halaman.
 */
export default function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [sisa, setSisa] = useState(0);
  const [menyinkron, setMenyinkron] = useState(false);
  const [sukses, setSukses] = useState<number | null>(null);

  useEffect(() => {
    // Status awal selalu online agar markup hasil prerender tidak berbeda
    // dengan render pertama di klien; nilai sebenarnya dibaca setelah mount.
    setOnline(navigator.onLine);

    const perbaruiJumlah = () => {
      void hitungAntrean().then(setSisa);
    };

    const saatOnline = () => {
      setOnline(true);
      setMenyinkron(true);
      void prosesAntrean().finally(() => setMenyinkron(false));
    };

    const saatOffline = () => {
      setOnline(false);
      perbaruiJumlah();
    };

    const saatAntrean = (event: Event) => {
      const detail = (event as CustomEvent<HasilAntrean>).detail;
      if (!detail) return;
      setSisa(detail.sisa);
      if (detail.selesai > 0) setSukses(detail.selesai);
    };

    const saatTersinkron = (event: Event) => {
      const detail = (event as CustomEvent<HasilAntrean>).detail;
      if (detail?.selesai) setSukses(detail.selesai);
    };

    pasangPemantauKoneksi();
    perbaruiJumlah();

    window.addEventListener('online', saatOnline);
    window.addEventListener('offline', saatOffline);
    window.addEventListener(EVENT_ANTREAN, saatAntrean);
    window.addEventListener(EVENT_TERSINKRON, saatTersinkron);

    const jeda = window.setInterval(perbaruiJumlah, 15_000);

    return () => {
      window.removeEventListener('online', saatOnline);
      window.removeEventListener('offline', saatOffline);
      window.removeEventListener(EVENT_ANTREAN, saatAntrean);
      window.removeEventListener(EVENT_TERSINKRON, saatTersinkron);
      window.clearInterval(jeda);
    };
  }, []);

  useEffect(() => {
    if (sukses === null) return;
    const jeda = window.setTimeout(() => setSukses(null), 5000);
    return () => window.clearTimeout(jeda);
  }, [sukses]);

  if (sukses !== null) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-[120] mx-auto flex max-w-md items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-lg dark:border-emerald-900/70 dark:bg-emerald-950/90 dark:text-emerald-200 sm:bottom-4"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">{sukses} perubahan berhasil disinkronkan.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </button>
      </div>
    );
  }

  if (online && sisa === 0 && !menyinkron) return null;

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-[120] mx-auto flex max-w-md items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg dark:border-amber-800/70 dark:bg-amber-950/90 dark:text-amber-100 sm:bottom-4"
      >
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="min-w-0">
          <span className="font-bold">Mode offline.</span>{' '}
          {sisa > 0
            ? `${sisa} perubahan disimpan dan akan dikirim otomatis saat internet kembali.`
            : 'Data terakhir yang tersimpan di perangkat tetap dapat dilihat.'}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[120] mx-auto flex max-w-md items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800 shadow-lg dark:border-sky-900/70 dark:bg-sky-950/90 dark:text-sky-200 sm:bottom-4"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      <span className="min-w-0 flex-1">
        {menyinkron ? 'Menyinkronkan perubahan…' : `${sisa} perubahan menunggu dikirim.`}
      </span>
    </div>
  );
}
