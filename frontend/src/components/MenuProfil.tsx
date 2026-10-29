import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Mail, KeyRound } from 'lucide-react';
import { assetUrl } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

/**
 * Menu profil untuk header halaman publik.
 *
 * Setelah login, tombol "Ke Dashboard" diganti avatar akun. Klik avatar membuka
 * daftar pilihan tepat di bawahnya — tanpa lapisan gelap/blur di belakang, jadi
 * pengunjung tetap bisa membaca halaman sambil memilih menu.
 *
 * Menu ditutup saat klik di luar, tombol Escape, atau setelah salah satu
 * pilihan dipilih. Fokus kembali ke avatar agar pengguna keyboard tidak
 * kehilangan posisi.
 */
export default function MenuProfil() {
  const { user } = useAuth();
  const [buka, setBuka] = useState(false);
  const wadahRef = useRef<HTMLDivElement>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  useEffect(() => {
    if (!buka) return;

    const klikDiLuar = (e: PointerEvent) => {
      if (!wadahRef.current?.contains(e.target as Node)) setBuka(false);
    };
    const tekanEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setBuka(false);
      tombolRef.current?.focus();
    };

    document.addEventListener('pointerdown', klikDiLuar);
    document.addEventListener('keydown', tekanEscape);
    return () => {
      document.removeEventListener('pointerdown', klikDiLuar);
      document.removeEventListener('keydown', tekanEscape);
    };
  }, [buka]);

  // Fokuskan pilihan pertama supaya menu bisa langsung dipakai dengan keyboard.
  useEffect(() => {
    if (!buka) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [buka]);

  if (!user) return null;

  const nama = (user.nama || user.nim || '').trim();
  const inisial = nama.slice(0, 2).toUpperCase() || '?';

  const pilihan = [
    { ke: '/dashboard', label: 'Ke Dashboard', ikon: LayoutDashboard },
    { ke: '/profile?bagian=email', label: 'Ubah Email', ikon: Mail },
    { ke: '/profile?bagian=sandi', label: 'Ganti Sandi', ikon: KeyRound },
  ] as const;

  return (
    <div ref={wadahRef} className="relative shrink-0">
      <button
        ref={tombolRef}
        type="button"
        onClick={() => setBuka((sebelumnya) => !sebelumnya)}
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-controls={buka ? idMenu : undefined}
        aria-label={nama ? `Menu akun ${nama}` : 'Menu akun'}
        title={nama ? `Menu akun ${nama}` : 'Menu akun'}
        className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-xs font-black text-amber-700 ring-2 transition dark:bg-amber-900/50 dark:text-amber-300 ${
          buka
            ? 'ring-amber-400'
            : 'ring-transparent hover:ring-amber-300 focus-visible:ring-amber-500'
        } focus:outline-none`}
      >
        {user.foto ? (
          <img src={assetUrl(user.foto)} alt={nama} className="object-cover w-full h-full" />
        ) : (
          inisial
        )}
      </button>

      {buka && (
        <div
          ref={menuRef}
          id={idMenu}
          role="menu"
          aria-label="Menu akun"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          {pilihan.map(({ ke, label, ikon: Ikon }) => (
            <Link
              key={ke}
              to={ke}
              role="menuitem"
              onClick={() => setBuka(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-amber-50 hover:text-amber-600 focus:bg-amber-50 focus:text-amber-600 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:bg-gray-800 dark:hover:text-amber-300"
            >
              <Ikon className="w-4 h-4 shrink-0 text-amber-500" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
