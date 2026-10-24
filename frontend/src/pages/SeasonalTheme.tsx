import { useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Flag, Loader2, Lock, MoonStar, Palette, PartyPopper, Save, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSeasonalTheme } from '../contexts/SeasonalThemeContext';
import { ROLE_SUPERADMIN } from '../lib/roles';
import {
  CONTOH_WARNA, KETERANGAN_TEMA, LABEL_TEMA, type TemaMusiman,
} from '../lib/tema-musiman';

const IKON: Record<TemaMusiman, typeof Palette> = {
  NONE: Sparkles,
  RAMADAN: MoonStar,
  LEBARAN: PartyPopper,
  NUSANTARA: Flag,
};

/**
 * Halaman pengaturan tema musiman — hanya SUPERADMIN.
 *
 * Tema berlaku untuk semua pengunjung, jadi pilihan disimpan di server, bukan
 * di browser. Perubahan langsung dipakai halaman lain setelah disimpan.
 */
export default function SeasonalTheme() {
  const { user, loading } = useAuth();
  const { tema, simpanTema, menyimpan } = useSeasonalTheme();

  const [pilihan, setPilihan] = useState<TemaMusiman>(tema);
  const [pesan, setPesan] = useState('');
  const [galat, setGalat] = useState('');

  // Server bisa saja sudah mengirim tema sebelum halaman ini dibuka.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- menyelaraskan pilihan dengan tema aktif
    setPilihan(tema);
  }, [tema]);

  const apakahSuperadmin = user?.role === ROLE_SUPERADMIN;

  const simpan = async () => {
    setPesan('');
    setGalat('');
    try {
      const hasil = await simpanTema(pilihan);
      setPesan(hasil);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setGalat(err.response?.data?.message || 'Gagal menyimpan tema musiman.');
      } else {
        setGalat('Terjadi kesalahan yang tidak terduga.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!apakahSuperadmin) {
    return (
      <div className="max-w-2xl p-6 mx-auto md:p-8">
        <div className="flex items-start gap-3 p-5 border border-gray-200 rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800">
          <Lock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <h1 className="font-bold text-gray-900 dark:text-gray-100">Khusus Superadmin</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tema musiman berlaku untuk seluruh pengunjung situs, sehingga hanya
              superadmin yang dapat mengubahnya.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl p-6 mx-auto space-y-6 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Palette className="w-6 h-6 text-amber-400" /> Tema Musiman
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pilih suasana situs untuk bulan tertentu. Tema aktif terlihat oleh semua
          pengunjung — halaman depan, dashboard, dan dialog profil ikut berubah aksen.
        </p>
      </div>

      {pesan && (
        <div className="flex items-center gap-2 p-4 text-sm font-medium text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300" role="status">
          <Check className="w-4 h-4 shrink-0" /> {pesan}
        </div>
      )}
      {galat && (
        <div className="p-4 text-sm font-medium text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300" role="alert">
          {galat}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(['NONE', 'RAMADAN', 'LEBARAN', 'NUSANTARA'] as TemaMusiman[]).map((nilai) => {
          const Ikon = IKON[nilai];
          const warna = CONTOH_WARNA[nilai];
          const dipilih = pilihan === nilai;
          const aktif = tema === nilai;

          return (
            <button
              key={nilai}
              type="button"
              onClick={() => { setPilihan(nilai); setPesan(''); setGalat(''); }}
              aria-pressed={dipilih}
              className={`overflow-hidden text-left transition rounded-2xl border-2 bg-white dark:bg-gray-900 ${
                dipilih
                  ? 'border-amber-400 shadow-lg ring-2 ring-amber-100 dark:ring-amber-900/40'
                  : 'border-gray-200 hover:border-amber-300 dark:border-gray-800 dark:hover:border-amber-800'
              }`}
            >
              <div
                className="relative flex items-center justify-between h-20 px-5"
                style={{ backgroundImage: `linear-gradient(120deg, ${warna.kedua}, ${warna.utama})` }}
              >
                <div className="flex items-center gap-2.5 text-white">
                  <span className="flex items-center justify-center w-9 h-9 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Ikon className="w-5 h-5" />
                  </span>
                  <span className="text-lg font-black drop-shadow-sm">{LABEL_TEMA[nilai]}</span>
                </div>
                {aktif && (
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-white rounded-full text-gray-900">
                    Sedang aktif
                  </span>
                )}
              </div>

              <div className="p-4">
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {KETERANGAN_TEMA[nilai]}
                </p>
                <div className="flex items-center gap-1.5 mt-3">
                  {[warna.utama, warna.kedua, warna.ketiga].map((w) => (
                    <span
                      key={w}
                      className="w-5 h-5 border border-black/10 rounded-full"
                      style={{ backgroundColor: w }}
                      aria-hidden="true"
                    />
                  ))}
                  <span className={`ml-auto inline-flex items-center gap-1 text-xs font-bold ${dipilih ? 'text-amber-600 dark:text-amber-300' : 'text-gray-400'}`}>
                    {dipilih ? <><Check className="w-3.5 h-3.5" /> Dipilih</> : 'Pilih'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 p-4 border border-gray-200 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Setiap perubahan dicatat di Audit Log, termasuk siapa yang menggantinya.
        </p>
        <button
          type="button"
          onClick={simpan}
          disabled={menyimpan || pilihan === tema}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {menyimpan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {pilihan === tema ? 'Tema sudah aktif' : 'Simpan tema'}
        </button>
      </div>
    </div>
  );
}
