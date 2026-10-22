import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { Building2, Users, Plus, Loader2, XCircle, Trash2, Pencil } from 'lucide-react';
import axios from 'axios';

interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

interface Organization {
  id: string;
  name: string;
  isActive: boolean;
  departments: Department[];
}

export default function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State Modals
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  
  // State Form
  const [orgName, setOrgName] = useState('');
  const [deptName, setDeptName] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  // Ganti nama organisasi / divisi (satu modal untuk keduanya).
  const [editTarget, setEditTarget] = useState<{ tipe: 'org' | 'dept'; id: string; nama: string } | null>(null);
  const [editNama, setEditNama] = useState('');
  const [menyimpanEdit, setMenyimpanEdit] = useState(false);

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/organizations');
      setOrganizations(response.data.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal memuat data organisasi');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrganizations();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/organizations', { name: orgName });
      setOrgName('');
      setIsOrgModalOpen(false);
      fetchOrganizations();
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal membuat organisasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/organizations/departments', { organizationId: selectedOrgId, name: deptName });
      setDeptName('');
      setSelectedOrgId('');
      setIsDeptModalOpen(false);
      fetchOrganizations();
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal membuat departemen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bukaEdit = (tipe: 'org' | 'dept', id: string, nama: string) => {
    setEditTarget({ tipe, id, nama });
    setEditNama(nama);
    setNotice('');
  };

  const simpanEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setMenyimpanEdit(true);
    try {
      const jalur = editTarget.tipe === 'org'
        ? `/organizations/${editTarget.id}`
        : `/organizations/departments/${editTarget.id}`;
      const res = await api.patch(jalur, { name: editNama.trim() });
      setNotice(res.data.message || 'Nama berhasil diubah.');
      setEditTarget(null);
      fetchOrganizations();
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal mengganti nama');
      else alert('Terjadi kesalahan.');
    } finally {
      setMenyimpanEdit(false);
    }
  };

  // Menghapus divisi beserta slot jabatannya.
  // Server menolak jika masih ada pengurus aktif di divisi tersebut.
  const handleDeleteDept = async (dept: Department) => {
    if (!window.confirm(`Hapus divisi "${dept.name}"? Slot jabatan di dalamnya ikut terhapus.`)) return;
    setDeletingId(dept.id);
    try {
      const res = await api.delete(`/organizations/departments/${dept.id}`);
      setNotice(res.data.message);
      fetchOrganizations();
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal menghapus divisi');
      else alert('Terjadi kesalahan.');
    } finally {
      setDeletingId(null);
    }
  };

  // Menghapus organisasi beserta seluruh divisi dan slot jabatannya.
  // Server menolak bila masih ada pengurus aktif; bila yang tersisa hanya riwayat
  // jabatan lama, server meminta konfirmasi tegas dulu (butuhKonfirmasi) karena
  // riwayat itu akan ikut terhapus.
  const handleDeleteOrg = async (org: Organization) => {
    if (!window.confirm(`Hapus organisasi "${org.name}" beserta ${org.departments.length} divisi dan seluruh slot jabatannya?`)) return;
    setDeletingOrgId(org.id);
    setNotice('');

    try {
      const res = await api.delete(`/organizations/${org.id}`);
      setNotice(res.data.message);
      fetchOrganizations();
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        alert('Terjadi kesalahan.');
        return;
      }

      const pesan = err.response?.data?.message || 'Gagal menghapus organisasi';

      if (err.response?.data?.butuhKonfirmasi && window.confirm(`${pesan}\n\nTetap hapus organisasi ini?`)) {
        try {
          const paksa = await api.delete(`/organizations/${org.id}`, { params: { force: true } });
          setNotice(paksa.data.message);
          fetchOrganizations();
        } catch (errPaksa) {
          if (axios.isAxiosError(errPaksa)) alert(errPaksa.response?.data?.message || 'Gagal menghapus organisasi');
          else alert('Terjadi kesalahan.');
        }
      } else if (!err.response?.data?.butuhKonfirmasi) {
        alert(pesan);
      }
    } finally {
      setDeletingOrgId(null);
    }
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Building2 className="w-6 h-6 text-amber-400" />
            Master Organisasi
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola struktur BEM, DPM, dan departemen di dalamnya.</p>
        </div>
        
        <button 
          onClick={() => setIsOrgModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 font-medium text-white transition rounded-lg bg-amber-400 hover:bg-amber-500"
        >
          <Plus className="w-4 h-4" /> Tambah Organisasi
        </button>
      </div>

      {error && <div className="p-4 text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60">{error}</div>}
      {notice && <div className="p-4 text-sm font-bold text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950/60">{notice}</div>}

      {/* Grid Organisasi */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
      ) : organizations.length === 0 ? (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Belum ada organisasi</p>
          <p>Klik tombol tambah di atas untuk membuat struktur pertama Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {organizations.map((org) => (
            <div key={org.id} className="flex flex-col overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{org.name}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${org.isActive ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'}`}>
                    {org.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <button
                    type="button"
                    onClick={() => bukaEdit('org', org.id, org.name)}
                    title={`Ganti nama organisasi ${org.name}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 transition rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOrg(org)}
                    disabled={deletingOrgId === org.id}
                    title={`Hapus organisasi ${org.name}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 transition rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                  >
                    {deletingOrgId === org.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <><Trash2 className="w-3.5 h-3.5" /> Hapus</>}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase">
                    <Users className="w-4 h-4" /> Departemen
                  </h3>
                </div>
                
                {org.departments.length === 0 ? (
                  <p className="mb-4 text-sm italic text-gray-400 dark:text-gray-500">Belum ada departemen.</p>
                ) : (
                  <ul className="mb-4 space-y-2">
                    {org.departments.map(dept => (
                      <li key={dept.id} className="flex items-center justify-between gap-2 p-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <span className="truncate">{dept.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => bukaEdit('dept', dept.id, dept.name)}
                          title={`Ganti nama divisi ${dept.name}`}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 transition rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDept(dept)}
                          disabled={deletingId === dept.id}
                          title={`Hapus divisi ${dept.name}`}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-red-600 dark:text-red-400 transition rounded-md shrink-0 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                        >
                          {deletingId === dept.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><Trash2 className="w-3.5 h-3.5" /> Hapus</>}
                        </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <button 
                  onClick={() => { setSelectedOrgId(org.id); setIsDeptModalOpen(true); }}
                  className="flex items-center justify-center w-full gap-2 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 transition border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg hover:text-amber-400 hover:border-amber-100 dark:hover:border-amber-900/60"
                >
                  <Plus className="w-4 h-4" /> Tambah Departemen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ganti Nama Organisasi / Divisi */}
      {editTarget && (
        <div role="dialog" aria-modal="true" aria-label="Ganti nama" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Ganti Nama {editTarget.tipe === 'org' ? 'Organisasi' : 'Divisi'}
              </h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={simpanEdit} className="p-6 space-y-4">
              <div>
                <label htmlFor="edit-nama" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nama {editTarget.tipe === 'org' ? 'Organisasi' : 'Divisi'}
                </label>
                <input
                  id="edit-nama"
                  type="text"
                  required
                  autoFocus
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Sebelumnya: {editTarget.nama}
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">Batal</button>
                <button type="submit" disabled={menyimpanEdit || !editNama.trim()} className="flex items-center gap-2 px-4 py-2 font-medium text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50">
                  {menyimpanEdit ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Organisasi Baru */}
      {isOrgModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Tambah organisasi" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tambah Organisasi</h2>
              <button onClick={() => setIsOrgModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nama Organisasi</label>
                <input type="text" required placeholder="Contoh: BEM Fakultas Teknik" className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsOrgModalOpen(false)} className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 font-medium text-white rounded-lg bg-amber-400 hover:bg-amber-500">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Departemen Baru */}
      {isDeptModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Tambah departemen" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tambah Departemen</h2>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreateDept} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nama Departemen</label>
                <input type="text" required placeholder="Contoh: Departemen Kominfo" className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-300 focus:border-amber-300 dark:focus:border-amber-700" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 font-medium text-white rounded-lg bg-amber-400 hover:bg-amber-500">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}