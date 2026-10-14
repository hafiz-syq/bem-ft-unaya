import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { MessageSquare, Search, Loader2 } from 'lucide-react';

interface PublicComment {
  id: string; nama: string; asal_kampus: string; email: string; no_hp: string; content: string; createdAt: string;
}

export default function PublicCommentsAdmin() {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/public-comments')
      .then(res => setComments(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = comments.filter(c => c.nama.toLowerCase().includes(search.toLowerCase()) || c.content.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6">
      <div className="flex items-center justify-between p-6 bg-white border shadow-sm rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><MessageSquare className="w-6 h-6 text-amber-500"/> Buku Tamu / Suara Publik</h1>
          <p className="mt-1 text-sm text-gray-500">Lihat pesan dan kritik dari masyarakat luar.</p>
        </div>
        <div className="relative">
          <Search className="absolute w-4 h-4 text-gray-400 left-3 top-3"/>
          <input type="text" placeholder="Cari pesan..." className="py-2 pr-4 border rounded-lg outline-none pl-9 focus:ring-2 focus:ring-amber-500" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="overflow-hidden bg-white border shadow-sm rounded-xl">
        {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500"/></div>
        : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs font-bold text-gray-700 uppercase border-b bg-gray-50">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Pengirim</th>
                <th className="px-6 py-4">Kontak</th>
                <th className="px-6 py-4">Isi Pesan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{new Date(c.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{c.nama} <br/><span className="text-xs font-normal text-gray-500">{c.asal_kampus}</span></td>
                  <td className="px-6 py-4">{c.email} <br/><span className="text-gray-500">{c.no_hp}</span></td>
                  <td className="max-w-xs px-6 py-4 text-gray-600">{c.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}