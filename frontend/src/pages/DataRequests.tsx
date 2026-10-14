import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { FileEdit, Plus, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

interface ProfileData {
    nama: string;
    program_studi: string;
    email?: string;
    no_hp?: string;
}

interface DataRequest {
    id: string;
    status: string;
    requestData: ProfileData;
    reason: string;
    createdAt: string;
    user: { nim: string; profile: ProfileData | null };
    reviewer: { profile: { nama: string } } | null;
}

export default function DataRequests() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<DataRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form State (Untuk Mahasiswa)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<ProfileData>({ nama: '', program_studi: '', email: '', no_hp: '' });
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await api.get('/data-requests');

            // Pastikan backend selalu mengembalikan array, meskipun kosong
            if (response.data && Array.isArray(response.data.data)) {
                setRequests(response.data.data);
            } else {
                setRequests([]);
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                // Cek jika errornya adalah 401 (Unauthorized), biarkan App.tsx yang menangani lemparan ke login
                if (err.response?.status !== 401) {
                    setError(err.response?.data?.message || 'Gagal memuat pengajuan.');
                }
            } else {
                setError('Terjadi kesalahan internal frontend.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchRequests();
    }, []);

    // Mahasiswa: Kirim Pengajuan
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/data-requests', { requestData: formData, reason });
            setIsModalOpen(false);
            setFormData({ nama: '', program_studi: '', email: '', no_hp: '' });
            setReason('');
            fetchRequests();
            alert('Pengajuan berhasil dikirim dan menunggu validasi Admin.');
        } catch (err) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal mengirim pengajuan.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Admin: Setujui atau Tolak Pengajuan
    const handleProcess = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (!window.confirm(`Apakah Anda yakin ingin ${status === 'APPROVED' ? 'MENYETUJUI' : 'MENOLAK'} pengajuan ini?`)) return;

        try {
            await api.put(`/data-requests/${id}/process`, { status });
            fetchRequests();
        } catch (err) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal memproses pengajuan.');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> MENUNGGU</span>;
            case 'APPROVED': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> DISETUJUI</span>;
            case 'REJECTED': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> DITOLAK</span>;
            default: return null;
        }
    };

    return (
        <div className="max-w-5xl p-6 mx-auto space-y-6 md:p-8">

            <div className="flex flex-col justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <FileEdit className="w-6 h-6 text-amber-400" />
                        {user?.role === 'MAHASISWA' ? 'Pengajuan Perubahan Data' : 'Validasi Data Mahasiswa'}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {user?.role === 'MAHASISWA' ? 'Ajukan perbaikan nama, prodi, atau tambahkan kontak Anda.' : 'Tinjau dan setujui perubahan data diri mahasiswa.'}
                    </p>
                </div>

                {user?.role === 'MAHASISWA' && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 font-medium text-white transition rounded-lg bg-amber-400 hover:bg-amber-500"
                    >
                        <Plus className="w-4 h-4" /> Buat Pengajuan Baru
                    </button>
                )}
            </div>

            {error && <div className="p-4 text-red-600 rounded-lg bg-red-50">{error}</div>}

            {/* Daftar Pengajuan */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
                ) : requests.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl">
                        <FileEdit className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium text-gray-900">Belum ada pengajuan</p>
                    </div>
                ) : (
                    requests.map(req => (
                        <div key={req.id} className="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
                            <div className="flex flex-col gap-4 p-5 md:flex-row">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-sm font-bold text-gray-900">{req.user.nim}</span>
                                        <span className="text-sm text-gray-500">• {new Date(req.createdAt).toLocaleDateString('id-ID')}</span>
                                        {getStatusBadge(req.status)}
                                    </div>

                                    <p className="mt-3 mb-1 text-sm font-medium text-gray-700">Alasan Pengajuan:</p>
                                    <p className="p-3 text-sm text-gray-600 border border-gray-100 rounded-lg bg-gray-50">{req.reason || '-'}</p>

                                    <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
                                        <div className="p-3 border border-red-100 rounded-lg bg-red-50/50">
                                            <p className="mb-2 text-xs font-bold text-red-800">DATA LAMA (SAAT INI)</p>
                                            <ul className="space-y-1 text-sm text-gray-700">
                                                <li>Nama: <b>{req.user.profile?.nama}</b></li>
                                                <li>Prodi: <b>{req.user.profile?.program_studi}</b></li>
                                            </ul>
                                        </div>
                                        <div className="p-3 border border-green-100 rounded-lg bg-green-50/50">
                                            <p className="mb-2 text-xs font-bold text-green-800">DATA BARU (DIAJUKAN)</p>
                                            <ul className="space-y-1 text-sm text-gray-700">
                                                <li>Nama: <b>{req.requestData.nama}</b></li>
                                                <li>Prodi: <b>{req.requestData.program_studi}</b></li>
                                                <li>Email: <b>{req.requestData.email || '-'}</b></li>
                                                <li>No. HP: <b>{req.requestData.no_hp || '-'}</b></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Tombol Aksi untuk Admin/Pengurus jika status masih PENDING */}
                                {user?.role !== 'MAHASISWA' && req.status === 'PENDING' && (
                                    <div className="flex flex-col justify-center gap-2 pt-4 border-t border-gray-100 md:border-l md:border-gray-100 md:pl-5 md:pt-0">
                                        <button
                                            onClick={() => handleProcess(req.id, 'APPROVED')}
                                            className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Setujui
                                        </button>
                                        <button
                                            onClick={() => handleProcess(req.id, 'REJECTED')}
                                            className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-bold text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                                        >
                                            <XCircle className="w-4 h-4" /> Tolak
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Buat Pengajuan (Hanya Mahasiswa) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Form Perubahan Data</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="p-3 mb-4 text-sm rounded-lg text-amber-600 bg-amber-50-50">
                                Pastikan data yang Anda isi di bawah ini adalah data yang <b>paling benar dan terbaru</b>.
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Nama Lengkap (Perbaikan)</label>
                                <input type="text" required className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} />
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Program Studi</label>
                                <input type="text" required className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={formData.program_studi} onChange={(e) => setFormData({ ...formData, program_studi: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1 text-sm font-medium text-gray-700">Email <span className="font-normal text-gray-400">(Opsional)</span></label>
                                    <input type="email" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block mb-1 text-sm font-medium text-gray-700">No. HP / WA <span className="font-normal text-gray-400">(Opsional)</span></label>
                                    <input type="text" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={formData.no_hp} onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Alasan Perubahan</label>
                                <textarea required rows={3} placeholder="Contoh: Nama salah ketik di sistem akademik..." className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300 resize-none" value={reason} onChange={(e) => setReason(e.target.value)}></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 font-medium text-white rounded-lg bg-amber-400 hover:bg-amber-500">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim Pengajuan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}