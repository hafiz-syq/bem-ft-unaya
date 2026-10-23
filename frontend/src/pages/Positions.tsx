import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { UserPlus, Loader2, XCircle, ShieldCheck, Building2, Trash2, Pencil } from 'lucide-react';
import axios from 'axios';
import UserAvatar from '../components/UserAvatar';

interface Department { id: string; name: string; }
interface Organization { id: string; name: string; departments: Department[]; }
interface PositionSlot {
    id: string;
    title: string;
    organizationId: string;
    department: Department | null;
    positions: { 
        id: string;
        user: { id: string; nim: string; foto?: string | null; profile: { nama: string } | null } 
    }[];
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

    // Slot yang sedang diubah; null berarti modal dipakai untuk membuat baru.
    const [slotDiedit, setSlotDiedit] = useState<PositionSlot | null>(null);
    const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);
    const [notice, setNotice] = useState('');

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

    const bukaSlotBaru = () => {
        setSlotDiedit(null);
        setNotice('');
        setNewSlot({ organizationId: organizations[0]?.id ?? '', departmentId: '', title: '' });
        setIsSlotModalOpen(true);
    };

    const bukaEditSlot = (slot: PositionSlot) => {
        setSlotDiedit(slot);
        setNotice('');
        setNewSlot({
            organizationId: slot.organizationId,
            departmentId: slot.department?.id ?? '',
            title: slot.title,
        });
        setIsSlotModalOpen(true);
    };

    const tutupSlotModal = () => {
        setIsSlotModalOpen(false);
        setSlotDiedit(null);
    };

    // Satu form dipakai untuk membuat slot baru maupun mengubah slot yang ada.
    const handleSaveSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setNotice('');
        try {
            const res = slotDiedit
                ? await api.patch(`/positions/slots/${slotDiedit.id}`, newSlot)
                : await api.post('/positions/slots', newSlot);
            setNotice(res.data.message || (slotDiedit ? 'Jabatan berhasil diperbarui.' : 'Jabatan berhasil dibuat.'));
            tutupSlotModal();
            setNewSlot({ ...newSlot, title: '', departmentId: '' });
            fetchData();
        } catch (err) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal menyimpan jabatan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSlot = async (slot: PositionSlot) => {
        if (!window.confirm(`Hapus jabatan "${slot.title}"? Jabatan akan hilang dari daftar kepengurusan; riwayat pemegangnya tetap tersimpan.`)) return;

        setDeletingSlotId(slot.id);
        setNotice('');
        try {
            const res = await api.delete(`/positions/slots/${slot.id}`);
            setNotice(res.data.message || 'Jabatan berhasil dihapus.');
            fetchData();
        } catch (err) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal menghapus jabatan');
            else alert('Terjadi kesalahan.');
        } finally {
            setDeletingSlotId(null);
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
            <div className="flex flex-col justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                        <UserPlus className="w-6 h-6 text-amber-400" />
                        Manajemen Kepengurusan
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Buat slot jabatan dan angkat mahasiswa menjadi pengurus BEM.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={bukaSlotBaru} className="flex items-center gap-2 px-4 py-2 font-medium text-gray-700 dark:text-gray-300 transition bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                        <Building2 className="w-4 h-4" /> Buat Jabatan Baru
                    </button>
                    <button onClick={() => setIsAssignModalOpen(true)} className="flex items-center gap-2 px-4 py-2 font-medium text-white transition rounded-lg bg-amber-400 hover:bg-amber-500">
                        <ShieldCheck className="w-4 h-4" /> Angkat Pengurus
                    </button>
                </div>
            </div>

            {error && <div className="p-4 text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60">{error}</div>}
            {notice && <div role="status" className="p-4 text-sm font-bold text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950/60">{notice}</div>}

            {/* Grid Jabatan */}
            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
            ) : slots.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Belum ada jabatan</p>
                    <p>Klik tombol 'Buat Jabatan Baru' untuk memulai.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {slots.map(slot => {
                        const activeUser = slot.positions[0]?.user;
                        return (
                            <div key={slot.id} className="flex flex-col h-full p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
                                <div className="flex-1 mb-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100 line-clamp-2">{slot.title}</h3>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wide ${activeUser ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'}`}>
                                                {activeUser ? 'Terisi' : 'Kosong'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => bukaEditSlot(slot)}
                                                title={`Ubah jabatan ${slot.title}`}
                                                aria-label={`Ubah jabatan ${slot.title}`}
                                                className="p-1.5 text-amber-600 dark:text-amber-400 transition rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSlot(slot)}
                                                disabled={Boolean(activeUser) || deletingSlotId === slot.id}
                                                title={activeUser ? 'Turunkan pengurusnya terlebih dahulu sebelum menghapus jabatan' : `Hapus jabatan ${slot.title}`}
                                                aria-label={`Hapus jabatan ${slot.title}`}
                                                className="p-1.5 text-red-600 dark:text-red-400 transition rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {deletingSlotId === slot.id
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Trash2 className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{getOrgName(slot.organizationId)}</p>
                                    {slot.department && <p className="mt-1 text-xs font-medium text-amber-400">{slot.department.name}</p>}
                                </div>
                                
                                {/* [PERBAIKAN]: Penambahan min-w-0, flex-1, dan shrink-0 agar tidak tumpang tindih */}
                                <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                    {activeUser ? (
                                        <div className="flex items-center flex-1 min-w-0 gap-3">
                                            <UserAvatar
                                                userId={activeUser.id}
                                                nama={activeUser.profile?.nama || activeUser.nim}
                                                foto={activeUser.foto ?? null}
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate" title={activeUser.profile?.nama}>{activeUser.profile?.nama || 'Tanpa Nama'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activeUser.nim}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm italic text-gray-400 dark:text-gray-500">Belum ada pejabat</p>
                                    )}
                                    
                                    {activeUser && (
                                        <button
                                            onClick={() => { setRemovePositionId(slot.positions[0].id); setIsRemoveModalOpen(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 transition rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/40 shrink-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 shrink-0" /> Turunkan
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
                <div role="dialog" aria-modal="true" aria-label="Buat jabatan baru" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                {slotDiedit ? 'Ubah Jabatan' : 'Buat Jabatan Baru'}
                            </h2>
                            <button onClick={tutupSlotModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSaveSlot} className="p-6 space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Organisasi Induk</label>
                                <select required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700" value={newSlot.organizationId} onChange={(e) => setNewSlot({ ...newSlot, organizationId: e.target.value, departmentId: '' })}>
                                    <option value="" disabled>Pilih Organisasi...</option>
                                    {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Departemen <span className="font-normal text-gray-400 dark:text-gray-500">(Opsional)</span></label>
                                <select className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700" value={newSlot.departmentId} onChange={(e) => setNewSlot({ ...newSlot, departmentId: e.target.value })}>
                                    <option value="">-- Tidak Terikat Departemen --</option>
                                    {selectedOrgDepartments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nama Jabatan</label>
                                <input type="text" required placeholder="Contoh: Ketua BEM / Menteri Kominfo" className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700" value={newSlot.title} onChange={(e) => setNewSlot({ ...newSlot, title: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={tutupSlotModal} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : slotDiedit ? 'Simpan Perubahan' : 'Simpan Jabatan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Turunkan Pengurus */}
            {isRemoveModalOpen && (
                <div role="dialog" aria-modal="true" aria-label="Konfirmasi turunkan jabatan" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-sm overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Konfirmasi Turunkan</h2>
                            <button onClick={() => setIsRemoveModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/60">
                                <div className="flex items-center justify-center w-10 h-10 text-lg font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-full shrink-0">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Yakin ingin menurunkan?</p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Pengurus akan dikembalikan ke status mahasiswa biasa.</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRemoveModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleRemovePosition}
                                    disabled={isRemoving}
                                    className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4 shrink-0" /> Ya, Turunkan</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Angkat Pengurus */}
            {isAssignModalOpen && (
                <div role="dialog" aria-modal="true" aria-label="Angkat pengurus" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Angkat Pengurus</h2>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleAssign} className="p-6 space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Jabatan</label>
                                <select required className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700" value={assignData.positionSlotId} onChange={(e) => setAssignData({ ...assignData, positionSlotId: e.target.value })}>
                                    <option value="" disabled>Pilih slot jabatan...</option>
                                    {slots.map(slot => (
                                        <option key={slot.id} value={slot.id}>{slot.title} ({getOrgName(slot.organizationId)})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">NIM Mahasiswa</label>
                                <input type="text" required placeholder="Masukkan NIM mahasiswa..." className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700 uppercase" value={assignData.nim} onChange={(e) => setAssignData({ ...assignData, nim: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">Batal</button>
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