import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import {
  Plus, MessageSquare, Clock, CheckCircle, XCircle, Search, Loader2, UserCog,
  Paperclip, FileText, Image as ImageIcon, Building2, Download, Eye, EyeOff,
  ShieldCheck, Info, AlertTriangle, Star, Timer, BookOpen, Save, Trash2, UserMinus,
} from 'lucide-react';
import { canExportKeluhan, targetLabel, TICKET_TARGETS, ROLE_LABEL, isStaff } from '../lib/roles';

interface PenulisTiket {
  id: string; nim: string; role: string;
  foto?: string | null;
  profile: { nama: string } | null;
}
interface Reply {
  id: string; content: string; createdAt: string;
  author: PenulisTiket;
}
interface Assignment {
  id: string; isActive: boolean;
  assignee: PenulisTiket;
}
interface Attachment {
  id: string; filename: string; url: string; mimeType: string; size: number;
}
interface Ticket {
  id: string; ticket_no: string; type: string; category: string; title: string; content: string;
  status: string; moderationStatus: string; targetOrganization: string | null; createdAt: string;
  priority: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  slaDueAt: string | null;
  slaOverdue: boolean;
  sender: PenulisTiket;
  replies: Reply[];
  assignments: Assignment[];
  attachments: Attachment[];
}

interface TemplateBalasan {
  id: string;
  title: string;
  content: string;
}

