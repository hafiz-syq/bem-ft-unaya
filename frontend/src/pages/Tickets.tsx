import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { Plus, MessageSquare, Clock, CheckCircle, XCircle, Search, Loader2, UserCog, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';

interface Reply {
  id: string; content: string; createdAt: string; author: { nim: string; role: string };
}
interface Assignment {
  id: string; isActive: boolean; assignee: { profile: { nama: string } | null };
}
interface Attachment {
  id: string; filename: string; url: string; mimeType: string; size: number;
}
interface Ticket {
  id: string; ticket_no: string; type: string; category: string; title: string; content: string; status: string; createdAt: string;
  sender: { nim: string; role: string };
  replies: Reply[];
  assignments: Assignment[];
  attachments: Attachment[];
}
interface Assignee {
  id: string; nim: string; role: string; profile: { nama: string } | null;
}

export default function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assigneesList, setAssigneesList] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Buat Tiket
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ type: 'ASPIRASI', category: 'FASILITAS', title: '', content: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Balas & Assign
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<{ [ticketId: string]: string }>({});

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get('/tickets');
      setTickets(response.data.data);

      if (user?.role !== 'MAHASISWA') {
        const assigneesRes = await api.get('/tickets/assignees');
        setAssigneesList(assigneesRes.data.data);
      }
    } catch (error) { console.error('Gagal memuat data tiket:', error); }
    finally { setLoading(false); }
  }, [user]);

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

    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    try {
      await api.post('/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setIsModalOpen(false);
      setNewTicket({ type: 'ASPIRASI', category: 'FASILITAS', title: '', content: '' });
      setSelectedFile(null);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Gagal mengirim tiket. Pastikan file max 5MB (JPG/PNG/PDF).');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran file maksimal 5MB.");
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
      setReplyingTo(null); setReplyContent(''); fetchData();
    } catch (error) { console.error(error); alert('Gagal mengirim balasan'); }
  };

  const handleAssign = async (ticketId: string) => {
    const assigneeId = selectedAssignee[ticketId];
    if (!assigneeId) return alert('Pilih pengurus terlebih dahulu.');
    try {
      await api.post(`/tickets/${ticketId}/assign`, { assigneeId });
      alert('Pendelegasian tiket berhasil!');
      fetchData();
    } catch (error) { console.error(error); alert('Gagal delegasi tiket'); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DIKIRIM': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">DIKIRIM</span>;
      case 'DIPROSES': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock className="w-3 h-3" /> DIPROSES</span>;
      case 'SELESAI': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> SELESAI</span>;
      case 'DITOLAK': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center gap-1"><XCircle className="w-3 h-3" /> DITOLAK</span>;
      default: return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="max-w-5xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><MessageSquare className="w-6 h-6 text-amber-400" /> Layanan Tiket BEM</h1>
          <p className="mt-1 text-sm text-gray-500">{user?.role === 'MAHASISWA' ? 'Sampaikan aspirasi atau keluhan Anda.' : 'Kelola dan tanggapi tiket mahasiswa.'}</p>
        </div>
        {user?.role === 'MAHASISWA' && (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 font-bold text-white transition-all rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95">
            <Plus className="w-4 h-4" /> Buat Tiket Baru
          </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
          : tickets.length === 0 ? <div className="p-12 text-center text-gray-500 bg-white rounded-xl"><Search className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p className="text-lg font-medium text-gray-900">Belum ada tiket</p></div>
            : tickets.map(ticket => {
              const activeAssignment = ticket.assignments[0];

              return (
                <div key={ticket.id} className="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
                  <div className="p-6">
                    <div className="flex justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${ticket.type === 'ASPIRASI' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{ticket.type}</span>
                          <span className="text-sm font-medium text-gray-500">#{ticket.ticket_no}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{ticket.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">Kategori: {ticket.category} • Pengirim: <span className="font-bold">{ticket.sender.nim}</span> • {new Date(ticket.createdAt).toLocaleDateString('id-ID')}</p>
                      </div>
                      <div>{getStatusBadge(ticket.status)}</div>
                    </div>

                    <div className="p-4 mb-4 text-sm text-gray-700 border border-gray-100 rounded-lg bg-gray-50">{ticket.content}</div>

                    {/* --- TAMPILAN LAMPIRAN FILE --- */}
                    {ticket.attachments && ticket.attachments.length > 0 && (
                      <div className="flex items-center gap-2 mb-4">
                        <p className="flex items-center gap-1 text-xs font-bold text-gray-500"><Paperclip className="w-3 h-3" /> Lampiran:</p>
                        {ticket.attachments.map(att => {
                          const isImage = att.mimeType.includes('image');
                          const fileUrl = `http://localhost:3000${att.url}`;
                          return (
                            <a key={att.id} href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-500 text-xs font-bold rounded-lg border border-amber-100 hover:bg-amber-100 transition">
                              {isImage ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                              Lihat File
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {activeAssignment && (
                      <div className="flex items-center gap-2 p-3 mt-2 border rounded-lg border-amber-100 bg-amber-50/50">
                        <UserCog className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-gray-700">Sedang ditangani oleh: <span className="font-bold text-amber-500">{activeAssignment.assignee.profile?.nama || 'Pengurus BEM'}</span></span>
                      </div>
                    )}

                    {ticket.replies.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700"><MessageSquare className="w-4 h-4" /> Balasan BEM:</h4>
                        {ticket.replies.map(reply => (
                          <div key={reply.id} className="pl-4 ml-4 border-l-2 border-amber-50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-500">{reply.author.role}</span>
                              <span className="text-[10px] text-gray-500">{new Date(reply.createdAt).toLocaleString('id-ID')}</span>
                            </div>
                            <p className="inline-block p-3 mt-1 text-sm text-gray-600 rounded-lg bg-gray-50">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {user?.role !== 'MAHASISWA' && (
                      <div className="flex flex-col items-start justify-between gap-6 pt-4 mt-6 border-t border-gray-100 md:flex-row">
                        <div className="flex items-center w-full gap-2 md:w-auto">
                          <select className="p-2 text-sm border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300 bg-gray-50" value={selectedAssignee[ticket.id] || ''} onChange={(e) => setSelectedAssignee({ ...selectedAssignee, [ticket.id]: e.target.value })}>
                            <option value="" disabled>Pilih Pengurus...</option>
                            {assigneesList.map(a => (<option key={a.id} value={a.id}>{a.profile?.nama || a.nim} ({a.role})</option>))}
                          </select>
                          <button onClick={() => handleAssign(ticket.id)} className="px-3 py-2 text-sm font-medium text-white transition-all bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95">Tugaskan</button>
                        </div>

                        {replyingTo === ticket.id ? (
                          <div className="flex flex-col w-full gap-2 md:w-1/2 md:flex-row">
                            <input type="text" placeholder="Tulis balasan resmi..." className="w-full p-2 text-sm border border-gray-300 rounded-lg" value={replyContent} onChange={(e) => setReplyContent(e.target.value)} />
                            <div className="flex gap-2">
                              <button onClick={() => { setReplyingTo(null); setReplyContent(''); }} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
                              <button onClick={() => handleSubmitReply(ticket.id)} className="px-3 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500">Kirim</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setReplyingTo(ticket.id)} className="flex items-center gap-1 px-3 py-2 text-sm font-bold transition-colors rounded-lg text-amber-400 hover:text-amber-500 hover:bg-amber-50"><MessageSquare className="w-4 h-4" /> Balas Tiket</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity bg-gray-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden transition-transform transform scale-100 bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="text-xl font-bold text-gray-900">Buat Tiket Baru</h2><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button></div>
            <form onSubmit={handleSubmitTicket} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block mb-1 text-sm font-bold text-gray-700">Jenis Tiket</label><select className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 bg-gray-50" value={newTicket.type} onChange={(e) => setNewTicket({ ...newTicket, type: e.target.value })}><option value="ASPIRASI">Aspirasi</option><option value="KELUHAN">Keluhan</option></select></div>
                <div><label className="block mb-1 text-sm font-bold text-gray-700">Kategori</label><select className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300 bg-gray-50" value={newTicket.category} onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}><option value="FASILITAS">Fasilitas Kampus</option><option value="AKADEMIK">Akademik</option><option value="LAINNYA">Lainnya</option></select></div>
              </div>
              <div><label className="block mb-1 text-sm font-bold text-gray-700">Judul Topik</label><input type="text" required placeholder="Contoh: AC Ruang A1 Rusak" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-300" value={newTicket.title} onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })} /></div>
              <div><label className="block mb-1 text-sm font-bold text-gray-700">Detail Informasi</label><textarea required rows={4} placeholder="Jelaskan secara detail keluhan atau aspirasi Anda..." className="w-full p-2.5 border border-gray-300 rounded-lg resize-none outline-none focus:ring-2 focus:ring-amber-300" value={newTicket.content} onChange={(e) => setNewTicket({ ...newTicket, content: e.target.value })}></textarea></div>

              {/* --- INPUT FILE (LAMPIRAN) --- */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-bold text-gray-700"><Paperclip className="w-4 h-4 text-gray-500" /> Bukti Lampiran (Opsional)</label>
                <input type="file" ref={fileInputRef} accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} className="hidden" />
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-sm font-medium text-gray-700 transition bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200">Pilih File...</button>
                  <span className="text-xs text-gray-500 truncate max-w-[200px]">{selectedFile ? selectedFile.name : 'Maks 5MB (JPG/PNG/PDF)'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 mt-6 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2 font-bold text-white transition-all rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim Tiket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}