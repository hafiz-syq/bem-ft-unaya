import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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

function bacaDariStorage(): Tema | null {
  try {
    const dariLocal = localStorage.getItem(KUNCI_TEMA);
    if (dariLocal === 'dark' || dariLocal === 'light') return dariLocal;
  } catch {
    // localStorage tidak tersedia, lanjutkan ke cookie.
  }

  try {
    const dariCookie = bacaCookie(KUNCI_COOKIE);
    if (dariCookie === 'dark' || dariCookie === 'light') return dariCookie;
  } catch {
    // Cookie tidak tersedia.
  }

  return sistemGelap() ? 'dark' : 'light';
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pilihanAwal, setPilihanAwal] = useState<Tema | null>(bacaDariStorage);
  const [temaSistem, setTemaSistem] = useState<Tema>(() => (sistemGelap() ? 'dark' : 'light'));
  const [gagalSimpan, setGagalSimpan] = useState(false);

  const tema = pilihanAwal ?? temaSistem;

  useEffect(() => {
    terapkan(tema);
  }, [tema]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const dengar = (e: MediaQueryListEvent) => setTemaSistem(e.matches ? 'dark' : 'light');
    media.addEventListener('change', dengar);
    return () => media.removeEventListener('change', dengar);
  }, []);

  const setTema = useCallback((baru: Tema) => {
    setPilihanAwal(baru);
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
    setGagalSimpan(!berhasil);
    terapkan(baru);
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
