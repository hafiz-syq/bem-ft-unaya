import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck, User } from 'lucide-react';
import axios from 'axios';
import { api } from '../lib/axios';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Halaman lupa password.
 *
 * Langkah 1: pengguna mengisi nama, NIM, dan email. Server mencocokkannya
 * dengan data akun, lalu mengirim kode OTP + tautan reset ke email terdaftar.
 * Langkah 2: pengguna memasukkan kode OTP di sini, lalu diarahkan ke form
 * password baru. Tautan di email menuju form yang sama secara langsung.
 */
export default function LupaPassword() {
  const navigate = useNavigate();

  const [langkah, setLangkah] = useState<'form' | 'otp'>('form');
  const [nama, setNama] = useState('');
  const [nim, setNim] = useState('');
  const [email, setEmail] = useState('');
  const [kode, setKode] = useState('');

  const [pesan, setPesan] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [kirimUlang, setKirimUlang] = useState(false);

  const ambilPesanError = (err: unknown, bawaan: string) =>
    axios.isAxiosError(err) ? err.response?.data?.message || bawaan : bawaan;

  const mintaKode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPesan('');
    setLoading(true);

    try {
      const res = await api.post('/auth/lupa-password', { nama, nim, email });
      setPesan(
        res.data?.message ||
          'Kode OTP dan tautan reset sudah dikirim ke email terdaftar.'
      );
      setLangkah('otp');
    } catch (err) {
      setError(ambilPesanError(err, 'Gagal meminta kode reset password.'));
    } finally {
      setLoading(false);
    }
  };

  const verifikasiKode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/lupa-password/verifikasi', { nim, kode });
      navigate(`/reset-password?token=${encodeURIComponent(res.data.token)}`);
    } catch (err) {
      setError(ambilPesanError(err, 'Kode OTP tidak valid.'));
    } finally {
      setLoading(false);
    }
  };

  const kirimUlangKode = async () => {
    setError('');
    setPesan('');
    setKirimUlang(true);
    try {
      const res = await api.post('/auth/lupa-password', { nama, nim, email });
      setPesan(res.data?.message || 'Kode baru sudah dikirim.');
    } catch (err) {
      setError(ambilPesanError(err, 'Gagal mengirim ulang kode.'));
    } finally {
      setKirimUlang(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-950">
      <div className="relative w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
        <ThemeToggle className="absolute top-4 right-4" />

        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-100 dark:bg-amber-900/40">
            {langkah === 'form' ? (
              <KeyRound className="w-6 h-6 text-amber-600 dark:text-amber-300" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-300" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {langkah === 'form' ? 'Lupa Password' : 'Masukkan Kode OTP'}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {langkah === 'form'
              ? 'Isi data akun Anda. Kode OTP dan tautan reset akan dikirim ke email terdaftar.'
              : `Kode 6 digit sudah dikirim ke email terdaftar. Cek juga folder spam bila belum terlihat.`}
          </p>
        </div>

        {pesan && (
          <div role="status" className="p-3 text-sm text-center text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">
            {pesan}
          </div>
        )}
        {error && (
          <div role="alert" className="p-3 text-sm text-center text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        {langkah === 'form' ? (
          <form onSubmit={mintaKode} className="space-y-4">
            <div>
              <label htmlFor="lupa-nama" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute w-5 h-5 text-gray-400 left-3 top-2.5 dark:text-gray-500" />
                <input
                  id="lupa-nama"
                  name="nama"
                  type="text"
                  required
                  autoComplete="name"
                  spellCheck={false}
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Sesuai data mahasiswa"
                  className="block w-full py-2 pl-10 pr-3 text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="lupa-nim" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">NIM</label>
              <div className="relative">
                <KeyRound className="absolute w-5 h-5 text-gray-400 left-3 top-2.5 dark:text-gray-500" />
                <input
                  id="lupa-nim"
                  name="nim"
                  type="text"
                  required
                  spellCheck={false}
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  placeholder="Contoh: 22140001"
                  className="block w-full py-2 pl-10 pr-3 text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="lupa-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email Terdaftar</label>
              <div className="relative">
                <Mail className="absolute w-5 h-5 text-gray-400 left-3 top-2.5 dark:text-gray-500" />
                <input
                  id="lupa-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@contoh.com"
                  className="block w-full py-2 pl-10 pr-3 text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-bold text-white bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Kirim Kode OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifikasiKode} className="space-y-4">
            <div>
              <label htmlFor="lupa-otp" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Kode OTP (6 digit)</label>
              <input
                id="lupa-otp"
                name="otp"
                type="text"
                inputMode="numeric"
                required
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={6}
                value={kode}
                onChange={(e) => setKode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="block w-full px-3 py-2 font-mono text-2xl tracking-[0.4em] text-center text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-400 focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || kode.length !== 6}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-bold text-white bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verifikasi & Buat Password Baru'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setLangkah('form'); setError(''); setPesan(''); }}
                className="font-medium text-gray-500 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-300"
              >
                Ubah data
              </button>
              <button
                type="button"
                onClick={kirimUlangKode}
                disabled={kirimUlang}
                className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-300 disabled:opacity-50"
              >
                {kirimUlang ? 'Mengirim\u2026' : 'Kirim ulang kode'}
              </button>
            </div>
          </form>
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
