import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/axios';
import { FileText, Plus, Trash2, Globe, Loader2, XCircle, Calendar, Image as ImageIcon, MapPin, Clock, Paperclip } from 'lucide-react';
import axios from 'axios';

interface Content {
  id: string; type: string; title: string; content: string; createdAt: string;
  author: { profile: { nama: string } | null };
}

interface Agenda {
  id: string; title: string; description: string; date: string; time: string; location: string; registrationLink: string | null;
  author: { profile: { nama: string } | null };
}

interface Gallery {
  id: string; title: string; category: string; url: string; activity: string | null; year: number;
}

export default function CMSManager() {
  const [activeTab, setActiveTab] = useState<'KONTEN' | 'AGENDA' | 'GALERI'>('KONTEN');

  // States untuk Data
  const [contents, setContents] = useState<Content[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // States untuk Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ type: 'BERITA', title: '', content: '' });
  const [agendaData, setAgendaData] = useState({ title: '', description: '', date: '', time: '', location: '', registrationLink: '' });
  const [galleryData, setGalleryData] = useState({ title: '', category: 'FOTO', activity: '', year: new Date().getFullYear().toString() });
  const [contentFile, setContentFile] = useState<File | null>(null);
  const contentFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle Submit Konten (Berita/Program)
  const handleSubmitContent = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);

    const data = new FormData();
    data.append('type', formData.type);
    data.append('title', formData.title);
    data.append('content', formData.content);
    if (contentFile) data.append('file', contentFile);

    try {
      await api.post('/cms', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsModalOpen(false);
      setFormData({ type: 'BERITA', title: '', content: '' });
      setContentFile(null); // Reset file
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan konten');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Submit Agenda
  const handleSubmitAgenda = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await api.post('/cms/agendas', agendaData);
      setIsModalOpen(false);
      setAgendaData({ title: '', description: '', date: '', time: '', location: '', registrationLink: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan agenda');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Submit Gallery
  const handleSubmitGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return alert('Silakan pilih file gambar terlebih dahulu.');
    setSubmitting(true);

    const data = new FormData();
    data.append('title', galleryData.title);
    data.append('category', galleryData.category);
    data.append('activity', galleryData.activity);
    data.append('year', galleryData.year);
    data.append('file', selectedFile);

    try {
      await api.post('/cms/galleries', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsModalOpen(false);
      setGalleryData({ title: '', category: 'FOTO', activity: '', year: new Date().getFullYear().toString() });
      setSelectedFile(null);
      fetchData();
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) alert(error.response?.data?.message || 'Gagal mengunggah galeri');
      else alert('Terjadi kesalahan');
    } finally { setSubmitting(false); }
  };

  // Handle Hapus
  const handleDelete = async (id: string, type: 'KONTEN' | 'AGENDA' | 'GALERI') => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;
    try {
      if (type === 'KONTEN') await api.delete(`/cms/${id}`);
      else if (type === 'AGENDA') await api.delete(`/cms/agendas/${id}`);
      else if (type === 'GALERI') await api.delete(`/cms/galleries/${id}`);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus data');
    }
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Globe className="w-6 h-6 text-amber-400" /> Manajer Konten Publik</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola Berita, Agenda, dan Galeri yang tampil di halaman depan.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center w-full gap-2 px-4 py-2 font-bold text-white transition-all rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95 md:w-auto">
          <Plus className="w-4 h-4" /> Buat {activeTab === 'KONTEN' ? 'Konten' : activeTab === 'AGENDA' ? 'Agenda' : 'Galeri'} Baru
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 gap-1">
        <button onClick={() => setActiveTab('KONTEN')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'KONTEN' ? 'bg-amber-50 text-amber-500 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}><FileText className="w-4 h-4" /> Berita & Program</button>
        <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'AGENDA' ? 'bg-amber-50 text-amber-500 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}><Calendar className="w-4 h-4" /> Agenda Kegiatan</button>
        <button onClick={() => setActiveTab('GALERI')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'GALERI' ? 'bg-amber-50 text-amber-500 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}><ImageIcon className="w-4 h-4" /> Galeri Media</button>
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[400px]">
        {loading ? <div className="flex items-center justify-center h-40 col-span-full"><Loader2 className="w-8 h-8 teamber-400 animate-spin" /></div> : null}

        {!loading && activeTab === 'KONTEN' && (
          contents.length === 0 ? <div className="p-10 text-center text-gray-500 bg-white border col-span-full rounded-xl">Belum ada konten publik.</div>
            : contents.map(item => (
              <div key={item.id} className="flex flex-col justify-between p-5 transition bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md">
                <div>
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${item.type === 'BERITA' ? 'bg-amber-100 text-amber-500' : item.type === 'PROGRAM' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{item.type}</span>
                  <h3 className="mt-3 mb-1 text-lg font-bold line-clamp-2">{item.title}</h3>
                  <p className="mb-3 text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString('id-ID')} • Oleh {item.author.profile?.nama}</p>
                  <p className="p-2 text-sm text-gray-600 rounded-lg line-clamp-3 bg-gray-50">{item.content}</p>
                </div>
                <button onClick={() => handleDelete(item.id, 'KONTEN')} className="flex items-center justify-center w-full gap-2 py-2 mt-4 text-sm font-bold text-red-600 transition-all rounded-lg bg-red-50 hover:bg-red-100 active:scale-95"><Trash2 className="w-4 h-4" /> Hapus</button>
              </div>
            ))
        )}

        {!loading && activeTab === 'AGENDA' && (
          agendas.length === 0 ? <div className="p-10 text-center text-gray-500 bg-white border col-span-full rounded-xl">Belum ada agenda.</div>
            : agendas.map(item => (
              <div key={item.id} className="relative flex flex-col justify-between p-5 overflow-hidden transition bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md">
                <div className="absolute top-0 right-0 flex items-start justify-end w-16 h-16 p-3 rounded-bl-full bg-amber-50"><Calendar className="w-5 h-5 text-amber-400" /></div>
                <div>
                  <h3 className="pr-10 mb-2 text-lg font-bold">{item.title}</h3>
                  <div className="mb-4 space-y-2">
                    <p className="flex items-center gap-2 text-xs text-gray-600"><Calendar className="w-3 h-3 text-gray-400" /> {new Date(item.date).toLocaleDateString('id-ID')}</p>
                    <p className="flex items-center gap-2 text-xs text-gray-600"><Clock className="w-3 h-3 text-gray-400" /> {item.time} WIB</p>
                    <p className="flex items-center gap-2 text-xs text-gray-600"><MapPin className="w-3 h-3 text-gray-400" /> {item.location}</p>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                </div>
                <button onClick={() => handleDelete(item.id, 'AGENDA')} className="flex items-center justify-center w-full gap-2 py-2 mt-4 text-sm font-bold text-red-600 transition-all rounded-lg bg-red-50 hover:bg-red-100 active:scale-95"><Trash2 className="w-4 h-4" /> Hapus</button>
              </div>
            ))
        )}

        {!loading && activeTab === 'GALERI' && (
          galleries.length === 0 ? <div className="p-10 text-center text-gray-500 bg-white border col-span-full rounded-xl">Belum ada foto galeri.</div>
            : galleries.map(item => (
              <div key={item.id} className="flex flex-col overflow-hidden transition bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md">
                <div className="relative h-48 bg-gray-100 group">
                  <img src={`http://localhost:3000${item.url}`} alt={item.title} className="object-cover w-full h-full" />
                  <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/40 group-hover:opacity-100">
                    <button onClick={() => handleDelete(item.id, 'GALERI')} className="flex items-center gap-2 px-4 py-2 font-bold text-white transition-all bg-red-600 rounded-lg hover:bg-red-700 active:scale-95"><Trash2 className="w-4 h-4" /> Hapus File</button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-500">{item.category}</span>
                    <span className="text-xs font-bold text-gray-400">{item.year}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 truncate">{item.title}</h3>
                  {item.activity && <p className="mt-1 text-xs text-gray-500 truncate">Kegiatan: {item.activity}</p>}
                </div>
              </div>
            ))
        )}
      </div>

      {/* MODAL MULTI-FUNGSI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden transform transition-all max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                {activeTab === 'KONTEN' ? <><FileText className="w-5 h-5 text-amber-400" /> Publikasi Berita</> : activeTab === 'AGENDA' ? <><Calendar className="w-5 h-5 text-amber-400" /> Buat Agenda</> : <><ImageIcon className="w-5 h-5 text-amber-400" /> Unggah Galeri</>}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><XCircle className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* FORM KONTEN */}
              {activeTab === 'KONTEN' && (
                <form id="form-konten" onSubmit={handleSubmitContent} className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700">Gambar Cover (Opsional)</label>
                    <input type="file" ref={contentFileInputRef} accept=".jpg,.jpeg,.png" onChange={e => setContentFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
                    <div className="flex items-center gap-3 border border-gray-300 p-2.5 rounded-lg bg-gray-50">
                      <button type="button" onClick={() => contentFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 transition bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100"><Paperclip className="w-4 h-4" /> Pilih Gambar...</button>
                      <span className="text-xs text-gray-500 truncate">{contentFile ? contentFile.name : 'Maks 5MB (JPG/PNG)'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="col-span-1"><label className="block mb-1 text-sm font-bold text-gray-700">Tipe</label><select className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="BERITA">Berita</option><option value="ARTIKEL">Artikel</option><option value="PROGRAM">Program Kerja</option></select></div>
                    <div className="col-span-1 md:col-span-2"><label className="block mb-1 text-sm font-bold text-gray-700">Judul Konten</label><input type="text" required className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                  </div>
                  <div><label className="block mb-1 text-sm font-bold text-gray-700">Isi Konten</label><textarea required rows={6} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 resize-none" value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })}></textarea></div>
                </form>
              )}

              {/* FORM AGENDA */}
              {activeTab === 'AGENDA' && (
                <form id="form-agenda" onSubmit={handleSubmitAgenda} className="space-y-4">
                  <div><label className="block mb-1 text-sm font-bold text-gray-700">Nama Kegiatan</label><input type="text" required className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.title} onChange={e => setAgendaData({ ...agendaData, title: e.target.value })} /></div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="block mb-1 text-sm font-bold text-gray-700">Tanggal</label><input type="date" required className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.date} onChange={e => setAgendaData({ ...agendaData, date: e.target.value })} /></div>
                    <div><label className="block mb-1 text-sm font-bold text-gray-700">Waktu (Contoh: 08:00)</label><input type="time" required className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.time} onChange={e => setAgendaData({ ...agendaData, time: e.target.value })} /></div>
                  </div>
                  <div><label className="block mb-1 text-sm font-bold text-gray-700">Lokasi Tempat</label><input type="text" required className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.location} onChange={e => setAgendaData({ ...agendaData, location: e.target.value })} /></div>
                  <div><label className="block mb-1 text-sm font-bold text-gray-700">Deskripsi Singkat</label><textarea required rows={3} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 resize-none" value={agendaData.description} onChange={e => setAgendaData({ ...agendaData, description: e.target.value })}></textarea></div>
                  <div><label className="block mb-1 text-sm font-bold text-gray-700">Link Pendaftaran (Opsional)</label><input type="url" placeholder="https://..." className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={agendaData.registrationLink} onChange={e => setAgendaData({ ...agendaData, registrationLink: e.target.value })} /></div>
                </form>
              )}

              {/* FORM GALERI */}
              {activeTab === 'GALERI' && (
                <form id="form-galeri" onSubmit={handleSubmitGallery} className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-bold text-gray-700">Pilih Foto (Maks 5MB)</label>
                    <input type="file" ref={fileInputRef} accept=".jpg,.jpeg,.png" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
                    <div className="flex items-center gap-3 border border-gray-300 p-2.5 rounded-lg bg-gray-50">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 transition bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100"><Paperclip className="w-4 h-4" /> Pilih File...</button>
                      <span className="text-xs text-gray-500 truncate">{selectedFile ? selectedFile.name : 'Belum ada file yang dipilih'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="block mb-1 text-sm font-bold text-gray-700">Judul Foto</label><input type="text" required placeholder="Contoh: Rapat Kerja" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.title} onChange={e => setGalleryData({ ...galleryData, title: e.target.value })} /></div>
                    <div><label className="block mb-1 text-sm font-bold text-gray-700">Kategori</label><select className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.category} onChange={e => setGalleryData({ ...galleryData, category: e.target.value })}><option value="FOTO">Foto Kegiatan</option><option value="INFOGRAFIS">Infografis</option></select></div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="block mb-1 text-sm font-bold text-gray-700">Nama Kegiatan Terkait</label><input type="text" placeholder="Opsional" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.activity} onChange={e => setGalleryData({ ...galleryData, activity: e.target.value })} /></div>
                    <div><label className="block mb-1 text-sm font-bold text-gray-700">Tahun</label><input type="number" required className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={galleryData.year} onChange={e => setGalleryData({ ...galleryData, year: e.target.value })} /></div>
                  </div>
                </form>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">Batal</button>
              <button
                type="submit"
                form={activeTab === 'KONTEN' ? 'form-konten' : activeTab === 'AGENDA' ? 'form-agenda' : 'form-galeri'}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 font-bold text-white transition-all rounded-lg shadow-md bg-amber-400 hover:bg-amber-500 active:scale-95"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Publikasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}