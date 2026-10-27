import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { assetUrl } from '../lib/axios';

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  /** Kelas pembungkus pengganti saat gambar gagal dimuat. */
  fallbackClassName?: string;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
}

/**
 * Gambar dengan pengganti bila berkasnya tidak ditemukan.
 *
 * Sebagian foto galeri lama tersimpan sebagai `/uploads/...` di filesystem
 * sementara Vercel, sehingga berkasnya sudah hilang walaupun URL-nya masih ada
 * di database. Tanpa penanganan, browser menampilkan ikon gambar rusak. Di sini
 * kegagalan itu diganti kotak netral bertuliskan "Foto tidak tersedia" sehingga
 * tampilan tetap rapi dan penyebabnya jelas bagi pengelola.
 */
export default function MediaImage({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  loading = 'lazy',
  draggable = true,
}: Props) {
  const [gagal, setGagal] = useState(false);

  if (!src || gagal) {
    return (
      <div
        role="img"
        aria-label={`${alt} — foto tidak tersedia`}
        className={`flex flex-col items-center justify-center gap-1 text-center bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ${fallbackClassName || className}`}
      >
        <ImageOff className="w-5 h-5" aria-hidden="true" />
        <span className="px-2 text-[10px] font-bold uppercase tracking-wide">Foto tidak tersedia</span>
      </div>
    );
  }

  return (
    <img
      src={assetUrl(src)}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={draggable}
      onError={() => setGagal(true)}
      className={className}
    />
  );
}
