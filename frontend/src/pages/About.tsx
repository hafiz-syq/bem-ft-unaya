import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { Users, Loader2, Code2, ArrowLeft, Building2 } from 'lucide-react';

// Mendefinisikan tipe data yang jelas agar TypeScript bahagia
interface UserProfile {
  nama: string;
}
interface User {
  nim: string;
  profile: UserProfile | null;
}
interface Position {
  id: string;
  user: User;
}
interface PositionSlot {
  id: string;
  title: string;
  positions: Position[];
}
interface Organization {
  id: string;
  name: string;
  positionSlots: PositionSlot[];
}

export default function About() {
  const [structure, setStructure] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cms/structure')
      .then(res => setStructure(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen font-sans bg-gray-50">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform rounded-lg shadow-lg bg-amber-400 group-hover:scale-95"><Code2 className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-gray-900">BEM FT UNAYA</h1><p className="text-[10px] text-gray-500 font-bold uppercase">Portal Resmi</p></div>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-amber-400"><ArrowLeft className="w-4 h-4"/> Kembali</Link>
      </nav>

      <main className="max-w-5xl px-6 py-12 mx-auto space-y-16">
        <section className="max-w-3xl mx-auto space-y-6 text-center">
          <h2 className="text-4xl font-black text-gray-900">Tentang Kami</h2>
          <p className="text-lg leading-relaxed text-gray-600">
            Badan Eksekutif Mahasiswa Fakultas Teknik Universitas Abulyatama (BEM-FT UNAYA) adalah lembaga eksekutif tertinggi di tingkat fakultas yang mewadahi seluruh aspirasi, inovasi, dan pergerakan mahasiswa teknik.
          </p>
          <div className="grid gap-6 pt-6 text-left md:grid-cols-2">
            <div className="p-8 bg-white border border-gray-100 shadow-sm rounded-2xl">
              <h3 className="mb-3 text-xl font-bold text-amber-400">Visi</h3>
              <p className="text-gray-600">[Placeholder Visi] Menjadikan BEM-FT UNAYA sebagai wadah kolaboratif, inovatif, dan responsif dalam menciptakan mahasiswa teknik yang unggul dan berkarakter.</p>
            </div>
            <div className="p-8 bg-white border border-gray-100 shadow-sm rounded-2xl">
              <h3 className="mb-3 text-xl font-bold text-amber-400">Misi</h3>
              <ul className="space-y-2 text-gray-600 list-disc list-inside">
                <li>[Placeholder Misi 1] Membangun sinergi antar himpunan.</li>
                <li>[Placeholder Misi 2] Menyalurkan aspirasi mahasiswa.</li>
                <li>[Placeholder Misi 3] Mengembangkan potensi akademik dan non-akademik.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-10 text-center">
            <h2 className="flex items-center justify-center gap-3 text-3xl font-black text-gray-900"><Users className="w-8 h-8 text-amber-400"/> Struktur Kepengurusan</h2>
            <p className="mt-2 text-gray-500">Daftar pimpinan dan pengurus aktif BEM-FT UNAYA periode berjalan.</p>
          </div>

          {loading ? <div className="flex justify-center py-10"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>
          : structure.length === 0 ? <div className="p-12 font-medium text-center text-gray-500 bg-white border border-gray-200 rounded-2xl">Struktur belum dikonfigurasi.</div>
          : <div className="space-y-12">
              {structure.map((org) => (
                <div key={org.id} className="p-8 bg-white border border-gray-200 shadow-sm rounded-3xl">
                  <h3 className="flex items-center gap-2 pb-4 mb-8 text-2xl font-black text-gray-900 border-b-2 border-gray-100"><Building2 className="w-6 h-6 text-amber-400"/> {org.name}</h3>
                  
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                    {org.positionSlots?.map((slot) => {
                      const activeUser = slot.positions?.[0]?.user;
                      if (!activeUser) return null;
                      
                      return (
                        <div key={slot.id} className="p-6 text-center transition-transform border border-gray-100 bg-gray-50 rounded-2xl hover:-translate-y-1">
                          <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 text-2xl font-black text-white rounded-full shadow-lg bg-amber-400 ring-4 ring-amber-50">
                            {activeUser.profile?.nama?.substring(0, 2).toUpperCase() || 'NA'}
                          </div>
                          <h4 className="mb-1 text-lg font-bold text-gray-900">{activeUser.profile?.nama || activeUser.nim}</h4>
                          <p className="text-xs font-bold tracking-widest uppercase text-amber-400">{slot.title}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>}
        </section>
      </main>
    </div>
  );
}