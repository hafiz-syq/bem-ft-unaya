import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { isAdminRole, isOfficer, ROLE_LABEL } from '../lib/roles';
import {
  Megaphone, Plus, Loader2, X, Trash2, Check, Users, CalendarDays, Building2, Send, Pencil,
} from 'lucide-react';

interface Pengumuman {
  id: string;
  title: string;
  content: string;
  audience: string;
  audienceRole: string | null;
  audienceAngkatan: number | null;
  audienceOrganizationId: string | null;
  isPublished?: boolean;
  createdAt: string;
  penulis?: string;
  dibaca?: boolean;
  jumlahPembaca?: number;
  // Hanya dikirim daftar pembaca biasa; menandai item milik pengurus sendiri.
  punyaSaya?: boolean;
  _count?: { reads: number };
  createdBy?: { nim: string; profile: { nama: string } | null };
}

interface Organisasi {
  id: string;
  name: string;
}

type Segmen = 'SEMUA' | 'ROLE' | 'ANGKATAN' | 'ORGANISASI';

const segmenLabel = (p: Pengumuman) => {
  if (p.audience === 'ROLE') return `Role ${ROLE_LABEL[p.audienceRole || ''] || p.audienceRole}`;
  if (p.audience === 'ANGKATAN') return `Angkatan ${p.audienceAngkatan}`;
  if (p.audience === 'ORGANISASI') return 'Organisasi tertentu';
  return 'Semua pengguna';
};

