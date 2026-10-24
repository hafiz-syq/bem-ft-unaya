import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { api } from '../lib/axios';
import { temaDikenal, type TemaMusiman } from '../lib/tema-musiman';

/**
 * Tema musiman yang berlaku untuk SELURUH pengunjung.
 *
 * Nilainya disimpan di server (SiteSetting `tema_musiman`) dan hanya dapat
 * diubah SUPERADMIN. Salinan terakhir juga disimpan di localStorage supaya
 * warna musiman sudah terpasang sebelum React dimuat (lihat skrip di
 * index.html) dan tidak ada kilatan warna saat berpindah halaman.
 */
const KUNCI_SIMPANAN = 'tema-musiman';

interface NilaiTemaMusiman {
  tema: TemaMusiman;
  /** Menyimpan tema baru ke server; melempar Error berisi pesan siap tampil. */
  simpanTema: (tema: TemaMusiman) => Promise<string>;
  menyimpan: boolean;
}

const SeasonalThemeContext = createContext<NilaiTemaMusiman | undefined>(undefined);

function bacaSimpanan(): TemaMusiman {
  try {
    const nilai = localStorage.getItem(KUNCI_SIMPANAN);
    return temaDikenal(nilai) ? nilai : 'NONE';
  } catch {
    return 'NONE';
  }
}

function tulisSimpanan(tema: TemaMusiman): void {
  try {
    if (tema === 'NONE') localStorage.removeItem(KUNCI_SIMPANAN);
    else localStorage.setItem(KUNCI_SIMPANAN, tema);
  } catch {
    // Penyimpanan diblokir: tema tetap berlaku untuk sesi ini.
  }
}

function pasangAtribut(tema: TemaMusiman): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (tema === 'NONE') html.removeAttribute('data-musim');
  else html.setAttribute('data-musim', tema);
}

export function SeasonalThemeProvider({ children }: { children: ReactNode }) {
  // 'NONE' pada render pertama supaya hasil hidrasi sama dengan markup
  // prerender; tema tersimpan dibaca setelah komponen terpasang.
  const [tema, setTema] = useState<TemaMusiman>('NONE');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    const tersimpan = bacaSimpanan();
    pasangAtribut(tersimpan);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi dari penyimpanan browser
    setTema(tersimpan);

    let aktif = true;
    (async () => {
      try {
        const res = await api.get('/site-theme');
        const dariServer = res.data?.data?.tema;
        if (aktif && temaDikenal(dariServer)) {
          setTema(dariServer);
          tulisSimpanan(dariServer);
          pasangAtribut(dariServer);
        }
      } catch {
        // Offline atau server belum siap: tema tersimpan tetap dipakai.
      }
    })();

    return () => { aktif = false; };
  }, []);

  const simpanTema = useCallback(async (baru: TemaMusiman): Promise<string> => {
    setMenyimpan(true);
    try {
      const res = await api.put('/site-theme', { tema: baru });
      setTema(baru);
      tulisSimpanan(baru);
      pasangAtribut(baru);
      return res.data?.message || 'Tema musiman disimpan.';
    } finally {
      setMenyimpan(false);
    }
  }, []);

  const nilai = useMemo(() => ({ tema, simpanTema, menyimpan }), [tema, simpanTema, menyimpan]);

  return (
    <SeasonalThemeContext.Provider value={nilai}>
      {children}
    </SeasonalThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSeasonalTheme = (): NilaiTemaMusiman => {
  const context = useContext(SeasonalThemeContext);
  if (context === undefined) {
    throw new Error('useSeasonalTheme harus digunakan di dalam SeasonalThemeProvider');
  }
  return context;
};
