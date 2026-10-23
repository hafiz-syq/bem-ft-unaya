import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  X, Loader2, ShieldCheck, ShieldAlert, GraduationCap, IdCard,
  Briefcase, CalendarDays, UserRound, ImageOff,
} from 'lucide-react';
import { api, assetUrl } from '../lib/axios';
import { ROLE_LABEL, isAdminRole, isOfficer } from '../lib/roles';

interface ProfilPublik {
  id: string;
  nim: string;
  role: string;
  isActive: boolean;
  foto: string | null;
  angkatan: number | null;
  bergabung: string | null;
  nama: string | null;
  programStudi: string | null;
  jabatan: { title: string; organisasi: string; divisi: string | null }[];
}

const tanggal = (nilai: string | null): string => {
  if (!nilai) return '-';
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { dateStyle: 'long' });
};

/**
 * Dialog profil publik satu akun.
 *
 * Dibuka dari avatar/nama pengguna di halaman mana pun. Animasi masuk diatur
 * oleh kelas `profil-latar-masuk` dan `profil-kartu-masuk` di index.css, yang
 * otomatis dipangkas bila pengguna memilih "kurangi animasi".
 */
export default function UserProfileDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profil, setProfil] = useState<ProfilPublik | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const tutupRef = useRef<HTMLButtonElement>(null);

  // Dialog selalu dipasang ulang untuk setiap ID (lihat `key` di provider),
  // jadi state awal di atas sudah bersih tanpa perlu mengulang setState.
  useEffect(() => {
    let aktif = true;

    (async () => {
      try {
        const res = await api.get(`/profile/${userId}`);
        if (aktif) setProfil(res.data.data);
      } catch (err) {
        if (!aktif) return;
        if (axios.isAxiosError(err)) {
          setGalat(err.response?.data?.message || 'Profil gagal dimuat.');
        } else {
          setGalat('Terjadi kesalahan yang tidak terduga.');
        }
      } finally {
        if (aktif) setMemuat(false);
      }
    })();

    return () => { aktif = false; };
  }, [userId]);

  // Kunci gulir halaman di belakang dialog dan tangkap tombol Escape.
  useEffect(() => {
    const gulirLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    tutupRef.current?.focus();

    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', padaTombol);

    return () => {
      document.body.style.overflow = gulirLama;
      document.removeEventListener('keydown', padaTombol);
    };
  }, [onClose]);

  const inisial = (profil?.nama || profil?.nim || '?').substring(0, 2).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm profil-latar-masuk"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-profil-pengguna"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden bg-white shadow-2xl profil-kartu-masuk rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
      >
        <div className="h-24 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 dark:from-amber-600 dark:via-amber-700 dark:to-orange-800" />

        <button
          ref={tutupRef}
          type="button"
          onClick={onClose}
          aria-label="Tutup profil"
          className="absolute p-1.5 text-gray-900 transition bg-white/80 rounded-full top-3 right-3 hover:bg-white dark:bg-gray-900/80 dark:text-gray-100 dark:hover:bg-gray-900"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pb-6 -mt-12 text-center">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mx-auto overflow-hidden text-2xl font-black border-4 border-white rounded-full shadow-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 dark:border-gray-900">
            {memuat ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : profil?.foto ? (
              <img
                src={assetUrl(profil.foto)}
                alt={profil.nama || profil.nim}
                className="object-cover w-full h-full"
              />
            ) : (
              inisial
            )}
          </div>

          {memuat ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400" role="status">Memuat profil…</p>
          ) : galat ? (
            <div className="p-3 mt-3 text-sm font-bold text-red-700 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
              {galat}
            </div>
          ) : profil ? (
            <>
              <h2 id="judul-profil-pengguna" className="mt-3 text-xl font-black leading-tight text-gray-900 break-words dark:text-gray-100">
                {profil.nama || 'Tanpa Nama'}
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                  isAdminRole(profil.role)
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : isOfficer(profil.role)
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                }`}>
                  {ROLE_LABEL[profil.role] || profil.role}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full ${
                  profil.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                }`}>
                  {profil.isActive ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                  {profil.isActive ? 'Akun aktif' : 'Akun nonaktif'}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm text-left">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                  <IdCard className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">NIM</dt>
                    <dd className="font-bold text-gray-900 break-all dark:text-gray-100">{profil.nim}</dd>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                  <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Program Studi</dt>
                    <dd className="font-bold text-gray-900 dark:text-gray-100 break-words">{profil.programStudi || '-'}</dd>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                  <UserRound className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Angkatan</dt>
                    <dd className="font-bold text-gray-900 dark:text-gray-100">{profil.angkatan ?? '-'}</dd>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                  <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bergabung sejak</dt>
                    <dd className="font-bold text-gray-900 dark:text-gray-100">{tanggal(profil.bergabung)}</dd>
                  </div>
                </div>

                {profil.jabatan.length > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                    <Briefcase className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Jabatan aktif</dt>
                      <dd className="mt-1 space-y-1">
                        {profil.jabatan.map((j, i) => (
                          <p key={`${j.title}-${i}`} className="text-xs font-bold leading-snug text-gray-900 dark:text-gray-100">
                            {j.title}
                            <span className="block font-medium text-gray-500 dark:text-gray-400">
                              {j.organisasi}{j.divisi ? ` · ${j.divisi}` : ''}
                            </span>
                          </p>
                        ))}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>

              {!profil.foto && (
                <p className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                  <ImageOff className="w-3.5 h-3.5" /> Pengguna ini belum mengunggah foto profil.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
