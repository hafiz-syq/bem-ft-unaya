import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ShieldAlert, Loader2, CheckCircle, Clock, Pencil, Check, X, LogOut } from 'lucide-react';
import axios from 'axios';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

const DETIK_TUNGGU = 60;

export default function VerifyEmail() {
  const [kode, setKode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sisaDetik, setSisaDetik] = useState(0);

  // Form untuk memperbaiki email yang salah ketik
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  // Hitung mundur tombol kirim ulang
  useEffect(() => {
    if (sisaDetik <= 0) return;
    const timer = setInterval(() => {
      setSisaDetik((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [sisaDetik]);

  // Sudah terverifikasi (misal halaman di-refresh setelah berhasil): langsung lanjut
  useEffect(() => {
    if (user?.email && user.email_verified) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!/^\d{6}$/.test(kode.trim())) {
      setError('Kode verifikasi terdiri dari 6 digit angka.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/verify-email', { kode: kode.trim() });
      if (res.data.user) login(res.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Kode verifikasi gagal diproses.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Kirim ulang kode; kalau email diisi dan berbeda, sekaligus pindah alamat kirim
  const handleResend = async (emailBaru?: string) => {
    setError('');
    setInfo('');
    setSendingEmail(true);

    try {
      const res = await api.post('/auth/resend-verification', emailBaru ? { email: emailBaru } : {});
      setInfo(res.data.message || 'Kode verifikasi baru telah dikirim.');
      if (res.data.user) login(res.data.user);
      setSisaDetik(DETIK_TUNGGU);
      setShowEmailForm(false);
      setKode('');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const pesan = err.response?.data?.message || 'Gagal mengirim kode verifikasi.';
        setError(pesan);
        // Sinkronkan hitung mundur dengan batas waktu dari server
        const cocok = /tunggu (\d+) detik/i.exec(pesan);
        if (cocok) setSisaDetik(parseInt(cocok[1], 10));
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSimpanEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const alamat = emailInput.trim();
    if (!alamat) {
      setError('Alamat email baru wajib diisi.');
      return;
    }
    await handleResend(alamat);
  };

  const handleKeluar = async () => {
    await logout();
    navigate('/login');
  };

  const emailTujuan = user?.email || '';

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-2xl border-t-4 border-yellow-500">
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full">
            <ShieldAlert className="w-6 h-6 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verifikasi Email Anda</h1>
          <p className="mt-2 text-sm text-gray-500">
            Satu langkah lagi. Kami sudah mengirim <b>kode 6 digit</b> ke alamat email Anda.
            Masukkan kode itu untuk mengaktifkan akun.
          </p>
        </div>

        {/* Alamat tujuan kode */}
        <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <Mail className="w-5 h-5 text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">Kode dikirim ke</p>
            <p className="text-sm font-bold text-gray-900 break-all">
              {emailTujuan || <span className="font-normal italic text-gray-400">Belum ada email</span>}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 text-sm text-center text-red-600 rounded-lg bg-red-50">{error}</div>
        )}
        {info && (
          <div className="flex items-start gap-2 p-3 text-sm text-green-700 rounded-lg bg-green-50">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{info}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Kode Verifikasi</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="000000"
              value={kode}
              onChange={(e) => setKode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="block w-full px-3 py-3 font-mono text-2xl text-center border border-gray-300 rounded-lg bg-gray-50 text-gray-900 tracking-[0.5em] focus:ring-amber-500 focus:border-amber-500"
            />
            <p className="mt-1 text-xs text-gray-400">Kode berlaku 15 menit sejak dikirim.</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center w-full py-2.5 px-4 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verifikasi Email'}
          </button>
        </form>

        {/* Kirim ulang & perbaiki email */}
        <div className="pt-4 space-y-3 text-center border-t border-gray-100">
          <p className="text-sm text-gray-500">Tidak menerima kode?</p>

          <button
            type="button"
            onClick={() => handleResend()}
            disabled={sisaDetik > 0 || sendingEmail}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sisaDetik > 0 ? (
              <>
                <Clock className="w-4 h-4" /> Kirim ulang dalam {sisaDetik}s
              </>
            ) : sendingEmail ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Mengirim...
              </>
            ) : (
              'Kirim ulang kode'
            )}
          </button>

          {!showEmailForm ? (
            <div>
              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setEmailInput(emailTujuan);
                  setError('');
                  setInfo('');
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <Pencil className="w-3.5 h-3.5" /> Salah ketik alamat email?
              </button>
            </div>
          ) : (
            <form onSubmit={handleSimpanEmail} className="p-3 space-y-3 text-left border border-gray-200 rounded-lg bg-gray-50">
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-600">
                  Alamat email yang benar
                </label>
                <input
                  type="email"
                  required
                  placeholder="nama@contoh.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-amber-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Kode baru akan dikirim ke alamat ini.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowEmailForm(false); setError(''); }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  <X className="w-3.5 h-3.5" /> Batal
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
                >
                  {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Simpan & kirim kode</>}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Jalan keluar kalau memang tidak bisa diverifikasi */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleKeluar}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar dari akun
          </button>
        </div>
      </div>
    </div>
  );
}
