import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Kolom password dengan tombol mata di kanan: klik untuk menampilkan /
 * menyembunyikan isi password. Menerima seluruh props <input> biasa;
 * `pr-10` otomatis ditambahkan agar teks tidak menabrak ikon.
 */
export default function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [tampil, setTampil] = useState(false);
  const label = tampil ? 'Sembunyikan password' : 'Tampilkan password';

  return (
    <div className="relative">
      <input
        {...props}
        type={tampil ? 'text' : 'password'}
        className={`${className} pr-10`}
      />
      {/* Tombol mata: tampilkan/sembunyikan password */}
      <button
        type="button"
        onClick={() => setTampil((v) => !v)}
        aria-label={label}
        title={label}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        {tampil ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
