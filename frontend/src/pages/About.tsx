import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import {
  Users, Loader2, Code2, ArrowLeft, Building2, X, Hash, GraduationCap,
  BookOpen, CalendarDays, Briefcase, ShieldCheck, Phone
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

interface OfficerUser {
  id: string;
  nim: string;
  foto: string | null;
  angkatan: number | null;
  profile: { nama: string; program_studi: string; no_hp: string | null } | null;
}
interface Position {
  id: string;
  user: OfficerUser;
}
interface PositionSlot {
  id: string;
  title: string;
  department: { name: string } | null;
  positions: Position[];
}
interface Organization {
  id: string;
  name: string;
  positionSlots: PositionSlot[];
}

/** Biodata yang ditampilkan saat card pengurus diklik. Email sengaja dikecualikan. */
interface KartuPengurus {
  nama: string;
  nim: string;
  foto: string | null;
  program_studi: string;
  no_hp: string | null;
  angkatan: number | null;
  jabatan: string;
  organisasi: string;
  divisi: string | null;
}

export default function About() {
  const [structure, setStructure] = useState<Organization[]>([]);
  const [settings, setSettings] = useState({ visi: '', misi: '' });
  const [loading, setLoading] = useState(true);
  const [kartu, setKartu] = useState<KartuPengurus | null>(null);

  useEffect(() => {
    Promise.all([api.get('/cms/structure'), api.get('/cms/settings')])
      .then(([resStructure, resSettings]) => {
        setStructure(resStructure.data.data);
        setSettings({ visi: resSettings.data.data.visi || '', misi: resSettings.data.data.misi || '' });
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const butirMisi = settings.misi
    .split('\n')
    .map((baris) => baris.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen font-sans bg-gray-50 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform rounded-lg shadow-lg bg-amber-400 group-hover:scale-95"><Code2 className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-gray-900 dark:text-gray-100">BEM FT UNAYA</h1><p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Portal Resmi</p></div>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/demisioner" className="hidden text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors sm:block hover:text-amber-400">Riwayat Demisioner</Link>
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors hover:text-amber-400"><ArrowLeft className="w-4 h-4" /> Kembali</Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl px-6 py-12 mx-auto space-y-16">
        <section className="max-w-3xl mx-auto space-y-6 text-center">
          <h2 className="text-4xl font-black text-gray-900 dark:text-gray-100">Tentang Kami</h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Badan Eksekutif Mahasiswa Fakultas Teknik Universitas Abulyatama (BEM-FT UNAYA) adalah lembaga eksekutif tertinggi di tingkat fakultas yang mewadahi seluruh aspirasi, inovasi, dan pergerakan mahasiswa teknik.
          </p>
          <div className="grid gap-6 pt-6 text-left md:grid-cols-2">
            <div className="p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-2xl">
              <h3 className="mb-3 text-xl font-bold text-amber-400">Visi</h3>
              <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                {settings.visi || 'Visi kepengurusan belum ditetapkan.'}
              </p>
            </div>
            <div className="p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-2xl">
              <h3 className="mb-3 text-xl font-bold text-amber-400">Misi</h3>
              {butirMisi.length === 0 ? (
                <p className="italic text-gray-400 dark:text-gray-500">Misi kepengurusan belum ditetapkan.</p>
              ) : (
                <ul className="space-y-2 text-gray-600 dark:text-gray-400 list-disc list-inside">
                  {butirMisi.map((butir, i) => <li key={i}>{butir}</li>)}
                </ul>
              )}
            </div>
          </div>
          <p className="pt-2 text-xs text-gray-400 dark:text-gray-500">
            Visi &amp; misi diperbarui oleh admin setiap pergantian kepengurusan.
          </p>
        </section>

        <section>
          <div className="mb-10 text-center">
            <h2 className="flex items-center justify-center gap-3 text-3xl font-black text-gray-900 dark:text-gray-100"><Users className="w-8 h-8 text-amber-400" /> Struktur Kepengurusan</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Klik salah satu card untuk melihat biodata dan foto profil pengurus.
            </p>
          </div>

          {loading ? <div className="flex justify-center py-10"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>
            : structure.length === 0 ? <div className="p-12 font-medium text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">Struktur belum dikonfigurasi.</div>
              : <div className="space-y-12">
                {structure.map((org) => (
                  <div key={org.id} className="p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-3xl">
                    <h3 className="flex items-center gap-2 pb-4 mb-8 text-2xl font-black text-gray-900 dark:text-gray-100 border-b-2 border-gray-100 dark:border-gray-800"><Building2 className="w-6 h-6 text-amber-400" /> {org.name}</h3>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                      {org.positionSlots?.map((slot) => {
                        const activeUser = slot.positions?.[0]?.user;
                        if (!activeUser) return null;
                        const nama = activeUser.profile?.nama || activeUser.nim;

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setKartu({
                              nama,
                              nim: activeUser.nim,
                              foto: activeUser.foto,
                              program_studi: activeUser.profile?.program_studi || '-',
                              no_hp: activeUser.profile?.no_hp ?? null,
                              angkatan: activeUser.angkatan,
                              jabatan: slot.title,
                              organisasi: org.name,
                              divisi: slot.department?.name ?? null,
                            })}
                            className="p-6 text-center transition-all border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                          >
                            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 overflow-hidden text-2xl font-black text-white rounded-full shadow-lg bg-amber-400 ring-4 ring-amber-50 dark:ring-amber-900/50">
                              {activeUser.foto ? (
                                <img src={assetUrl(activeUser.foto)} alt={nama} className="object-cover w-full h-full" />
                              ) : (
                                nama.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <h4 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{nama}</h4>
                            <p className="text-xs font-bold tracking-widest uppercase text-amber-400">{slot.title}</p>
                            {slot.department?.name && (
                              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{slot.department.name}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>}
        </section>
      </main>

      {/* MODAL BIODATA PENGURUS (tanpa email) */}
      {kartu && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setKartu(null)}>
          <div className="relative w-full max-w-md overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setKartu(null)} className="absolute z-10 p-2 text-gray-500 dark:text-gray-400 transition rounded-full top-4 right-4 bg-white/70 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400">
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center px-8 py-10 text-center text-white bg-gradient-to-br from-amber-400 to-orange-400">
              <div className="flex items-center justify-center w-28 h-28 mb-4 overflow-hidden text-3xl font-black text-amber-500 bg-white dark:bg-gray-900 rounded-full shadow-xl ring-4 ring-white/40">
                {kartu.foto ? (
                  <img src={assetUrl(kartu.foto)} alt={kartu.nama} className="object-cover w-full h-full" />
                ) : (
                  kartu.nama.substring(0, 2).toUpperCase()
                )}
              </div>
              <h3 className="text-xl font-black">{kartu.nama}</h3>
              <p className="mt-1 text-sm font-bold text-white/90">{kartu.jabatan}</p>
              <p className="text-xs text-amber-100">{kartu.divisi ? `${kartu.divisi} • ` : ''}{kartu.organisasi}</p>
            </div>

            <div className="p-6 space-y-4">
              {[
                { label: 'Nama Lengkap', value: kartu.nama, icon: Users },
                { label: 'NIM', value: kartu.nim, icon: Hash },
                { label: 'Program Studi', value: kartu.program_studi, icon: BookOpen },
                { label: 'Tahun Angkatan', value: kartu.angkatan ? String(kartu.angkatan) : '-', icon: CalendarDays },
                { label: 'No. HP', value: kartu.no_hp || '-', icon: Phone },
                { label: 'Jabatan', value: `${kartu.jabatan} — ${kartu.organisasi}`, icon: Briefcase },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-amber-50 dark:bg-amber-950/60">
                      <Icon className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{row.label}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 break-words">{row.value}</p>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-start gap-2 p-3 text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800">
                <ShieldCheck className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                <span>Email pribadi pengurus tidak ditampilkan demi menjaga privasi.</span>
              </div>
              <p className="flex items-center justify-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                <GraduationCap className="w-3.5 h-3.5" /> Data berasal dari profil resmi pengurus.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
