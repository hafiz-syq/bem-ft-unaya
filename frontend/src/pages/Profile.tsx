import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { UserCircle, ShieldCheck, BookOpen, Loader2, Mail, Pencil, Save, X, Check } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface ProfileData {
  nim: string;
  role: string;
  isActive: boolean;
  angkatan: string;
  profile: {
    nama: string;
    program_studi: string;
    email: string | null;
    email_verified?: boolean;
  } | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State untuk pengubahan email pribadi
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailErr, setEmailErr] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/profile/me');
        setData(response.data);
        setEmailInput(response.data.profile?.email || '');
      } catch {
        setError('Gagal memuat data profil.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg('');
    setEmailErr('');
    setSavingEmail(true);
    try {
      const res = await api.put('/profile/me', { email: emailInput });
      setEmailMsg(res.data.message || 'Email berhasil diperbarui.');
      setIsEditingEmail(false);
      if (data) {
        setData({
          ...data,
          profile: data.profile
            ? { ...data.profile, email: res.data.profile.email, email_verified: res.data.profile.email_verified }
            : data.profile,
        });
      }

      if (res.data.emailBerubah) {
        // Server sudah membatalkan status verifikasi email lama.
        // Segarkan status global supaya penjaga rute ikut tahu, lalu minta verifikasi ulang.
        const me = await api.get('/auth/me');
        login(me.data.user);
        navigate('/verify-email');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) setEmailErr(err.response?.data?.message || 'Gagal menyimpan email.');
      else setEmailErr('Terjadi kesalahan yang tidak terduga.');
    } finally {
      setSavingEmail(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>;
  }

  if (error || !data) {
    return <div className="p-4 m-6 text-red-600 rounded-lg bg-red-50">{error}</div>;
  }

  return (
    <div className="max-w-4xl p-6 mx-auto space-y-6 md:p-8">
      <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-xl">
        {/* Header Profil */}
        <div className="flex items-center gap-6 px-8 py-12 text-white bg-gradient-to-r from-amber-400 to-orange-400">
          <div className="flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm">
            <UserCircle className="w-16 h-16 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              {data.profile ? data.profile.nama : 'Administrator Sistem'}
            </h1>
            <p className="flex items-center gap-2 mt-1 text-amber-100">
              <ShieldCheck className="w-4 h-4" /> 
              Hak Akses: {data.role}
            </p>
          </div>
        </div>

        {/* Informasi Detail */}
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-800">Detail Informasi</h2>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Nomor Induk Mahasiswa (NIM)</p>
              <p className="text-lg font-semibold text-gray-900">{data.nim}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Tahun Angkatan</p>
              <p className="text-lg font-semibold text-gray-900">{data.angkatan}</p>
            </div>

            {data.profile && (
              <div className="space-y-1 md:col-span-2">
                <p className="text-sm font-medium text-gray-500">Program Studi</p>
                <div className="flex items-center gap-2 mt-1">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                  <p className="text-lg font-semibold text-gray-900">{data.profile.program_studi}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Status Akun</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                data.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {data.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KARTU EMAIL PRIBADI */}
      <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-xl">
        <div className="flex items-center gap-3 px-8 py-5 border-b border-gray-100">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50">
            <Mail className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Email Pribadi</h2>
            <p className="text-xs text-gray-500">
              Dipakai untuk menerima notifikasi resmi. Harus diverifikasi agar notifikasi benar-benar sampai.
            </p>
          </div>
        </div>

        <div className="p-8 space-y-4">
          {emailMsg && (
            <div className="flex items-center gap-2 p-3 text-sm font-bold text-green-800 bg-green-100 border border-green-200 rounded-lg">
              <Check className="w-4 h-4" /> {emailMsg}
            </div>
          )}
          {emailErr && (
            <div className="p-3 text-sm font-bold text-red-800 bg-red-100 border border-red-200 rounded-lg">
              {emailErr}
            </div>
          )}

          {!isEditingEmail ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Email Terdaftar</p>
                <p className="text-lg font-semibold text-gray-900 break-all">
                  {data.profile?.email || <span className="italic font-normal text-gray-400">Belum ada email</span>}
                </p>
                {data.profile?.email ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 mt-1 text-xs font-bold rounded-full ${
                    data.profile.email_verified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {data.profile.email_verified ? 'Terverifikasi' : 'Belum diverifikasi'}
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => { setEmailMsg(''); setEmailErr(''); setEmailInput(data.profile?.email || ''); setIsEditingEmail(true); }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 font-bold text-white transition rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95"
              >
                <Pencil className="w-4 h-4" /> Ubah Email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Email Baru</label>
                <input
                  type="email"
                  required
                  placeholder="nama@contoh.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsEditingEmail(false); setEmailErr(''); }}
                  className="inline-flex items-center gap-2 px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <X className="w-4 h-4" /> Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="inline-flex items-center gap-2 px-4 py-2 font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
                >
                  {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Simpan</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}