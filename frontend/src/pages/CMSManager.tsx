import { useState, useEffect, useCallback, useRef } from 'react';
import { api, assetUrl } from '../lib/axios';
import {
  FileText, Plus, Trash2, Globe, Loader2, XCircle, Calendar, Image as ImageIcon,
  MapPin, Clock, Paperclip, Pencil, Save, Award, Settings2, Link2, Share2, Users
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Content {
  id: string; type: string; title: string; content: string; createdAt: string; image: string | null;
  author: { profile: { nama: string } | null };
}

interface Agenda {
  id: string; title: string; description: string; date: string; time: string; location: string;
  registrationLink: string | null; socialMediaLink: string | null;
  author: { profile: { nama: string } | null };
}

interface GalleryImage { id: string; url: string; order: number; }

interface Gallery {
  id: string; title: string; category: string; url: string; activity: string | null; year: number;
  images?: GalleryImage[];
}

interface Demisioner {
  id: string; organization: string; nama: string; nim: string; jabatan: string | null;
  periode: string; foto: string | null; description: string | null;
}

type Tab = 'KONTEN' | 'AGENDA' | 'GALERI' | 'DEMISIONER' | 'PENGATURAN';

const KATEGORI_GALERI = ['FOTO', 'INFOGRAFIS', 'VIDEO', 'DOKUMENTASI'];

export default function CMSManager() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<Tab>('KONTEN');

  // States untuk Data
  const [contents, setContents] = useState<Content[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [demisioners, setDemisioners] = useState<Demisioner[]>([]);
  const [settings, setSettings] = useState({ visi: '', misi: '' });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // States untuk Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ type: 'BERITA', title: '', content: '' });
  const [agendaData, setAgendaData] = useState({
    title: '', description: '', date: '', time: '', location: '', registrationLink: '', socialMediaLink: '',
  });
  const [galleryData, setGalleryData] = useState({
    title: '', category: 'FOTO', activity: '', year: new Date().getFullYear().toString(),
  });
  const [demisionerData, setDemisionerData] = useState({
    organization: 'BEM', nama: '', nim: '', jabatan: '', periode: '', description: '',
  });

  const [contentFile, setContentFile] = useState<File | null>(null);
  const contentFileInputRef = useRef<HTMLInputElement>(null);

  // Galeri: banyak foto sekaligus
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [hapusGambarIds, setHapusGambarIds] = useState<string[]>([]);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  const [demisionerFile, setDemisionerFile] = useState<File | null>(null);
  const demisionerFileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'KONTEN') {
        const res = await api.get('/cms');
        setContents(res.data.data);
      } else if (activeTab === 'AGENDA') {
        const res = await api.get('/cms/agendas');
        setAgendas(res.data.data);
      } else if (activeTab === 'GALERI') {
        const res = await api.get('/cms/galleries');
        setGalleries(res.data.data);
      } else if (activeTab === 'DEMISIONER') {
        const res = await api.get('/demisioner');
        setDemisioners(res.data.data);
      } else if (activeTab === 'PENGATURAN') {
        const res = await api.get('/cms/settings');
        setSettings({ visi: res.data.data.visi || '', misi: res.data.data.misi || '' });
        setSettingsSaved(false);
      }
    } catch (error) {
      console.error('Gagal memuat data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({ type: 'BERITA', title: '', content: '' });
    setAgendaData({ title: '', description: '', date: '', time: '', location: '', registrationLink: '', socialMediaLink: '' });
    setGalleryData({ title: '', category: 'FOTO', activity: '', year: new Date().getFullYear().toString() });
    setDemisionerData({ organization: 'BEM', nama: '', nim: '', jabatan: '', periode: '', description: '' });
    setContentFile(null);
    setGalleryFiles([]);
    setHapusGambarIds([]);
    setDemisionerFile(null);
  };

  const openCreate = () => { resetForm(); setIsModalOpen(true); };

  // --- Membuka modal dengan data lama (mode edit) ---
  const openEditContent = (item: Content) => {
    resetForm();
    setEditingId(item.id);
    setFormData({ type: item.type, title: item.title, content: item.content });
    setIsModalOpen(true);
  };

  const openEditAgenda = (item: Agenda) => {
    resetForm();
    setEditingId(item.id);
    setAgendaData({
      title: item.title,
      description: item.description,
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
      time: item.time,
      location: item.location,
      registrationLink: item.registrationLink || '',
      socialMediaLink: item.socialMediaLink || '',
    });
    setIsModalOpen(true);
  };

  const openEditGallery = (item: Gallery) => {
    resetForm();
    setEditingId(item.id);
    setGalleryData({
      title: item.title, category: item.category,
      activity: item.activity || '', year: String(item.year),
    });
    setIsModalOpen(true);
  };

  const openEditDemisioner = (item: Demisioner) => {
    resetForm();
    setEditingId(item.id);
    setDemisionerData({
      organization: item.organization, nama: item.nama, nim: item.nim,
      jabatan: item.jabatan || '', periode: item.periode, description: item.description || '',
    });
    setIsModalOpen(true);
  };

  // --- Submit Konten (Berita/Artikel/Program) ---
  const handleSubmitContent = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);

    const data = new FormData();
    data.append('type', formData.type);
    data.append('title', formData.title);
    data.append('content', formData.content);
    if (contentFile) data.append('file', contentFile);

    try {
      if (editingId) await api.put(`/cms/${editingId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      else await api.post('/cms', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsModalOpen(false); resetForm(); fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan konten');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Submit Agenda ---
  const handleSubmitAgenda = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      if (editingId) await api.put(`/cms/agendas/${editingId}`, agendaData);
      else await api.post('/cms/agendas', agendaData);
      setIsModalOpen(false); resetForm(); fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan agenda');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Submit Galeri (banyak foto sekaligus) ---
  const handleSubmitGallery = async (e: React.FormEvent) => {
    e.preventDefault();

    const masihAdaGambarLama = editingId
      ? (galleries.find((g) => g.id === editingId)?.images || []).some((img) => !hapusGambarIds.includes(img.id))
      : false;

    if (!editingId && galleryFiles.length === 0) {
      return alert('Pilih minimal satu foto untuk diunggah.');
    }
    if (editingId && !masihAdaGambarLama && galleryFiles.length === 0) {
      return alert('Galeri harus menyisakan minimal satu foto.');
    }

    setSubmitting(true);
    const data = new FormData();
    data.append('title', galleryData.title);
    data.append('category', galleryData.category);
    data.append('activity', galleryData.activity);
    data.append('year', galleryData.year);
    galleryFiles.forEach((file) => data.append('images', file));
    if (hapusGambarIds.length > 0) data.append('removeImageIds', JSON.stringify(hapusGambarIds));

    try {
      if (editingId) await api.put(`/cms/galleries/${editingId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      else await api.post('/cms/galleries', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsModalOpen(false); resetForm(); fetchData();
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) alert(error.response?.data?.message || 'Gagal mengunggah galeri');
      else alert('Terjadi kesalahan');
    } finally { setSubmitting(false); }
  };

  // --- Submit Demisioner ---
  const handleSubmitDemisioner = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);

    const data = new FormData();
    Object.entries(demisionerData).forEach(([key, value]) => data.append(key, value));
    if (demisionerFile) data.append('foto', demisionerFile);

    try {
      if (editingId) await api.put(`/demisioner/${editingId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      else await api.post('/demisioner', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsModalOpen(false); resetForm(); fetchData();
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) alert(error.response?.data?.message || 'Gagal menyimpan data demisioner');
      else alert('Terjadi kesalahan');
    } finally { setSubmitting(false); }
  };

  // --- Simpan Visi & Misi ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await api.put('/cms/settings', settings);
      setSettingsSaved(true);
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan visi & misi');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Hapus ---
  const handleDelete = async (id: string, type: Tab) => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;
    try {
      if (type === 'KONTEN') await api.delete(`/cms/${id}`);
      else if (type === 'AGENDA') await api.delete(`/cms/agendas/${id}`);
      else if (type === 'GALERI') await api.delete(`/cms/galleries/${id}`);
      else if (type === 'DEMISIONER') await api.delete(`/demisioner/${id}`);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus data');
    }
  };

  const tabButton = (tab: Tab, label: string, Icon: typeof FileText, adminOnly = false) => {
    if (adminOnly && !isAdmin) return null;
    const active = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`flex-1 min-w-[130px] py-2.5 px-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
          active ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-500 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <Icon className="w-4 h-4" /> {label}
      </button>
    );
  };

  const judulModal = () => {
    const aksi = editingId ? 'Edit' : 'Buat';
    if (activeTab === 'KONTEN') return `${aksi} Konten Publik`;
    if (activeTab === 'AGENDA') return `${aksi} Agenda`;
    if (activeTab === 'GALERI') return `${aksi} Galeri`;
    return `${aksi} Demisioner`;
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100"><Globe className="w-6 h-6 text-amber-400" /> Manajer Konten Publik</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola dan perbarui Berita, Artikel, Program Kerja, Agenda, Galeri, serta Riwayat Demisioner.
          </p>
        </div>
        {activeTab !== 'PENGATURAN' && (
          <button onClick={openCreate} className="flex items-center justify-center w-full gap-2 px-4 py-2 font-bold text-white transition-all rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95 md:w-auto">
            <Plus className="w-4 h-4" /> Tambah {activeTab === 'KONTEN' ? 'Konten' : activeTab === 'AGENDA' ? 'Agenda' : activeTab === 'GALERI' ? 'Galeri' : 'Demisioner'}
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-1 p-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
        {tabButton('KONTEN', 'Berita & Program', FileText)}
        {tabButton('AGENDA', 'Agenda Kegiatan', Calendar)}
        {tabButton('GALERI', 'Galeri Media', ImageIcon)}
        {tabButton('DEMISIONER', 'Riwayat Demisioner', Award, true)}
        {tabButton('PENGATURAN', 'Visi & Misi', Settings2, true)}
        <div className="flex justify-end w-full sm:w-auto pt-1 sm:pt-0"><ThemeToggle /></div>
      </div>

      {/* Content Area */}
      <div className={activeTab === 'PENGATURAN' ? '' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[400px]'}>
        {loading && <div className="flex items-center justify-center h-40 col-span-full"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>}

        {!loading && activeTab === 'KONTEN' && (
          contents.length === 0 ? <div className="p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border col-span-full rounded-xl">Belum ada konten publik.</div>
            : contents.map(item => (
              <div key={item.id} className="flex flex-col justify-between p-5 transition bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl hover:shadow-md">
                <div>
                  {item.image && (
                    <div className="w-full h-32 mb-3 overflow-hidden bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <img src={assetUrl(item.image)} alt={item.title} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${item.type === 'BERITA' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-500' : item.type === 'PROGRAM' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'}`}>{item.type}</span>
                  <h3 className="mt-3 mb-1 text-lg font-bold line-clamp-2">{item.title}</h3>
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{new Date(item.createdAt).toLocaleDateString('id-ID')} • Oleh {item.author.profile?.nama || '-'}</p>
                  <p className="p-2 text-sm text-gray-600 dark:text-gray-400 rounded-lg line-clamp-3 bg-gray-50 dark:bg-gray-800">{item.content}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEditContent(item)} className="flex items-center justify-center flex-1 gap-2 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"><Pencil className="w-4 h-4" /> Edit</button>
                  <button onClick={() => handleDelete(item.id, 'KONTEN')} className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 transition rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
        )}

        {!loading && activeTab === 'AGENDA' && (
          agendas.length === 0 ? <div className="p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border col-span-full rounded-xl">Belum ada agenda.</div>
            : agendas.map(item => (
              <div key={item.id} className="relative flex flex-col justify-between p-5 overflow-hidden transition bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl hover:shadow-md">
                <div className="absolute top-0 right-0 flex items-start justify-end w-16 h-16 p-3 rounded-bl-full bg-amber-50 dark:bg-amber-950/60"><Calendar className="w-5 h-5 text-amber-400" /></div>
                <div>
                  <h3 className="pr-10 mb-2 text-lg font-bold">{item.title}</h3>
                  <div className="mb-4 space-y-2">
                    <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><Calendar className="w-3 h-3 text-gray-400 dark:text-gray-500" /> {new Date(item.date).toLocaleDateString('id-ID')}</p>
                    <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" /> {item.time} WIB</p>
                    <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><MapPin className="w-3 h-3 text-gray-400 dark:text-gray-500" /> {item.location}</p>
                    {item.socialMediaLink && (
                      <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 truncate">
                        <Link2 className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" /> {item.socialMediaLink}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEditAgenda(item)} className="flex items-center justify-center flex-1 gap-2 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"><Pencil className="w-4 h-4" /> Edit</button>
                  <button onClick={() => handleDelete(item.id, 'AGENDA')} className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 transition rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
        )}

        {!loading && activeTab === 'GALERI' && (
          galleries.length === 0 ? <div className="p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border col-span-full rounded-xl">Belum ada foto galeri.</div>
            : galleries.map(item => {
              const jumlah = item.images?.length || 1;
              return (
                <div key={item.id} className="flex flex-col overflow-hidden transition bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl hover:shadow-md">
                  <div className="relative h-48 bg-gray-100 dark:bg-gray-800 group">
                    <img src={assetUrl(item.url)} alt={item.title} className="object-cover w-full h-full" />
                    {jumlah > 1 && (
                      <span className="absolute px-2 py-1 text-[10px] font-bold text-white rounded-lg top-2 right-2 bg-black/60 backdrop-blur-sm">
                        {jumlah} FOTO
                      </span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity opacity-0 bg-black/40 group-hover:opacity-100">
                      <button onClick={() => openEditGallery(item)} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil className="w-4 h-4" /> Edit</button>
                      <button onClick={() => handleDelete(item.id, 'GALERI')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-500">{item.category}</span>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{item.year}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{item.title}</h3>
                    {item.activity && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">Kegiatan: {item.activity}</p>}
                  </div>
                </div>
              );
            })
        )}

        {!loading && activeTab === 'DEMISIONER' && (
          demisioners.length === 0 ? <div className="p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border col-span-full rounded-xl">Belum ada data demisioner.</div>
            : demisioners.map(item => (
              <div key={item.id} className="flex flex-col overflow-hidden transition bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl hover:shadow-md">
                <div className="flex items-center gap-4 p-4">
                  {item.foto ? (
                    <img src={assetUrl(item.foto)} alt={item.nama} className="object-cover w-16 h-16 rounded-full shrink-0 ring-2 ring-amber-100 dark:ring-amber-900/60" />
                  ) : (
                    <div className="flex items-center justify-center w-16 h-16 text-lg font-black text-white rounded-full shrink-0 bg-amber-400">
                      {item.nama.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">{item.organization}</span>
                    <h3 className="mt-1 font-bold text-gray-900 dark:text-gray-100 truncate">{item.nama}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.nim}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.jabatan ? `${item.jabatan} • ` : ''}Periode {item.periode}</p>
                  </div>
                </div>
                {item.description && <p className="px-4 pb-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{item.description}</p>}
                <div className="flex gap-2 p-4 pt-0">
                  <button onClick={() => openEditDemisioner(item)} className="flex items-center justify-center flex-1 gap-2 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"><Pencil className="w-4 h-4" /> Edit</button>
                  <button onClick={() => handleDelete(item.id, 'DEMISIONER')} className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 transition rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
        )}

        {!loading && activeTab === 'PENGATURAN' && (
          <form onSubmit={handleSaveSettings} className="p-6 space-y-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
            <div className="flex items-start gap-3 p-4 text-sm text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/60">
              <Users className="w-5 h-5 shrink-0 mt-0.5" />
              <p>Visi & Misi ini tampil di halaman publik (Landing & Tentang Kami). Perbarui setiap pergantian kepengurusan.</p>
            </div>

            {settingsSaved && (
              <div className="p-3 text-sm font-bold text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950/60">
                Visi & Misi berhasil disimpan.
              </div>
            )}

            <div>
              <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Visi BEM-FT UNAYA</label>
              <textarea
                rows={4}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-lg outline-none resize-none focus:ring-2 focus:ring-amber-300"
                value={settings.visi}
                onChange={(e) => setSettings({ ...settings, visi: e.target.value })}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Misi BEM-FT UNAYA</label>
              <textarea
                rows={6}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-lg outline-none resize-none focus:ring-2 focus:ring-amber-300"
                value={settings.misi}
                onChange={(e) => setSettings({ ...settings, misi: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tulis satu poin misi per baris. Setiap baris tampil sebagai butir terpisah di halaman publik.</p>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2 font-bold text-white transition rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95 disabled:opacity-60">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Simpan Visi & Misi</>}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* MODAL MULTI-FUNGSI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden transform transition-all max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
                {activeTab === 'KONTEN' ? <><FileText className="w-5 h-5 text-amber-400" /> {judulModal()}</>
                  : activeTab === 'AGENDA' ? <><Calendar className="w-5 h-5 text-amber-400" /> {judulModal()}</>
                    : activeTab === 'GALERI' ? <><ImageIcon className="w-5 h-5 text-amber-400" /> {judulModal()}</>
                      : <><Award className="w-5 h-5 text-amber-400" /> {judulModal()}</>}
              </h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }}><XCircle className="w-6 h-6 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400" /></button>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* FORM KONTEN */}
              {activeTab === 'KONTEN' && (
                <form id="form-konten" onSubmit={handleSubmitContent} className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">
                      Gambar Cover ({editingId ? 'biarkan kosong bila tidak diganti' : 'Opsional'})
                    </label>
                    <input type="file" ref={contentFileInputRef} accept=".jpg,.jpeg,.png,.webp" onChange={e => setContentFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
                    <div className="flex items-center gap-3 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <button type="button" onClick={() => contentFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800"><Paperclip className="w-4 h-4" /> Pilih Gambar...</button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{contentFile ? contentFile.name : 'Maks 5MB (JPG/PNG/WEBP)'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="col-span-1">
                      <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Tipe</label>
                      <select className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                        <option value="BERITA">Berita</option>
                        <option value="ARTIKEL">Artikel</option>
                        <option value="PROGRAM">Program Kerja</option>
                      </select>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Judul Konten</label>
                      <input type="text" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Isi Konten</label>
                    <textarea required rows={6} className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 resize-none" value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })}></textarea>
                  </div>
                </form>
              )}

              {/* FORM AGENDA */}
              {activeTab === 'AGENDA' && (
                <form id="form-agenda" onSubmit={handleSubmitAgenda} className="space-y-4">
                  <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Nama Kegiatan</label><input type="text" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.title} onChange={e => setAgendaData({ ...agendaData, title: e.target.value })} /></div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Tanggal</label><input type="date" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.date} onChange={e => setAgendaData({ ...agendaData, date: e.target.value })} /></div>
                    <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Waktu (Contoh: 08:00)</label><input type="time" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.time} onChange={e => setAgendaData({ ...agendaData, time: e.target.value })} /></div>
                  </div>
                  <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Lokasi Tempat</label><input type="text" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.location} onChange={e => setAgendaData({ ...agendaData, location: e.target.value })} /></div>
                  <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Deskripsi Singkat</label><textarea required rows={3} className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 resize-none" value={agendaData.description} onChange={e => setAgendaData({ ...agendaData, description: e.target.value })}></textarea></div>
                  <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Link Pendaftaran (Opsional)</label><input type="url" placeholder="https://..." className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.registrationLink} onChange={e => setAgendaData({ ...agendaData, registrationLink: e.target.value })} /></div>
                  {/* Kolom khusus postingan media sosial, tepat di bawah link pendaftaran */}
                  <div>
                    <label className="flex items-center gap-2 mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">
                      <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Link Postingan Sosial Media (Opsional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/p/..."
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300"
                      value={agendaData.socialMediaLink}
                      onChange={e => setAgendaData({ ...agendaData, socialMediaLink: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tautan ke postingan Instagram/TikTok/Facebook yang terkait dengan agenda ini.</p>
                  </div>
                </form>
              )}

              {/* FORM GALERI */}
              {activeTab === 'GALERI' && (
                <form id="form-galeri" onSubmit={handleSubmitGallery} className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">
                      Pilih Foto — bisa beberapa sekaligus (maks 10 foto, 5MB per foto)
                    </label>
                    <input
                      type="file"
                      ref={galleryFileInputRef}
                      accept=".jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={e => setGalleryFiles(e.target.files ? Array.from(e.target.files) : [])}
                      className="hidden"
                    />
                    <div className="flex items-center gap-3 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <button type="button" onClick={() => galleryFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800"><Paperclip className="w-4 h-4" /> Pilih Foto...</button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {galleryFiles.length > 0 ? `${galleryFiles.length} foto dipilih` : 'Belum ada file yang dipilih'}
                      </span>
                    </div>
                    {galleryFiles.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {galleryFiles.map((f, i) => (
                          <li key={`${f.name}-${i}`} className="text-xs text-gray-600 dark:text-gray-400 truncate">• {f.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Foto lama saat mengedit */}
                  {editingId && (() => {
                    const existing = galleries.find((g) => g.id === editingId)?.images || [];
                    if (existing.length === 0) return null;
                    return (
                      <div>
                        <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Foto Saat Ini ({existing.length})</label>
                        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Klik foto untuk menandainya akan dihapus.</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {existing.map((img) => {
                            const akanDihapus = hapusGambarIds.includes(img.id);
                            return (
                              <button
                                type="button"
                                key={img.id}
                                onClick={() => setHapusGambarIds((prev) =>
                                  prev.includes(img.id) ? prev.filter((x) => x !== img.id) : [...prev, img.id]
                                )}
                                className={`relative h-20 overflow-hidden rounded-lg border-2 ${akanDihapus ? 'border-red-500 opacity-50' : 'border-transparent'}`}
                              >
                                <img src={assetUrl(img.url)} alt="Galeri" className="object-cover w-full h-full" />
                                {akanDihapus && (
                                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white bg-red-600/70">
                                    AKAN DIHAPUS
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Judul Postingan</label><input type="text" required placeholder="Contoh: Rapat Kerja" className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.title} onChange={e => setGalleryData({ ...galleryData, title: e.target.value })} /></div>
                    <div>
                      <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Kategori</label>
                      <select className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.category} onChange={e => setGalleryData({ ...galleryData, category: e.target.value })}>
                        {KATEGORI_GALERI.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Nama Kegiatan Terkait</label><input type="text" placeholder="Opsional" className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.activity} onChange={e => setGalleryData({ ...galleryData, activity: e.target.value })} /></div>
                    <div><label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Tahun</label><input type="number" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.year} onChange={e => setGalleryData({ ...galleryData, year: e.target.value })} /></div>
                  </div>
                </form>
              )}

              {/* FORM DEMISIONER */}
              {activeTab === 'DEMISIONER' && (
                <form id="form-demisioner" onSubmit={handleSubmitDemisioner} className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Foto ({editingId ? 'biarkan kosong bila tidak diganti' : 'Opsional'})</label>
                    <input type="file" ref={demisionerFileInputRef} accept=".jpg,.jpeg,.png,.webp" onChange={e => setDemisionerFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
                    <div className="flex items-center gap-3 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <button type="button" onClick={() => demisionerFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800"><Paperclip className="w-4 h-4" /> Pilih Foto...</button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{demisionerFile ? demisionerFile.name : 'Maks 2MB (JPG/PNG/WEBP)'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Organisasi</label>
                      <select className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={demisionerData.organization} onChange={e => setDemisionerData({ ...demisionerData, organization: e.target.value })}>
                        <option value="DPM">DPM</option>
                        <option value="BEM">BEM</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Periode</label>
                      <input type="text" required placeholder="2022/2023" className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={demisionerData.periode} onChange={e => setDemisionerData({ ...demisionerData, periode: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                      <input type="text" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={demisionerData.nama} onChange={e => setDemisionerData({ ...demisionerData, nama: e.target.value })} />
                    </div>
                    <div>
                      <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">NIM</label>
                      <input type="text" required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={demisionerData.nim} onChange={e => setDemisionerData({ ...demisionerData, nim: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Jabatan</label>
                    <input type="text" placeholder="Contoh: Ketua BEM" className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={demisionerData.jabatan} onChange={e => setDemisionerData({ ...demisionerData, jabatan: e.target.value })} />
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Sejarah Singkat / Pesan</label>
                    <textarea rows={5} className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 resize-none" value={demisionerData.description} onChange={e => setDemisionerData({ ...demisionerData, description: e.target.value })}></textarea>
                  </div>
                </form>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">Batal</button>
              <button
                type="submit"
                form={activeTab === 'KONTEN' ? 'form-konten' : activeTab === 'AGENDA' ? 'form-agenda' : activeTab === 'GALERI' ? 'form-galeri' : 'form-demisioner'}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 font-bold text-white transition-all rounded-lg shadow-md bg-amber-400 hover:bg-amber-500 active:scale-95"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
