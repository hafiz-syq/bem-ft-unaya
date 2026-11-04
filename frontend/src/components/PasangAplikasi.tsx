import { useState, useSyncExternalStore } from 'react';
import { Download, Loader2, Smartphone } from 'lucide-react';
import { berlanggananMode, mintaPasang, modeSaatIni, type ModePasang } from '../lib/pasang-aplikasi';

/**
 * Baris "pasang sebagai aplikasi" (PWA) di menu notifikasi, khusus pengguna
 * yang punya akun. Peramban yang tidak mendukung pemasangan (Firefox desktop,
 * browser lama) tidak melihat apa pun; Safari Apple mendapat panduan manual
 * karena iOS tidak mengenal beforeinstallprompt.
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

  const gayaTombol =
    'flex w-full items-center gap-2 px-2 py-2 text-xs font-bold rounded-lg transition disabled:opacity-50 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/60';

  return (
    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
      {mode === 'otomatis' ? (
        <button type="button" onClick={pasang} disabled={sibuk} className={gayaTombol}>
          {sibuk ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          Pasang sebagai aplikasi
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setBukaPanduan((buka) => !buka)}
          aria-expanded={bukaPanduan}
          aria-controls="panduan-pasang-ios"
          className={gayaTombol}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Cara pasang di iPhone/iPad
        </button>
      )}

      {mode === 'manual' && bukaPanduan && (
        <ol
          id="panduan-pasang-ios"
          className="mt-2 list-decimal space-y-1 rounded-lg bg-gray-50 px-4 py-2 text-[10px] leading-snug text-gray-600 dark:bg-gray-800 dark:text-gray-300"
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

      <p className="mt-1 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
        Ikon di layar utama, tetap bisa dibaca tanpa kuota, dan ada notifikasi kegiatan.
      </p>
    </div>
  );
}
