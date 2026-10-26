import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, API_ORIGIN } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { isAdminRole, isStaff } from '../lib/roles';
import {
  FolderArchive, Plus, Loader2, X, FileText, CheckCircle, XCircle, Send,
  Trash2, Paperclip, Archive, Search,
} from 'lucide-react';

interface Dokumen {
  id: string;
  type: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
  createdAt: string;
  createdBy: { nim: string; profile: { nama: string } | null };
  approvedBy: { nim: string; profile: { nama: string } | null } | null;
  approvedAt: string | null;
}

const STATUS_GAYA: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  DIAJUKAN: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  DISETUJUI: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  DITOLAK: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  DIARSIPKAN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const tanggal = (nilai: string | null) =>
  nilai ? new Date(nilai).toLocaleString('id-ID', { dateStyle: 'medium' }) : '—';

export default function Documents() {
  const { user } = useAuth();
  const admin = isAdminRole(user?.role);
  const staf = isStaff(user?.role);

  const [daftar, setDaftar] = useState<Dokumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterTipe, setFilterTipe] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState({
    type: 'SURAT',
    number: '',
    title: '',
    description: '',
  });
  const [berkas, setBerkas] = useState<File | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/documents', {
        params: {
          type: filterTipe === 'ALL' ? undefined : filterTipe,
          status: filterStatus === 'ALL' ? undefined : filterStatus,
          search: cari.trim() || undefined,
        },
      });
      setDaftar(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal memuat arsip surat.');
    } finally {
      setLoading(false);
    }
  }, [filterTipe, filterStatus, cari]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (staf) muat();
  }, [muat, staf]);

  const ringkasan = useMemo(
    () => ({
      total: daftar.length,
      diajukan: daftar.filter((d) => d.status === 'DIAJUKAN').length,
      disetujui: daftar.filter((d) => d.status === 'DISETUJUI').length,
    }),
    [daftar]
  );

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('type', form.type);
      formData.append('number', form.number.trim());
      formData.append('title', form.title.trim());
      if (form.description.trim()) formData.append('description', form.description.trim());
      if (berkas) formData.append('file', berkas);

      const res = await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNotice(res.data.message);
      setModal(false);
      setForm({ type: 'SURAT', number: '', title: '', description: '' });
      setBerkas(null);
      await muat();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal menyimpan dokumen.');
    } finally {
      setMenyimpan(false);
    }
  };

  const aksi = async (d: Dokumen, aksiNama: 'submit' | 'review' | 'delete', status?: string) => {
    if (aksiNama === 'delete' && !window.confirm(`Hapus ${d.type} ${d.number} dari arsip?`)) return;
    if (aksiNama === 'submit' && !window.confirm(`Ajukan ${d.type} ${d.number} untuk ditinjau admin?`)) return;
    if (aksiNama === 'review' && !window.confirm(`Tandai ${d.type} ${d.number} sebagai ${status}?`)) return;

    setBusyId(d.id);
    setError('');
    try {
      let res;
      if (aksiNama === 'submit') res = await api.post(`/documents/${d.id}/submit`);
      else if (aksiNama === 'review') res = await api.patch(`/documents/${d.id}/review`, { status });
      else res = await api.delete(`/documents/${d.id}`);
      setNotice(res.data.message);
      await muat();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Aksi gagal.');
    } finally {
      setBusyId(null);
    }
  };

  if (!staf) {
    return (
      <div className="max-w-4xl p-6 mx-auto md:p-8">
        <div className="p-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900">
          Halaman arsip surat hanya tersedia untuk pengurus dan admin.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <FolderArchive className="w-6 h-6 text-amber-400" /> Arsip Surat & Proposal
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Simpan nomor, berkas final, dan status persetujuan dalam satu tempat.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500"
        >
          <Plus className="w-4 h-4" /> Tambah Dokumen
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', nilai: ringkasan.total, warna: 'text-gray-900 dark:text-gray-100' },
          { label: 'Menunggu tinjauan', nilai: ringkasan.diajukan, warna: 'text-amber-600 dark:text-amber-300' },
          { label: 'Disetujui', nilai: ringkasan.disetujui, warna: 'text-green-600 dark:text-green-400' },
        ].map((k) => (
          <div key={k.label} className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-500 uppercase dark:text-gray-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-black ${k.warna}`}>{k.nilai}</p>
          </div>
        ))}
      </div>

      {error && <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>}
      {notice && <div className="p-4 text-sm text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">{notice}</div>}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute w-4 h-4 text-gray-400 left-3 top-3" />
          <input
            type="text"
            placeholder="Cari nomor, judul, atau keterangan..."
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className="w-full py-2 pl-9 pr-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <select value={filterTipe} onChange={(e) => setFilterTipe(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-700">
          <option value="ALL">Semua jenis</option>
          <option value="SURAT">Surat</option>
          <option value="PROPOSAL">Proposal</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-700">
          <option value="ALL">Semua status</option>
          <option value="DRAFT">Draf</option>
          <option value="DIAJUKAN">Diajukan</option>
          <option value="DISETUJUI">Disetujui</option>
          <option value="DITOLAK">Ditolak</option>
          <option value="DIARSIPKAN">Diarsipkan</option>
        </select>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-8 h-8 mx-auto text-amber-400 animate-spin" /></div>
      ) : daftar.length === 0 ? (
        <div className="p-12 text-center bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <FolderArchive className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Arsip masih kosong</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Tambahkan surat atau proposal pertama.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daftar.map((d) => (
            <article key={d.id} className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">{d.type}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_GAYA[d.status] || STATUS_GAYA.DRAFT}`}>{d.status}</span>
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{d.number}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">{d.title}</h2>
                  {d.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{d.description}</p>}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Dibuat {tanggal(d.createdAt)} oleh {d.createdBy.profile?.nama || d.createdBy.nim}
                    {d.approvedAt ? ` • Ditinjau ${tanggal(d.approvedAt)}` : ''}
                  </p>
                  {d.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Catatan: {d.note}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.fileUrl && (
                    <a
                      href={`${API_ORIGIN}${d.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-700 rounded-lg bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> {d.fileName || 'Lihat berkas'}
                    </a>
                  )}
                  {(d.status === 'DRAFT' || d.status === 'DITOLAK') && (
                    <button type="button" onClick={() => aksi(d, 'submit')} disabled={busyId === d.id} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-700 rounded-lg bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-950/60 disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" /> Ajukan
                    </button>
                  )}
                  {admin && d.status === 'DIAJUKAN' && (
                    <>
                      <button type="button" onClick={() => aksi(d, 'review', 'DISETUJUI')} disabled={busyId === d.id} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 rounded-lg bg-green-50 hover:bg-green-100 dark:text-green-300 dark:bg-green-950/60 disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Setujui
                      </button>
                      <button type="button" onClick={() => aksi(d, 'review', 'DITOLAK')} disabled={busyId === d.id} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-700 rounded-lg bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-950/60 disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" /> Tolak
                      </button>
                    </>
                  )}
                  {admin && d.status === 'DISETUJUI' && (
                    <button type="button" onClick={() => aksi(d, 'review', 'DIARSIPKAN')} disabled={busyId === d.id} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-700 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 disabled:opacity-50">
                      <Archive className="w-3.5 h-3.5" /> Arsipkan
                    </button>
                  )}
                  {(admin || (d.createdBy.nim === user?.nim && d.status === 'DRAFT')) && (
                    <button type="button" onClick={() => aksi(d, 'delete')} disabled={busyId === d.id} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 rounded-lg hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && (
        <div role="dialog" aria-modal="true" aria-label="Tambah dokumen" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setModal(false)}>
          <form onSubmit={simpan} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Tambah ke Arsip</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nomor harus unik untuk setiap jenis dokumen.</p>
              </div>
              <button type="button" onClick={() => setModal(false)} aria-label="Tutup" className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="dok-jenis" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Jenis</label>
                  <select id="dok-jenis" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full p-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                    <option value="SURAT">Surat</option>
                    <option value="PROPOSAL">Proposal</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="dok-nomor" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Nomor</label>
                  <input id="dok-nomor" required maxLength={80} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="001/BEM-FT/2026" className="w-full p-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                </div>
              </div>
              <div>
                <label htmlFor="dok-judul" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Judul</label>
                <input id="dok-judul" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full p-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700" />
              </div>
              <div>
                <label htmlFor="dok-deskripsi" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Keterangan (opsional)</label>
                <textarea id="dok-deskripsi" rows={3} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full p-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700" />
              </div>
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-bold text-gray-700 dark:text-gray-300"><Paperclip className="w-4 h-4" /> Berkas (opsional)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => setBerkas(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-amber-50 file:text-amber-700 dark:text-gray-300 dark:file:bg-amber-950/60 dark:file:text-amber-300" />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX. Maksimal 10 MB.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800">Batal</button>
              <button type="submit" disabled={menyimpan} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50">
                {menyimpan ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4" /> Simpan</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
