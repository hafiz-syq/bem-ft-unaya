import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { api, assetUrl } from '../lib/axios';
import { Loader2, MessageSquare, Send, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABEL } from '../lib/roles';

/**
 * Komentar untuk satu postingan galeri.
 *
 * Dipakai bersama oleh halaman /gallery dan modal galeri di landing, supaya
 * tampilan serta aturannya (baca & tulis publik, tampil setelah ditinjau) tidak
 * berbeda di dua tempat. Tamu mengisi nama sendiri; pengguna login memakai
 * identitas akunnya.
 */

interface Komentar {
  id: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  penulis: string;
  role: string;
  foto: string | null;
}

export default function GalleryComments({ galleryId }: { galleryId: string }) {
  const { user } = useAuth();

  const [komentar, setKomentar] = useState<Komentar[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [isi, setIsi] = useState('');
  const [nama, setNama] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [pesan, setPesan] = useState('');
  const [galat, setGalat] = useState('');

  // Pemanggil memberi `key={galleryId}` sehingga state di atas otomatis bersih
  // setiap kali postingan yang dibuka berganti.
  useEffect(() => {
    let aktif = true;

    (async () => {
      try {
        const res = await api.get(`/cms/galleries/${galleryId}/comments`);
        if (aktif) setKomentar(res.data.data);
      } catch (err) {
        console.error('Gagal memuat komentar galeri:', err);
        if (aktif) setGalat('Komentar gagal dimuat. Coba tutup dan buka lagi.');
      } finally {
        if (aktif) setMemuat(false);
      }
    })();

    return () => { aktif = false; };
  }, [galleryId]);

  const kirimKomentar = async (e: React.FormEvent) => {
    e.preventDefault();

    const isiBersih = isi.trim();
    const namaBersih = nama.trim();
    if (!isiBersih) return;

    if (!user && namaBersih.length < 2) {
      setGalat('Nama wajib diisi minimal 2 karakter.');
      return;
    }

    setMengirim(true);
    setGalat('');
    setPesan('');
    try {
      const res = await api.post(
        `/cms/galleries/${galleryId}/comments`,
        user ? { content: isiBersih } : { content: isiBersih, nama: namaBersih }
      );
      setPesan(res.data.message || 'Komentar terkirim dan menunggu tinjauan.');
      setIsi('');
    } catch (err) {
      setGalat(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Gagal mengirim komentar.'
          : 'Gagal mengirim komentar.'
      );
    } finally {
      setMengirim(false);
    }
  };

  return (
    <div className="bg-gray-950 border-t border-gray-800">
      <div className="flex items-center gap-2 px-5 pt-4 text-sm font-bold text-white sm:px-6">
        <MessageSquare className="w-4 h-4 text-amber-400" />
        Komentar {komentar.length > 0 && <span className="text-gray-400">({komentar.length})</span>}
      </div>

      <div className="px-5 py-3 space-y-3 overflow-y-auto max-h-64 sm:px-6">
        {memuat ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-amber-400 animate-spin" /></div>
        ) : komentar.length === 0 ? (
          <p className="text-xs text-gray-500">Belum ada komentar yang tayang. Jadilah yang pertama!</p>
        ) : (
          komentar.map((k) => (
            <div key={k.id} className="flex gap-3">
              <div className="flex items-center justify-center w-8 h-8 overflow-hidden text-[10px] font-bold text-gray-900 bg-amber-400 rounded-full shrink-0">
                {k.foto ? <img src={assetUrl(k.foto)} alt={k.penulis} className="object-cover w-full h-full" /> : k.penulis.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">
                  {k.penulis}
                  <span className="ml-2 font-medium text-gray-500">{ROLE_LABEL[k.role] ?? k.role}</span>
                  <span className="ml-2 font-normal text-gray-600">{new Date(k.createdAt).toLocaleDateString('id-ID')}</span>
                </p>
                <p className="mt-0.5 text-sm text-gray-300 break-words whitespace-pre-line">{k.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {galat && <p className="px-5 text-xs text-red-400 sm:px-6">{galat}</p>}
      {pesan && <p className="px-5 text-xs text-green-400 sm:px-6">{pesan}</p>}

      <div className="p-4 sm:px-6 sm:pb-5">
        <form onSubmit={kirimKomentar} className="space-y-2">
          {!user && (
            <input
              type="text"
              value={nama}
              maxLength={60}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Anda"
              aria-label="Nama Anda"
              autoComplete="name"
              className="w-full px-3 py-2 text-sm text-white bg-gray-900 border border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={isi}
              maxLength={2000}
              onChange={(e) => setIsi(e.target.value)}
              placeholder="Tulis komentar..."
              aria-label="Tulis komentar"
              className="flex-1 px-3 py-2 text-sm text-white bg-gray-900 border border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={mengirim || !isi.trim() || (!user && nama.trim().length < 2)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-gray-900 transition rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mengirim ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim
            </button>
          </div>
        </form>
        <p className="mt-2 text-[11px] text-gray-500">
          {user ? (
            'Komentar tampil setelah ditinjau admin/pengurus.'
          ) : (
            <>
              Komentar tamu tampil setelah ditinjau admin/pengurus. Sudah punya akun?{' '}
              <Link to="/login" className="inline-flex items-center gap-1 font-bold text-amber-400 hover:underline">
                <LogIn className="w-3 h-3" /> Masuk
              </Link>{' '}
              agar komentar memakai nama akun.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
