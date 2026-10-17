import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import {
  HelpCircle, Loader2, Plus, Pencil, Trash2, Save, X, ChevronDown, Info
} from 'lucide-react';
import axios from 'axios';
import { ThemeToggle } from '../components/ThemeToggle';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
}

const PERTANYAAN_UMUM = [
  'Bagaimana cara mengirim aspirasi atau keluhan?',
  'Siapa yang bisa membaca keluhan saya?',
  'Kenapa akun saya tiba-tiba nonaktif?',
];

export default function Faq() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ question: '', answer: '', order: '0' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchFaqs = async () => {
    setError('');
    try {
      const res = await api.get('/faqs');
      setFaqs(res.data.data);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.message || 'Gagal memuat FAQ.');
      else setError('Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFaqs();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ question: '', answer: '', order: String((faqs.length + 1) * 10) });
    setIsFormOpen(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setForm({ question: item.question, answer: item.answer, order: String(item.order) });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) await api.put(`/faqs/${editingId}`, form);
      else await api.post('/faqs', form);
      setIsFormOpen(false);
      setEditingId(null);
      setForm({ question: '', answer: '', order: '0' });
      fetchFaqs();
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal menyimpan FAQ.');
      else alert('Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus FAQ ini?')) return;
    try {
      await api.delete(`/faqs/${id}`);
      fetchFaqs();
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal menghapus FAQ.');
      else alert('Terjadi kesalahan.');
    }
  };

  return (
    <div className="max-w-4xl p-6 mx-auto space-y-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <HelpCircle className="w-6 h-6 text-amber-400" /> Pertanyaan yang Sering Diajukan
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Penjelasan singkat tentang cara kerja portal BEM-FT UNAYA.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 px-4 py-2 font-bold text-white transition rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Tambah FAQ
            </button>
            <ThemeToggle />
          </div>
        )}
      </div>

      {error && <div className="p-4 text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60">{error}</div>}

      {/* Daftar FAQ */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
      ) : faqs.length === 0 ? (
        <div className="p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <Info className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-900 dark:text-gray-100">Belum ada FAQ yang ditambahkan.</p>
          <p className="mt-1 text-sm">
            {isAdmin
              ? 'Klik "Tambah FAQ" untuk membuat pertanyaan pertama.'
              : 'Admin belum menambahkan daftar pertanyaan.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="flex items-center justify-between w-full gap-4 p-5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="flex items-center gap-3 font-bold text-gray-900 dark:text-gray-100">
                    <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
                    {item.question}
                  </span>
                  <ChevronDown className={`w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pl-14">
                      <p className="pt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400 whitespace-pre-wrap border-t border-gray-100 dark:border-gray-800">
                        {item.answer}
                      </p>
                      {isAdmin && (
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => openEdit(item)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40">
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panduan cepat kalau admin belum mengisi apa pun */}
      {!loading && faqs.length === 0 && (
        <div className="p-6 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 rounded-xl">
          <h2 className="mb-3 text-sm font-bold text-amber-900 dark:text-amber-200">Topik yang biasanya perlu dijelaskan</h2>
          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200 list-disc list-inside">
            {PERTANYAAN_UMUM.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </div>
      )}

      {/* Modal Form FAQ */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{editingId ? 'Edit FAQ' : 'Tambah FAQ'}</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Pertanyaan</label>
                <input
                  type="text" required
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300"
                  value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Jawaban</label>
                <textarea
                  required rows={6}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none resize-none focus:ring-2 focus:ring-amber-300"
                  value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Urutan Tampil</label>
                <input
                  type="number"
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300"
                  value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Angka lebih kecil tampil lebih atas.</p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Batal</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2 font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-60">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Simpan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
