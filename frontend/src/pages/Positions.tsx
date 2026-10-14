import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { UserPlus, Loader2, XCircle, ShieldCheck, Building2, Trash2 } from 'lucide-react';
import axios from 'axios';

interface Department { id: string; name: string; }
interface Organization { id: string; name: string; departments: Department[]; }
interface PositionSlot {
    id: string;
    title: string;
    organizationId: string;
    department: Department | null;
    positions: { user: { nim: string; profile: { nama: string } | null } }[];
}

export default function Positions() {
    const [slots, setSlots] = useState<PositionSlot[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State Modals
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [removePositionId, setRemovePositionId] = useState<string | null>(null);

    // Form Buat Jabatan
    const [newSlot, setNewSlot] = useState({ organizationId: '', departmentId: '', title: '' });

    // Form Angkat Pengurus
    const [assignData, setAssignData] = useState({ positionSlotId: '', nim: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const fetchData = async () => {
        try {
            const [slotsRes, orgsRes] = await Promise.all([
                api.get('/positions'),
                api.get('/organizations')
            ]);
            setSlots(slotsRes.data.data);
            setOrganizations(orgsRes.data.data);

            // Set default selected Org jika ada
            if (orgsRes.data.data.length > 0) {
                setNewSlot(prev => ({ ...prev, organizationId: orgsRes.data.data[0].id }));
            }
        } catch {
            setError('Gagal memuat data kepengurusan.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
    }, []);

    const handleCreateSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/positions/slots', newSlot);
            setIsSlotModalOpen(false);
            setNewSlot({ ...newSlot, title: '', departmentId: '' });
            fetchData();
        } catch (err) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal membuat jabatan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/positions/assign', assignData);
            setIsAssignModalOpen(false);
            setAssignData({ positionSlotId: '', nim: '' });
            fetchData();
            alert('Berhasil! Mahasiswa tersebut kini telah menjadi Pengurus.');
        } catch (err) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal mengangkat pengurus');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemovePosition = async () => {
        if (!removePositionId) return;
        setIsRemoving(true);
        try {
            await api.delete(`/positions/${removePositionId}`);
            setIsRemoveModalOpen(false);
            setRemovePositionId(null);
            fetchData();
            alert('Berhasil! Pengurus tersebut telah diturunkan.');
        } catch (err) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal menurunkan pengurus');
        } finally {
            setIsRemoving(false);
        }
    };

    const getOrgName = (orgId: string) => organizations.find(o => o.id === orgId)?.name || '-';

    // Daftar departemen berdasarkan organisasi yang dipilih di form
    const selectedOrgDepartments = organizations.find(o => o.id === newSlot.organizationId)?.departments || [];

    return (
        <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
            <div className="flex flex-col justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <UserPlus className="w-6 h-6 text-amber-400" />
                        Manajemen Kepengurusan
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">Buat slot jabatan dan angkat mahasiswa menjadi pengurus BEM.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsSlotModalOpen(true)} className="flex items-center gap-2 px-4 py-2 font-medium text-gray-700 transition bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        <Building2 className="w-4 h-4" /> Buat Jabatan Baru
                    </button>
                    <button onClick={() => setIsAssignModalOpen(true)} className="flex items-center gap-2 px-4 py-2 font-medium text-white transition rounded-lg bg-amber-400 hover:bg-amber-500">
                        <ShieldCheck className="w-4 h-4" /> Angkat Pengurus
                    </button>
                </div>
            </div>

            {error && <div className="p-4 text-red-600 rounded-lg bg-red-50">{error}</div>}

            {/* Grid Jabatan */}
            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
            ) : slots.length === 0 ? (
                <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-900">Belum ada jabatan</p>
                    <p>Klik tombol 'Buat Jabatan Baru' untuk memulai.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {slots.map(slot => {
                        const activeUser = slot.positions[0]?.user;
                        return (
                            <div key={slot.id} className="flex flex-col h-full p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
                                <div className="flex-1 mb-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-lg font-bold leading-tight text-gray-900">{slot.title}</h3>
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wide ${activeUser ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {activeUser ? 'Terisi' : 'Kosong'}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-gray-500">{getOrgName(slot.organizationId)}</p>
                                    {slot.department && <p className="mt-1 text-xs font-medium text-amber-400">• {slot.department.name}</p>}
                                </div>                                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                    {activeUser ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 text-xs font-bold rounded-full bg-amber-100 text-amber-400">
                                                {activeUser.profile?.nama.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 truncate">{activeUser.profile?.nama || 'Tanpa Nama'}</p>
                                                <p className="text-xs text-gray-500">{activeUser.nim}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm italic text-gray-400">Belum ada pejabat</p>
                                    )}
                                    {activeUser && (
                                        <button
                                            onClick={() => { setRemovePositionId(slot.positions[0].id); setIsRemoveModalOpen(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 transition rounded-lg bg-red-50 hover:bg-red-100"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Turunkan
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Buat Jabatan */}
            {isSlotModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Buat Jabatan Baru</h2>
                            <button onClick={() => setIsSlotModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleCreateSlot} className="p-6 space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Organisasi Induk</label>
                                <select required className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={newSlot.organizationId} onChange={(e) => setNewSlot({ ...newSlot, organizationId: e.target.value, departmentId: '' })}>
                                    <option value="" disabled>Pilih Organisasi...</option>
                                    {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Departemen <span className="font-normal text-gray-400">(Opsional)</span></label>
                                <select className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={newSlot.departmentId} onChange={(e) => setNewSlot({ ...newSlot, departmentId: e.target.value })}>
                                    <option value="">-- Tidak Terikat Departemen --</option>
                                    {selectedOrgDepartments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Nama Jabatan</label>
                                <input type="text" required placeholder="Contoh: Ketua BEM / Menteri Kominfo" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={newSlot.title} onChange={(e) => setNewSlot({ ...newSlot, title: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsSlotModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-amber-400 hover:bg-amber-500">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Jabatan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Turunkan Pengurus */}
            {isRemoveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-sm overflow-hidden bg-white shadow-2xl rounded-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Konfirmasi Turunkan</h2>
                            <button onClick={() => setIsRemoveModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                                <div className="flex items-center justify-center w-10 h-10 text-lg font-bold rounded-full bg-red-100 text-red-600">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Yakin ingin menurunkan?</p>
                                    <p className="text-xs text-gray-500 mt-1">Pengurus akan dikembalikan ke status mahasiswa biasa.</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRemoveModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleRemovePosition}
                                    disabled={isRemoving}
                                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Ya, Turunkan</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Angkat Pengurus */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Angkat Pengurus</h2>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleAssign} className="p-6 space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">Pilih Jabatan</label>
                                <select required className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={assignData.positionSlotId} onChange={(e) => setAssignData({ ...assignData, positionSlotId: e.target.value })}>
                                    <option value="" disabled>Pilih slot jabatan...</option>
                                    {slots.map(slot => (
                                        <option key={slot.id} value={slot.id}>{slot.title} ({getOrgName(slot.organizationId)})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">NIM Mahasiswa</label>
                                <input type="text" required placeholder="Masukkan NIM mahasiswa..." className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300 uppercase" value={assignData.nim} onChange={(e) => setAssignData({ ...assignData, nim: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-amber-400 hover:bg-amber-500">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Angkat Pengurus'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}