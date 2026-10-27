import { useCallback, useEffect, useState } from 'react';
import { api, API_ORIGIN } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { useAksesArsip } from '../lib/arsip-surat';
import { isAdminRole } from '../lib/roles';
import {
  FolderArchive, Plus, Loader2, X, FileText, CheckCircle, XCircle, Send,
  Trash2, Paperclip, Archive, Search, ArrowDownLeft, ArrowUpRight, ShieldAlert,
} from 'lucide-react';

interface Organisasi {
  id: string;
  name: string;
}

interface Dokumen {
  id: string;
  type: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  direction: string;
  organization: Organisasi | null;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
  createdAt: string;
  createdBy: { nim: string; profile: { nama: string } | null };
  approvedBy: { nim: string; profile: { nama: string } | null } | null;
  approvedAt: string | null;
}

interface MetaArsip {
  total: number;
  diajukan: number;
  disetujui: number;
  bolehArah: boolean;
  arah: { masuk: number; keluar: number } | null;
  organisasi: Organisasi[];
}

const STATUS_GAYA: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  DIAJUKAN: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  DISETUJUI: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  DITOLAK: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  DIARSIPKAN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const ARAH = [
  { nilai: 'KELUAR', label: 'Surat Keluar', ikon: ArrowUpRight },
  { nilai: 'MASUK', label: 'Surat Masuk', ikon: ArrowDownLeft },
] as const;

const tanggal = (nilai: string | null) =>
  nilai ? new Date(nilai).toLocaleString('id-ID', { dateStyle: 'medium' }) : '—';

/** Pesan galat dari server, tanpa memaksa tipe `any` pada blok catch. */
const pesanGalat = (err: unknown, cadangan: string): string => {
  const pesan = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return pesan || cadangan;
};

export default function Documents() {
  const { user } = useAuth();
  const akses = useAksesArsip(user?.id ?? null);
  const admin = isAdminRole(user?.role);

  const [daftar, setDaftar] = useState<Dokumen[]>([]);
  const [meta, setMeta] = useState<MetaArsip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterTipe, setFilterTipe] = useState('ALL');
  const [filterOrganisasi, setFilterOrganisasi] = useState('ALL');
  const [arah, setArah] = useState<'MASUK' | 'KELUAR'>('KELUAR');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState({
    type: 'SURAT',
    number: '',
    title: '',
    description: '',
    organizationId: '',
    direction: 'KELUAR',
  });
  const [berkas, setBerkas] = useState<File | null>(null);

  const bolehBuka = Boolean(akses?.bolehAkses);
  const bolehArah = Boolean(akses?.bolehArah);

  const muat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/documents', {
        params: {
          type: filterTipe === 'ALL' ? undefined : filterTipe,
          organizationId: filterOrganisasi === 'ALL' ? undefined : filterOrganisasi,
          // Pemilah arah hanya dikirim admin; server juga mengabaikannya untuk peran lain.
          direction: bolehArah ? arah : undefined,
          search: cari.trim() || undefined,
        },
      });
      setDaftar(res.data.data);
      setMeta(res.data.meta);
    } catch (err: unknown) {
      setError(pesanGalat(err, 'Gagal memuat arsip surat.'));
    } finally {
      setLoading(false);
    }
  }, [filterTipe, filterOrganisasi, arah, bolehArah, cari]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (bolehBuka) muat();
  }, [muat, bolehBuka]);

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
      if (form.organizationId) formData.append('organizationId', form.organizationId);
      if (bolehArah) formData.append('direction', form.direction);
      if (berkas) formData.append('file', berkas);

      const res = await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNotice(res.data.message);
      setModal(false);
      setForm({ type: 'SURAT', number: '', title: '', description: '', organizationId: '', direction: 'KELUAR' });
      setBerkas(null);
      await muat();
    } catch (err: unknown) {
      setError(pesanGalat(err, 'Gagal menyimpan dokumen.'));
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
    } catch (err: unknown) {
      setError(pesanGalat(err, 'Aksi gagal.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!akses) {
    return (
      <div className="max-w-6xl p-12 mx-auto text-center">
        <Loader2 className="w-8 h-8 mx-auto text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!akses.bolehAkses) {
    return (
      <div className="max-w-4xl p-6 mx-auto md:p-8">
        <div className="flex items-start gap-3 p-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Arsip surat bersifat terbatas.</p>
            <p className="mt-1">
              Halaman ini hanya dapat dibuka oleh Ketua, Wakil Ketua, dan Sekretaris BEM/himpunan,
              Ketua DPM, serta admin. Hubungi pimpinan organisasi Anda bila memerlukan dokumen di sini.
            </p>
          </div>
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
            Khusus pimpinan inti BEM, DPM, dan himpunan. Pilih organisasi untuk menyaring arsipnya.
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

      {bolehArah && (
        <div role="tablist" aria-label="Arah surat" className="inline-flex p-1 border border-gray-200 rounded-xl bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
          {ARAH.map(({ nilai, label, ikon: Ikon }) => {
            const aktif = arah === nilai;
            const jumlah = nilai === 'MASUK' ? meta?.arah?.masuk : meta?.arah?.keluar;
            return (
              <button
                key={nilai}
                role="tab"
                aria-selected={aktif}
                type="button"
                onClick={() => setArah(nilai)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                  aktif
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Ikon className="w-4 h-4" />
                {label}
                {typeof jumlah === 'number' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {jumlah}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', nilai: meta?.total ?? 0, warna: 'text-gray-900 dark:text-gray-100' },
          { label: 'Menunggu tinjauan', nilai: meta?.diajukan ?? 0, warna: 'text-amber-600 dark:text-amber-300' },
          { label: 'Disetujui', nilai: meta?.disetujui ?? 0, warna: 'text-green-600 dark:text-green-400' },
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
        <select
          value={filterOrganisasi}
          onChange={(e) => setFilterOrganisasi(e.target.value)}
          aria-label="Saring menurut organisasi"
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="ALL">Semua organisasi</option>
          {(meta?.organisasi ?? []).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
          <option value="TANPA">Belum ditentukan</option>
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
                    {bolehArah && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {d.direction === 'MASUK' ? 'Masuk' : 'Keluar'}
                      </span>
                    )}
                    {d.organization && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {d.organization.name}
                      </span>
                    )}
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
                <label htmlFor="dok-organisasi" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Organisasi yang diberi surat</label>
                <select id="dok-organisasi" value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} className="w-full p-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                  <option value="">Belum ditentukan</option>
                  {(meta?.organisasi ?? []).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dipakai sebagai penyaring utama arsip.</p>
              </div>

              {bolehArah && (
                <div>
                  <label htmlFor="dok-arah" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Arah surat</label>
                  <select id="dok-arah" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="w-full p-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                    <option value="KELUAR">Surat keluar (diterbitkan)</option>
                    <option value="MASUK">Surat masuk (diterima)</option>
                  </select>
                </div>
              )}

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
