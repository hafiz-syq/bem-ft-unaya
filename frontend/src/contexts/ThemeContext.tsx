import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

type Tema = 'light' | 'dark';

const KUNCI_TEMA = 'tema';
const KUNCI_COOKIE = 'tema_bemft';

interface NilaiTema {
  tema: Tema;
  pilihanAwal: Tema | null;
  setTema: (tema: Tema) => void;
  gantiTema: () => void;
  gagalSimpan: boolean;
}

const ThemeContext = createContext<NilaiTema | undefined>(undefined);

function sistemGelap(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function bacaCookie(name: string): string | null {
  const sama = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return sama ? sama[2] : null;
}

function tulisCookie(name: string, value: string, hari: number) {
  const kadaluarsa = new Date();
  kadaluarsa.setTime(kadaluarsa.getTime() + hari * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${kadaluarsa.toUTCString()}; path=/; SameSite=Lax`;
}

function terapkan(tema: Tema) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.toggle('dark', tema === 'dark');
  html.style.colorScheme = tema;
}

function hapusCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// === Toko tema (langganan eksternal) ========================================
// Tema adalah "external store": penyimpanannya berada di luar React
// (localStorage, cookie, preferensi sistem). Pembacaannya dipasangkan lewat
// useSyncExternalStore sehingga:
// - render pertama klien memakai SNAPSHOT SERVER ('light') yang sama dengan
//   hasil prerender — tidak ada ketidakcocokan hidrasi (React #418);
// - perubahan matchMedia/storage dipantau lewat langganan, bukan setState di
//   dalam effect (lint react-hooks/set-state-in-effect).

const pendengarTema = new Set<() => void>();
const beriGantiTema = () => pendengarTema.forEach((p) => p());

/** Nilai pilihan pengguna yang tersimpan eksplisit (localStorage → cookie). */
function bacaPilihanTersimpan(): Tema | null {
  try {
    const dariLocal = localStorage.getItem(KUNCI_TEMA);
    if (dariLocal === 'dark' || dariLocal === 'light') return dariLocal;
  } catch {
    // localStorage tidak tersedia (prerender / blokir), lanjut ke cookie.
  }
  try {
    const dariCookie = bacaCookie(KUNCI_COOKIE);
    if (dariCookie === 'dark' || dariCookie === 'light') return dariCookie;
  } catch {
    // document tidak tersedia (prerender di Node).
  }
  return null;
}

/** Tema efektif untuk sekarang: pilihan pengguna bila ada, bila tidak sistem. */
function temSaIni(): Tema {
  return bacaPilihanTersimpan() ?? (sistemGelap() ? 'dark' : 'light');
}

// Catatan kegagalan simpan terakhir (dipantau lewat toko yang sama).
let gagalSimpanToko = false;
const bacaGagalSimpan = (): boolean => gagalSimpanToko;

function langgananTema(pemberitahu: () => void): () => void {
  pendengarTema.add(pemberitahu);

  if (typeof window === 'undefined') {
    return () => pendengarTema.delete(pemberitahu);
  }

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', pemberitahu);
  window.addEventListener('storage', pemberitahu);

  return () => {
    pendengarTema.delete(pemberitahu);
    media?.removeEventListener?.('change', pemberitahu);
    window.removeEventListener('storage', pemberitahu);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Snapshot server sengaja 'light' dan identik dengan render hasil prerender.
  const tema = useSyncExternalStore(langgananTema, temSaIni, () => 'light' as Tema);
  const pilihanAwal = useSyncExternalStore(langgananTema, bacaPilihanTersimpan, () => null);
  const gagalSimpan = useSyncExternalStore(langgananTema, bacaGagalSimpan, () => false);

  useEffect(() => {
    terapkan(tema);
  }, [tema]);

  const setTema = useCallback((baru: Tema) => {
    let berhasil = false;
    try {
      localStorage.setItem(KUNCI_TEMA, baru);
      // Cookie lama (dari saat localStorage tidak tersedia) dibersihkan supaya
      // tidak menimpa pilihan baru saat dibaca ulang.
      try {
        hapusCookie(KUNCI_COOKIE);
      } catch {
        // Cookie tidak tersedia; pilihan sudah tersimpan di localStorage.
      }
      berhasil = true;
    } catch {
      // localStorage diblokir (mode privat/kebijakan browser); pakai cookie.
    }

    if (!berhasil) {
      try {
        tulisCookie(KUNCI_COOKIE, baru, 365);
        berhasil = true;
      } catch {
        // Cookie pun tidak bisa ditulis; tema tetap berlaku untuk sesi ini.
      }
    }
    gagalSimpanToko = !berhasil;
    // Beri tahu langganan: React membaca ulang snapshot dan merender ulang.
    beriGantiTema();
  }, []);

  const gantiTema = useCallback(() => {
    const baru: Tema = tema === 'dark' ? 'light' : 'dark';
    setTema(baru);
  }, [tema, setTema]);

  return (
    <ThemeContext.Provider value={{ tema, pilihanAwal, setTema, gantiTema, gagalSimpan }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Bypass error vite fast-refresh untuk export fungsi non-komponen
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = (): NilaiTema => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme harus digunakan di dalam ThemeProvider');
  }
  return context;
};
