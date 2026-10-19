import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, Loader2 } from 'lucide-react';
import axios from 'axios';
import { api } from '../lib/axios';
import ThemeToggle from '../components/ThemeToggle';
import PasswordInput from '../components/PasswordInput';

/**
 * Halaman pembuatan password baru setelah pengguna meminta reset.
 * Token diambil dari tautan email (/?token=...) atau dari hasil verifikasi OTP
 * di halaman lupa password.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passwordBaru.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (passwordBaru !== konfirmasi) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password_baru: passwordBaru,
        konfirmasi_password: konfirmasi,
      });
      setBerhasil(true);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Gagal mengatur ulang password.'
          : 'Terjadi kesalahan yang tidak terduga.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-950">
      <div className="relative w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
        <ThemeToggle className="absolute top-4 right-4" />

        {!token ? (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tautan Tidak Valid</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Tautan reset tidak membawa token. Silakan minta tautan baru dari halaman lupa password.
              </p>
            </div>
            <Link
              to="/lupa-password"
              className="block w-full py-2.5 text-sm font-bold text-center text-white rounded-lg bg-amber-400 hover:bg-amber-500"
            >
              Minta Tautan Baru
            </Link>
          </>
        ) : berhasil ? (
          <>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Password Berhasil Diubah</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Silakan masuk kembali menggunakan password baru Anda.
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500"
            >
              Ke Halaman Login
            </button>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <Lock className="w-6 h-6 text-amber-600 dark:text-amber-300" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Buat Password Baru</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Minimal 8 karakter dan berbeda dari password sebelumnya.
              </p>
            </div>

            {error && (
              <div role="alert" className="p-3 text-sm text-center text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={simpan} className="space-y-4">
              <div>
                <label htmlFor="rp-password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Password Baru</label>
                <PasswordInput
                  id="rp-password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>

              <div>
                <label htmlFor="rp-konfirmasi" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Ulangi Password Baru</label>
                <PasswordInput
                  id="rp-konfirmasi"
                  name="konfirmasi"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={konfirmasi}
                  onChange={(e) => setKonfirmasi(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : 'Simpan Password Baru'}
              </button>
            </form>
          </>
        )}

        <div className="pt-2 text-center">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Halaman Login
          </Link>
        </div>
      </div>
    </div>
  );
}