const tanggal = (nilai: string) =>
  new Date(nilai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function Announcements() {
  const { user } = useAuth();
  const admin = isAdminRole(user?.role);
  // Pengurus (termasuk prodi) boleh membuat; daftar kelola + segmen organisasi tetap admin.
  const bolehTulis = admin || isOfficer(user?.role);

  const [daftar, setDaftar] = useState<Pengumuman[]>([]);
  const [organisasi, setOrganisasi] = useState<Organisasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    audience: 'SEMUA' as Segmen,
    audienceRole: 'MAHASISWA',
    audienceAngkatan: String(new Date().getFullYear() - 1),
    audienceOrganizationId: '',
  });

  const muat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(admin ? '/announcements/manage' : '/announcements');
      setDaftar(res.data.data);
      if (admin) {
        const org = await api.get('/organizations');
        setOrganisasi(org.data.data || []);
      }
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message || 'Gagal memuat pengumuman.' : 'Gagal memuat pengumuman.');
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muat();
  }, [muat]);

  const buka = async (p: Pengumuman) => {
    if (admin || p.dibaca) return;
    try {
      await api.post(`/announcements/${p.id}/read`);
      setDaftar((lama) => lama.map((x) => (x.id === p.id ? { ...x, dibaca: true } : x)));
    } catch (err) {
      console.error(err);
    }
  };

  const bukaBuat = () => {
    setEditingId(null);
    setError('');
    setNotice('');
    setForm((f) => ({ ...f, title: '', content: '' }));
    setModal(true);
  };

  const bukaEdit = (p: Pengumuman) => {
    setEditingId(p.id);
    setError('');
    setNotice('');
    setForm({
      title: p.title,
      content: p.content,
      audience: p.audience as Segmen,
      audienceRole: p.audienceRole || 'MAHASISWA',
      audienceAngkatan: p.audienceAngkatan ? String(p.audienceAngkatan) : String(new Date().getFullYear() - 1),
      audienceOrganizationId: p.audienceOrganizationId || '',
    });
    setModal(true);
  };

  const tutupModal = () => {
    setModal(false);
    setEditingId(null);
  };

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setError('');
    try {
      let pesan: string;
      if (editingId) {
        // Segmen penerima sengaja tidak diubah saat edit: notifikasi yang sudah
        // terkirim tidak bisa ditarik kembali. Hanya judul dan isi yang diubah.
        const res = await api.put(`/announcements/${editingId}`, {
          title: form.title.trim(),
          content: form.content.trim(),
        });
        pesan = res.data.message || 'Pengumuman diperbarui.';
      } else {
        const res = await api.post('/announcements', {
          title: form.title.trim(),
          content: form.content.trim(),
          audience: form.audience,
          audienceRole: form.audience === 'ROLE' ? form.audienceRole : undefined,
          audienceAngkatan: form.audience === 'ANGKATAN' ? Number(form.audienceAngkatan) : undefined,
          audienceOrganizationId:
            form.audience === 'ORGANISASI' ? form.audienceOrganizationId : undefined,
        });
        pesan = res.data.message;
      }
      setNotice(pesan);
      setModal(false);
      setEditingId(null);
      setForm((f) => ({ ...f, title: '', content: '' }));
      await muat();
    } catch (err) {
      const bawaan = editingId ? 'Gagal mengubah pengumuman.' : 'Gagal membuat pengumuman.';
      setError(isAxiosError(err) ? err.response?.data?.message || bawaan : bawaan);
    } finally {
      setMenyimpan(false);
    }
  };

  const hapus = async (p: Pengumuman) => {
    if (!window.confirm(`Hapus pengumuman "${p.title}"?`)) return;
    setBusyId(p.id);
    try {
      const res = await api.delete(`/announcements/${p.id}`);
      setNotice(res.data.message);
      setDaftar((lama) => lama.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message || 'Gagal menghapus pengumuman.' : 'Gagal menghapus pengumuman.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Megaphone className="w-6 h-6 text-amber-400" /> Pengumuman
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {admin
              ? 'Kirim informasi resmi ke seluruh pengguna atau segmen tertentu, lalu pantau jumlah pembacanya.'
              : 'Informasi resmi organisasi yang ditujukan untuk Anda.'}
          </p>
        </div>
        {bolehTulis && (
          <button
            type="button"
            onClick={bukaBuat}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500"
          >
            <Plus className="w-4 h-4" /> Buat Pengumuman
          </button>
        )}
      </div>

      {error && <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>}
      {notice && <div className="p-4 text-sm text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">{notice}</div>}

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-8 h-8 mx-auto text-amber-400 animate-spin" /></div>
      ) : daftar.length === 0 ? (
        <div className="p-12 text-center bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Belum ada pengumuman</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {bolehTulis ? 'Buat pengumuman pertama untuk mahasiswa dan pengurus.' : 'Pengumuman baru akan muncul di sini.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {daftar.map((p) => {
            const pembaca = p._count?.reads ?? p.jumlahPembaca ?? 0;
            return (
              <article
                key={p.id}
                onClick={() => buka(p)}
                className={`p-5 bg-white border shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800 ${!admin && !p.dibaca ? 'border-amber-300 dark:border-amber-700' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{p.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {segmenLabel(p)}</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {tanggal(p.createdAt)}</span>
                      {p.createdBy && <span>oleh {p.createdBy.profile?.nama || p.createdBy.nim}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!admin && !p.dibaca && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Baru</span>
                    )}
                    {(admin || p.punyaSaya) && (
                      <>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {pembaca} pembaca
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); bukaEdit(p); }}
                          className="p-1.5 text-amber-600 rounded-lg hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/60"
                          aria-label={`Edit pengumuman ${p.title}`}
                          title="Edit pengumuman"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); hapus(p); }}
                          disabled={busyId === p.id}
                          className="p-1.5 text-red-600 rounded-lg hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60 disabled:opacity-50"
                          aria-label={`Hapus pengumuman ${p.title}`}
                        >
                          {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-700 whitespace-pre-line dark:text-gray-300">{p.content}</p>
                {!admin && p.dibaca && (
                  <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                    <Check className="w-3.5 h-3.5" /> Sudah dibaca
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Buat pengumuman"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
          onClick={tutupModal}
        >
          <form onSubmit={simpan} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {editingId ? 'Edit Pengumuman' : 'Pengumuman Baru'}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {editingId
                    ? 'Perubahan langsung terlihat oleh pembaca. Segmen penerima tidak diubah.'
                    : 'Notifikasi dalam aplikasi dan push browser dikirim saat disimpan.'}
                </p>
              </div>
              <button type="button" onClick={tutupModal} aria-label="Tutup" className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="umum-judul" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Judul</label>
                <input id="umum-judul" required maxLength={180} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full p-2.5 text-base sm:text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700" />
              </div>
              <div>
                <label htmlFor="umum-isi" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Isi Pengumuman</label>
                <textarea id="umum-isi" required rows={5} maxLength={10000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full p-2.5 text-base sm:text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700" />
              </div>
              {editingId ? (
                <div className="p-3 text-sm border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800/60 dark:border-gray-700">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Segmen penerima</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">
                    {segmenLabel(daftar.find((x) => x.id === editingId) || ({ audience: form.audience, audienceRole: form.audienceRole, audienceAngkatan: Number(form.audienceAngkatan) } as Pengumuman))}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Segmen tidak dapat diubah setelah pengumuman dibuat. Hapus lalu buat baru bila penerima harus berbeda.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="umum-segmen" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Kirim Kepada</label>
                    <select id="umum-segmen" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Segmen })} className="w-full p-2.5 text-base sm:text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                      <option value="SEMUA">Semua pengguna</option>
                      <option value="ROLE">Role tertentu</option>
                      <option value="ANGKATAN">Angkatan tertentu</option>
                      {/* GET /organizations hanya boleh dibaca admin, jadi pilihan ini butuh daftarnya. */}
                      {admin && <option value="ORGANISASI">Organisasi tertentu</option>}
                    </select>
                  </div>

                  {form.audience === 'ROLE' && (
                    <div>
                      <label htmlFor="umum-role" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Role</label>
                      <select id="umum-role" value={form.audienceRole} onChange={(e) => setForm({ ...form, audienceRole: e.target.value })} className="w-full p-2.5 text-base sm:text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                        {Object.entries(ROLE_LABEL).filter(([r]) => r !== 'TAMU').map(([r, label]) => (
                          <option key={r} value={r}>{label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.audience === 'ANGKATAN' && (
                    <div>
                      <label htmlFor="umum-angkatan" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Tahun Angkatan</label>
                      <input id="umum-angkatan" type="number" min={2000} max={2099} value={form.audienceAngkatan} onChange={(e) => setForm({ ...form, audienceAngkatan: e.target.value })} className="w-full p-2.5 text-base sm:text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                    </div>
                  )}

                  {form.audience === 'ORGANISASI' && (
                    <div>
                      <label htmlFor="umum-org" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Organisasi</label>
                      <select id="umum-org" required value={form.audienceOrganizationId} onChange={(e) => setForm({ ...form, audienceOrganizationId: e.target.value })} className="w-full p-2.5 text-base sm:text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                        <option value="">Pilih organisasi...</option>
                        {organisasi.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400"><Building2 className="inline w-3 h-3 mr-1" /> Dikirim ke pengurus yang punya jabatan aktif di organisasi ini.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={tutupModal} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800">Batal</button>
              <button type="submit" disabled={menyimpan} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50">
                {menyimpan ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <><Pencil className="w-4 h-4" /> Simpan Perubahan</> : <><Send className="w-4 h-4" /> Kirim</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
