import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { Building2, Users, Plus, Loader2, XCircle } from 'lucide-react';
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

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Building2 className="w-6 h-6 text-amber-400" />
            Master Organisasi
          </h1>
          <p className="mt-1 text-sm text-gray-500">Kelola struktur BEM, DPM, dan departemen di dalamnya.</p>
        </div>
        
        <button 
          onClick={() => setIsOrgModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 font-medium text-white transition rounded-lg bg-amber-400 hover:bg-amber-500"
        >
          <Plus className="w-4 h-4" /> Tambah Organisasi
        </button>
      </div>

      {error && <div className="p-4 text-red-600 rounded-lg bg-red-50">{error}</div>}

      {/* Grid Organisasi */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
      ) : organizations.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-900">Belum ada organisasi</p>
          <p>Klik tombol tambah di atas untuk membuat struktur pertama Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {organizations.map((org) => (
            <div key={org.id} className="flex flex-col overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-bold text-gray-800">{org.name}</h2>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${org.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {org.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold tracking-wider text-gray-500 uppercase">
                    <Users className="w-4 h-4" /> Departemen
                  </h3>
                </div>
                
                {org.departments.length === 0 ? (
                  <p className="mb-4 text-sm italic text-gray-400">Belum ada departemen.</p>
                ) : (
                  <ul className="mb-4 space-y-2">
                    {org.departments.map(dept => (
                      <li key={dept.id} className="flex items-center justify-between p-2 text-sm text-gray-700 border border-gray-100 rounded-lg bg-gray-50">
                        {dept.name}
                      </li>
                    ))}
                  </ul>
                )}

                <button 
                  onClick={() => { setSelectedOrgId(org.id); setIsDeptModalOpen(true); }}
                  className="flex items-center justify-center w-full gap-2 py-2 text-sm font-medium text-gray-500 transition border-2 border-gray-300 border-dashed rounded-lg hover:text-amber-400 hover:border-amber-100"
                >
                  <Plus className="w-4 h-4" /> Tambah Departemen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Organisasi Baru */}
      {isOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Tambah Organisasi</h2>
              <button onClick={() => setIsOrgModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Nama Organisasi</label>
                <input type="text" required placeholder="Contoh: BEM Fakultas Teknik" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsOrgModalOpen(false)} className="px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Tambah Departemen</h2>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreateDept} className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Nama Departemen</label>
                <input type="text" required placeholder="Contoh: Departemen Kominfo" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-amber-300 focus:border-amber-300" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
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