const PRIORITAS = ['RENDAH', 'NORMAL', 'TINGGI', 'MENDESAK'] as const;
const GAYA_PRIORITAS: Record<string, string> = {
  RENDAH: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  NORMAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  TINGGI: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  MENDESAK: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
interface Assignee {
  id: string; nim: string; role: string; organisasi: string;
  profile: { nama: string; program_studi: string } | null;
}

export default function Tickets() {
  const { user } = useAuth();
  const isMahasiswa = user?.role === 'MAHASISWA';
  const staff = isStaff(user?.role);
  // Melepas penugasan & menghapus tiket hanya untuk DPM ke atas (BEM bukan).
  const bolehHapusTiket = ['PENGURUS_DPM', 'ADMIN', 'SUPERADMIN'].includes(user?.role || '');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assigneesList, setAssigneesList] = useState<Assignee[]>([]);
  const [templates, setTemplates] = useState<TemplateBalasan[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchParams] = useSearchParams();
  const kataCari = (searchParams.get('search') || '').toLowerCase();

  // State Modal Buat Tiket
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    type: 'ASPIRASI', category: 'FASILITAS', title: '', content: '',
    targetOrganization: 'DPM' as (typeof TICKET_TARGETS)[number],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Balas & Assign
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [templateDipilih, setTemplateDipilih] = useState<Record<string, string>>({});
  const [selectedAssignee, setSelectedAssignee] = useState<{ [ticketId: string]: string }>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // State penilaian tiket oleh pengirim.
  const [nilaiTiket, setNilaiTiket] = useState<Ticket | null>(null);
  const [bintang, setBintang] = useState(5);
  const [komentarNilai, setKomentarNilai] = useState('');
  const [menyimpanNilai, setMenyimpanNilai] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get('/tickets');
      setTickets(response.data.data);

      if (!isMahasiswa) {
        const [assigneesRes, templatesRes] = await Promise.all([
          api.get('/tickets/assignees'),
          api.get('/tickets/templates'),
        ]);
        setAssigneesList(assigneesRes.data.data);
        setTemplates(templatesRes.data.data);
      }
    } catch (error) { console.error('Gagal memuat data tiket:', error); }
    finally { setLoading(false); }
  }, [isMahasiswa]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('type', newTicket.type);
    formData.append('category', newTicket.category);
    formData.append('title', newTicket.title);
    formData.append('content', newTicket.content);

    // Aspirasi selalu menuju BEM, keluhan wajib memilih organisasi tujuan.
    if (newTicket.type === 'KELUHAN') {
      formData.append('targetOrganization', newTicket.targetOrganization);
    }

    if (selectedFile) formData.append('file', selectedFile);

    try {
      await api.post('/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsModalOpen(false);
      setNewTicket({ type: 'ASPIRASI', category: 'FASILITAS', title: '', content: '', targetOrganization: 'DPM' });
      setSelectedFile(null);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal mengirim tiket. Pastikan file maksimal 5MB (gambar apa pun atau PDF).');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5MB.');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmitReply = async (ticketId: string) => {
    if (!replyContent.trim()) return;
    try {
      await api.post(`/tickets/${ticketId}/replies`, { content: replyContent });
      setReplyingTo(null); setReplyContent('');
      setTemplateDipilih((p) => ({ ...p, [ticketId]: '' }));
      fetchData();
    } catch (error) { console.error(error); alert('Gagal mengirim balasan'); }
  };

  const handlePriority = async (ticketId: string, priority: string) => {
    setBusyId(ticketId);
    try {
      await api.patch(`/tickets/${ticketId}/priority`, { priority });
      fetchData();
    } catch (error) { console.error(error); alert('Gagal mengubah prioritas tiket.'); }
    finally { setBusyId(null); }
  };

  const pakaiTemplate = (ticketId: string, templateId: string) => {
    const templat = templates.find((t) => t.id === templateId);
    setTemplateDipilih((p) => ({ ...p, [ticketId]: templateId }));
    if (templat) {
      setReplyingTo(ticketId);
      setReplyContent(templat.content);
    }
  };

  const simpanSebagaiTemplate = async () => {
    if (!replyContent.trim()) {
      alert('Tulis isi balasan terlebih dahulu, lalu simpan sebagai template.');
      return;
    }
    const judul = window.prompt('Nama template balasan:', 'Balasan umum');
    if (!judul?.trim()) return;
    try {
      const res = await api.post('/tickets/templates', {
        title: judul.trim(),
        content: replyContent.trim(),
      });
      setTemplates((lama) => [res.data.data, ...lama]);
      alert('Template tersimpan dan bisa dipakai pada tiket lain.');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan template.');
    }
  };

  const bukaNilai = (ticket: Ticket) => {
    setNilaiTiket(ticket);
    setBintang(ticket.rating || 5);
    setKomentarNilai(ticket.ratingComment || '');
  };

  const simpanNilai = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nilaiTiket) return;
    setMenyimpanNilai(true);
    try {
      await api.post(`/tickets/${nilaiTiket.id}/rating`, {
        rating: bintang,
        comment: komentarNilai.trim() || undefined,
      });
      setNilaiTiket(null);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan penilaian.');
    } finally {
      setMenyimpanNilai(false);
    }
  };

  const handleUnassign = async (ticket: Ticket) => {
    if (!window.confirm(`Lepas penugasan tiket #${ticket.ticket_no}? Tiket tetap ada dan bisa ditugaskan ulang.`)) return;
    setBusyId(ticket.id);
    try {
      await api.delete(`/tickets/${ticket.id}/assign`);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal melepas penugasan tiket.');
    } finally { setBusyId(null); }
  };

  const handleDeleteTicket = async (ticket: Ticket) => {
    if (!window.confirm(
      `Hapus tiket #${ticket.ticket_no} "${ticket.title}" beserta seluruh balasan dan lampirannya? Tindakan ini tidak dapat dibatalkan.`
    )) return;
    setBusyId(ticket.id);
    try {
      await api.delete(`/tickets/${ticket.id}`);
      setTickets((lama) => lama.filter((t) => t.id !== ticket.id));
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus tiket.');
    } finally { setBusyId(null); }
  };

  const handleAssign = async (ticketId: string) => {
    const assigneeId = selectedAssignee[ticketId];
    if (!assigneeId) return alert('Pilih pengurus terlebih dahulu.');
    setBusyId(ticketId);
    try {
      await api.post(`/tickets/${ticketId}/assign`, { assigneeId });
      alert('Pendelegasian tiket berhasil!');
      fetchData();
    } catch (error) { console.error(error); alert('Gagal delegasi tiket'); }
    finally { setBusyId(null); }
  };

  const handleModeration = async (ticketId: string, moderationStatus: string) => {
    setBusyId(ticketId);
    try {
      await api.put(`/tickets/${ticketId}/moderation`, { moderationStatus });
      fetchData();
    } catch (error) { console.error(error); alert('Gagal mengubah status moderasi'); }
    finally { setBusyId(null); }
  };

  const handleStatus = async (ticketId: string, status: string) => {
    setBusyId(ticketId);
    try {
      await api.put(`/tickets/${ticketId}/moderation`, { status });
      fetchData();
    } catch (error) { console.error(error); alert('Gagal mengubah status tiket'); }
    finally { setBusyId(null); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/tickets/export/keluhan', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-keluhan-${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Gagal mengekspor data keluhan.');
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DIKIRIM': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">DIKIRIM</span>;
      case 'DITINJAU': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">DITINJAU</span>;
      case 'DIPROSES': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 flex items-center gap-1"><Clock className="w-3 h-3" /> DIPROSES</span>;
      case 'SELESAI': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> SELESAI</span>;
      case 'DITOLAK': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 flex items-center gap-1"><XCircle className="w-3 h-3" /> DITOLAK</span>;
      default: return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">{status}</span>;
    }
  };

  const infoAkses = () => {
    switch (user?.role) {
      case 'PENGURUS_BEM':
        return 'Anda melihat seluruh ASPIRASI mahasiswa. Aspirasi tampil di halaman publik dengan nama & NIM pengirim.';
      case 'PENGURUS_DPM':
        return 'Anda melihat seluruh KELUHAN mahasiswa dan berhak mengaudit datanya ke Excel. Keluhan tampil anonim di halaman publik.';
      case 'PENGURUS_SISTEM_INFORMASI':
      case 'PENGURUS_TEKNIK_MESIN':
      case 'PENGURUS_TEKNIK_SIPIL':
        return `Anda melihat tiket yang ditujukan ke ${ROLE_LABEL[user.role]} serta tiket yang ditugaskan kepada Anda.`;
      case 'ADMIN':
      case 'SUPERADMIN':
        return 'Anda melihat seluruh tiket, dapat menugaskan pengurus dari organisasi mana pun, dan menetapkan role pengurus di halaman Data Mahasiswa.';
      default:
        return 'Anda melihat tiket milik sendiri. Aspirasi tampil publik dengan identitas, keluhan tampil anonim.';
    }
  };

  const terlihat = tickets.filter((t) => {
    if (!kataCari) return true;
    return (
      t.ticket_no.toLowerCase().includes(kataCari) ||
      t.title.toLowerCase().includes(kataCari) ||
      (t.sender.profile?.nama || t.sender.nim).toLowerCase().includes(kataCari)
    );
  });

  return (
    <div className="max-w-5xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <MessageSquare className="w-6 h-6 text-amber-400" /> Layanan Tiket
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isMahasiswa ? 'Sampaikan aspirasi atau keluhan Anda.' : 'Kelola dan tanggapi tiket mahasiswa.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canExportKeluhan(user?.role) && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 font-bold text-gray-700 dark:text-gray-300 transition bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Audit Keluhan (Excel)
            </button>
          )}
          {isMahasiswa && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 font-bold text-white transition-all rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Buat Tiket Baru
            </button>
          )}
        </div>
      </div>

      {/* Keterangan hak akses */}
      <div className="flex items-start gap-3 p-4 text-sm text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/60">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <p>{infoAkses()}</p>
      </div>

      <div className="space-y-4">
        {loading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
          : terlihat.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-xl">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Belum ada tiket</p>
            </div>
          )
          : terlihat.map(ticket => {
            const activeAssignment = ticket.assignments[0];

            return (
              <div key={ticket.id} className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
                <div className="p-6">
                  <div className="flex justify-between gap-4 mb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${ticket.type === 'ASPIRASI' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'}`}>{ticket.type}</span>
                        {ticket.targetOrganization && (
                          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-md bg-gray-100 dark:bg-gray-800">
                            <Building2 className="w-3 h-3" /> {targetLabel(ticket.targetOrganization)}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${GAYA_PRIORITAS[ticket.priority] || GAYA_PRIORITAS.NORMAL}`}>
                          {ticket.priority}
                        </span>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">#{ticket.ticket_no}</span>
                        {ticket.moderationStatus === 'PUBLISHED' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-green-800 dark:text-green-300 rounded-full bg-green-100 dark:bg-green-900/40">
                            <Eye className="w-3 h-3" /> TAMPIL PUBLIK
                          </span>
                        )}
                        {ticket.moderationStatus === 'PENDING_MODERATION' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200 rounded-full bg-amber-100 dark:bg-amber-900/40">
                            <EyeOff className="w-3 h-3" /> MENUNGGU MODERASI
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{ticket.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <UserAvatar
                          userId={ticket.sender.id}
                          nama={ticket.sender.profile?.nama || ticket.sender.nim}
                          foto={ticket.sender.foto ?? null}
                          size="sm"
                        />
                        <p>
                          Kategori: {ticket.category} • Pengirim:{' '}
                          <span className="font-bold text-gray-700 dark:text-gray-200">
                            {ticket.sender.profile?.nama || ticket.sender.nim} ({ticket.sender.nim})
                          </span>{' '}
                          • {new Date(ticket.createdAt).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                        {ticket.type === 'KELUHAN'
                          ? 'Identitas pengirim disembunyikan saat tiket ini tampil di halaman publik.'
                          : 'Aspirasi ini tampil di halaman publik dengan nama & NIM pengirim.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-medium">
                        {ticket.firstResponseAt ? (
                          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300">
                            <Timer className="w-3.5 h-3.5" /> Respons pertama {new Date(ticket.firstResponseAt).toLocaleString('id-ID')}
                          </span>
                        ) : ticket.status !== 'SELESAI' && ticket.status !== 'DITOLAK' ? (
                          <span className={`inline-flex items-center gap-1 ${ticket.slaOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            <Timer className="w-3.5 h-3.5" />
                            {ticket.slaOverdue ? 'SLA terlampaui' : 'Batas respons'}{' '}
                            {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString('id-ID') : '-'}
                          </span>
                        ) : null}
                        {ticket.rating !== null && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                            <Star className="w-3.5 h-3.5 fill-current" /> {ticket.rating}/5
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {getStatusBadge(ticket.status)}
                      {ticket.sender.id === user?.id && ticket.status === 'SELESAI' && (
                        <button
                          type="button"
                          onClick={() => bukaNilai(ticket)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60"
                        >
                          <Star className="w-3.5 h-3.5" /> {ticket.rating ? 'Ubah penilaian' : 'Beri penilaian'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 mb-4 text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800 rounded-lg whitespace-pre-wrap bg-gray-50 dark:bg-gray-800">{ticket.content}</div>

                  {/* --- TAMPILAN LAMPIRAN FILE --- */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <p className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400"><Paperclip className="w-3 h-3" /> Lampiran:</p>
                      {ticket.attachments.map(att => {
                        const isImage = att.mimeType.includes('image');
                        const fileUrl = assetUrl(att.url);
                        return (
                          <a key={att.id} href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-500 text-xs font-bold rounded-lg border border-amber-100 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition">
                            {isImage ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                            Lihat File
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {activeAssignment && (
                    <div className="flex items-center gap-2 p-3 mt-2 border rounded-lg border-amber-100 dark:border-amber-900/60 bg-amber-50/50">
                      <UserAvatar
                        userId={activeAssignment.assignee.id}
                        nama={activeAssignment.assignee.profile?.nama || activeAssignment.assignee.nim}
                        foto={activeAssignment.assignee.foto ?? null}
                        size="sm"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        <UserCog className="inline w-4 h-4 mr-1 text-amber-400" />
                        Sedang ditangani oleh:{' '}
                        <span className="font-bold text-amber-500">
                          {activeAssignment.assignee.profile?.nama || activeAssignment.assignee.nim}
                        </span>{' '}
                        <span className="text-xs text-gray-500 dark:text-gray-400">({ROLE_LABEL[activeAssignment.assignee.role] || activeAssignment.assignee.role})</span>
                      </span>
                    </div>
                  )}

                  {ticket.replies.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300"><MessageSquare className="w-4 h-4" /> Balasan Pengurus:</h4>
                      {ticket.replies.map(reply => (
                        <div key={reply.id} className="pl-4 ml-4 border-l-2 border-amber-50">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <UserAvatar
                              userId={reply.author.id}
                              nama={reply.author.profile?.nama || reply.author.nim}
                              foto={reply.author.foto ?? null}
                              size="xs"
                            />
                            <span className="font-semibold text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-500">
                              {reply.author.profile?.nama || reply.author.nim} • {ROLE_LABEL[reply.author.role] || reply.author.role}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(reply.createdAt).toLocaleString('id-ID')}</span>
                          </div>
                          <p className="inline-block p-3 mt-1 text-sm text-gray-600 dark:text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-800">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {staff && (
                    <div className="flex flex-col gap-4 pt-4 mt-6 border-t border-gray-100 dark:border-gray-800">
                      {/* Baris 1: delegasi + moderasi */}
                      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center w-full gap-2 md:w-auto">
                          <select
                            className="p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700 bg-gray-50 dark:bg-gray-800"
                            value={selectedAssignee[ticket.id] || ''}
                            onChange={(e) => setSelectedAssignee({ ...selectedAssignee, [ticket.id]: e.target.value })}
                          >
                            <option value="" disabled>Pilih Pengurus...</option>
                            {assigneesList.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.profile?.nama || a.nim} — {ROLE_LABEL[a.role] || a.role}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssign(ticket.id)}
                            disabled={busyId === ticket.id}
                            className="px-3 py-2 text-sm font-medium text-white transition-all bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 disabled:opacity-60"
                          >
                            Tugaskan
                          </button>
                          {activeAssignment && bolehHapusTiket && (
                            <button
                              onClick={() => handleUnassign(ticket)}
                              disabled={busyId === ticket.id}
                              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-60 dark:text-amber-200 dark:bg-amber-950/50 dark:border-amber-900/60"
                            >
                              <UserMinus className="w-3.5 h-3.5" /> Lepas Penugasan
                            </button>
                          )}
                          {bolehHapusTiket && (
                            <button
                              onClick={() => handleDeleteTicket(ticket)}
                              disabled={busyId === ticket.id}
                              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-60 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900/60"
                              title="Hapus tiket beserta balasan dan lampiran"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus Tiket
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <select
                            className="p-2 text-sm font-bold border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                            value={ticket.priority}
                            onChange={(e) => handlePriority(ticket.id, e.target.value)}
                            disabled={busyId === ticket.id}
                            title="Prioritas tiket"
                          >
                            {PRIORITAS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <select
                            className="p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                            value={ticket.status}
                            onChange={(e) => handleStatus(ticket.id, e.target.value)}
                          >
                            <option value="DIKIRIM">DIKIRIM</option>
                            <option value="DITINJAU">DITINJAU</option>
                            <option value="DIPROSES">DIPROSES</option>
                            <option value="SELESAI">SELESAI</option>
                            <option value="DITOLAK">DITOLAK</option>
                          </select>

                          {ticket.moderationStatus === 'PUBLISHED' ? (
                            <button
                              onClick={() => handleModeration(ticket.id, 'REJECTED')}
                              disabled={busyId === ticket.id}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-60"
                            >
                              <EyeOff className="w-3.5 h-3.5" /> Sembunyikan dari Publik
                            </button>
                          ) : (
                            <button
                              onClick={() => handleModeration(ticket.id, 'PUBLISHED')}
                              disabled={busyId === ticket.id}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-green-800 dark:text-green-300 bg-green-100 dark:bg-green-900/40 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-60"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Tampilkan ke Publik
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Baris 2: balasan */}
                      {replyingTo === ticket.id ? (
                        <div className="w-full space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                              <BookOpen className="w-3.5 h-3.5" /> Template
                            </label>
                            <select
                              className="flex-1 min-w-[180px] p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                              value={templateDipilih[ticket.id] || ''}
                              onChange={(e) => pakaiTemplate(ticket.id, e.target.value)}
                            >
                              <option value="">Pilih template balasan...</option>
                              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => simpanSebagaiTemplate()}
                              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                            >
                              <Save className="w-3.5 h-3.5" /> Simpan template
                            </button>
                          </div>
                          <div className="flex flex-col w-full gap-2 md:flex-row">
                            <textarea
                              rows={3}
                              placeholder="Tulis balasan resmi..."
                              className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                            />
                            <div className="flex gap-2 md:flex-col">
                              <button onClick={() => { setReplyingTo(null); setReplyContent(''); }} className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">Batal</button>
                              <button onClick={() => handleSubmitReply(ticket.id)} className="px-3 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500">Kirim</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setReplyingTo(ticket.id)} className="flex items-center gap-1 px-3 py-2 text-sm font-bold transition-colors rounded-lg w-max text-amber-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/60">
                          <MessageSquare className="w-4 h-4" /> Balas Tiket
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Buat tiket baru" className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity bg-gray-900/50 backdrop-blur-sm">
          <div className="flex flex-col w-full max-w-lg overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Buat Tiket Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmitTicket} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Jenis Tiket</label>
                  <select
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 bg-gray-50 dark:bg-gray-800"
                    value={newTicket.type}
                    onChange={(e) => setNewTicket({ ...newTicket, type: e.target.value })}
                  >
                    <option value="ASPIRASI">Aspirasi</option>
                    <option value="KELUHAN">Keluhan</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Kategori</label>
                  <select
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 bg-gray-50 dark:bg-gray-800"
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                  >
                    <option value="FASILITAS">Fasilitas Kampus</option>
                    <option value="AKADEMIK">Akademik</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Pilihan organisasi tujuan: hanya untuk keluhan */}
              {newTicket.type === 'KELUHAN' ? (
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Keluhan Ditujukan Kepada</label>
                  <select
                    required
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 bg-gray-50 dark:bg-gray-800"
                    value={newTicket.targetOrganization}
                    onChange={(e) => setNewTicket({ ...newTicket, targetOrganization: e.target.value as (typeof TICKET_TARGETS)[number] })}
                  >
                    {TICKET_TARGETS.map((t) => <option key={t} value={t}>{targetLabel(t)}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Keluhan langsung diterima pengurus organisasi yang dipilih dan tampil anonim di halaman publik.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 text-xs text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-950/60">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Aspirasi otomatis diteruskan ke <span className="font-bold">PENGURUS BEM</span> dan tampil di halaman publik dengan nama serta NIM Anda.</span>
                </div>
              )}

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Judul Topik</label>
                <input
                  type="text" required placeholder="Contoh: AC Ruang A1 Rusak"
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-300"
                  value={newTicket.title} onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">Detail Informasi</label>
                <textarea
                  required rows={4} placeholder="Jelaskan secara detail keluhan atau aspirasi Anda..."
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg resize-none outline-none focus:ring-2 focus:ring-amber-300"
                  value={newTicket.content} onChange={(e) => setNewTicket({ ...newTicket, content: e.target.value })}
                ></textarea>
              </div>

              {/* --- INPUT FILE (LAMPIRAN) --- */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-bold text-gray-700 dark:text-gray-300"><Paperclip className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Bukti Lampiran (Opsional)</label>
                <input type="file" ref={fileInputRef} accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">Pilih File...</button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{selectedFile ? selectedFile.name : 'Maks 5MB (gambar/PDF) · gambar otomatis WebP'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 mt-6 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2 font-bold text-white transition-all rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim Tiket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {nilaiTiket && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Beri penilaian tiket"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
          onClick={() => setNilaiTiket(null)}
        >
          <form
            onSubmit={simpanNilai}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Nilai Layanan Tiket</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  #{nilaiTiket.ticket_no} — {nilaiTiket.title}
                </p>
              </div>
              <button type="button" onClick={() => setNilaiTiket(null)} aria-label="Tutup" className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">Seberapa puas Anda dengan penanganannya?</p>
                <div className="flex gap-1" role="group" aria-label="Pilih bintang 1 sampai 5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBintang(n)}
                      aria-label={`${n} bintang`}
                      aria-pressed={bintang === n}
                      className={`p-1.5 rounded-lg transition ${n <= bintang ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} hover:bg-amber-50 dark:hover:bg-amber-950/60`}
                    >
                      <Star className={`w-7 h-7 ${n <= bintang ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{bintang} dari 5 bintang</p>
              </div>

              <div>
                <label htmlFor="komentar-nilai" className="block mb-1 text-sm font-bold text-gray-700 dark:text-gray-300">
                  Catatan (opsional)
                </label>
                <textarea
                  id="komentar-nilai"
                  rows={3}
                  maxLength={1000}
                  value={komentarNilai}
                  onChange={(e) => setKomentarNilai(e.target.value)}
                  placeholder="Apa yang sudah baik, atau apa yang perlu ditingkatkan?"
                  className="w-full p-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setNilaiTiket(null)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800">
                Batal
              </button>
              <button type="submit" disabled={menyimpanNilai} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50">
                {menyimpanNilai ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim penilaian'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
