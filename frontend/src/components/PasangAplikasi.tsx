import { useState, useSyncExternalStore } from 'react';
import { Download, Loader2, Smartphone } from 'lucide-react';
import { berlanggananMode, mintaPasang, modeSaatIni, type ModePasang } from '../lib/pasang-aplikasi';

/**
 * Kartu memasang portal ini sebagai aplikasi di HP/laptop (PWA). Peramban yang
 * tidak mendukung pemasangan (Firefox desktop, browser lama) tidak melihat apa
 * pun; Safari Apple mendapat panduan manual karena iOS tidak mengenal
 * beforeinstallprompt.
 */
export default function PasangAplikasi() {
  // Snapshot 'sembunyi' saat build/prerender: mode hanya boleh dibaca di klien.
  const mode = useSyncExternalStore(berlanggananMode, modeSaatIni, () => 'sembunyi' as ModePasang);
  const [sibuk, setSibuk] = useState(false);
  const [bukaPanduan, setBukaPanduan] = useState(false);

  if (mode === 'sembunyi') return null;

  const pasang = async () => {
    setSibuk(true);
    try {
      await mintaPasang();
    } catch (error) {
      console.error('Pemasangan aplikasi gagal:', error);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl text-left">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-gray-900">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">Pasang sebagai aplikasi</p>
            <p className="text-xs text-white/80">
              Ikon di layar utama, tetap bisa dibaca tanpa kuota, dan ada notifikasi kegiatan.
            </p>
          </div>
        </div>

        {mode === 'otomatis' ? (
          <button
            type="button"
            onClick={pasang}
            disabled={sibuk}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-400 px-5 py-2.5 text-sm font-bold text-gray-900 transition-all duration-300 hover:bg-amber-300 hover:scale-105 active:scale-95 disabled:opacity-70 sm:w-auto"
          >
            {sibuk ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Pasang aplikasi
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setBukaPanduan((buka) => !buka)}
            aria-expanded={bukaPanduan}
            aria-controls="panduan-pasang-ios"
            className="w-full rounded-lg border border-amber-300 bg-amber-400 px-5 py-2.5 text-sm font-bold text-gray-900 transition-all duration-300 hover:bg-amber-300 hover:scale-105 active:scale-95 sm:w-auto"
          >
            Cara pasang di iPhone/iPad
          </button>
        )}
      </div>

      {mode === 'manual' && bukaPanduan && (
        <ol
          id="panduan-pasang-ios"
          className="mt-3 list-decimal space-y-1 rounded-xl bg-black/30 px-6 py-4 text-xs text-white/90"
        >
          <li>Buka halaman ini di Safari.</li>
          <li>
            Ketuk ikon <span className="font-bold">Bagikan</span> di bar bawah.
          </li>
          <li>
            Pilih <span className="font-bold">Add to Home Screen</span> (Tambah ke Layar Utama), lalu
            Ketuk.
          </li>
        </ol>
      )}
    </div>
  );
}
