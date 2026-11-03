import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { avatarUrl } from '../lib/gambar';

interface Props {
  /** Path/URL foto asli; diperbesar lewat transformasi Cloudinary, bukan berkas mentah. */
  foto: string;
  nama?: string | null;
  onClose: () => void;
}

/**
 * Foto profil dalam ukuran besar.
 *
 * Gambar dikunci supaya tidak bisa ditarik, disalin, atau disimpan lewat klik
 * kanan/tekan lama, dan yang ditampilkan adalah versi 512 px dari Cloudinary —
 * bukan foto asli hasil unggah.
 *
 * shortcut: penahan sebatas niat menyimpan langsung; screenshot & devtools
 * tetap bisa mengambil gambar. Kalau nanti foto harus benar-benar terlindungi,
 * tambahkan watermark di transformasi Cloudinary.
 */
export default function FotoProfilModal({ foto, nama, onClose }: Props) {
  const tutupRef = useRef<HTMLButtonElement>(null);

  // Kunci gulir halaman di belakangnya dan tangkap Escape, sama seperti dialog profil.
  useEffect(() => {
    const gulirLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    tutupRef.current?.focus();

    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', padaTombol);

    return () => {
      document.body.style.overflow = gulirLama;
      document.removeEventListener('keydown', padaTombol);
    };
  }, [onClose]);

  // Dipasang di <body>: dialog induk punya transform & overflow-hidden yang bisa
  // memotong atau memindahkan posisi lapisan fixed.
  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm"
      onClick={(e) => {
        // Event tetap merambat lewat pohon React, jadi induknya tidak ikut tutup.
        e.stopPropagation();
        onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={nama ? `Foto profil ${nama}` : 'Foto profil'}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm p-5 text-center bg-white rounded-2xl shadow-2xl dark:bg-gray-900"
      >
        <button
          ref={tutupRef}
          type="button"
          onClick={onClose}
          aria-label="Tutup foto"
          className="absolute p-1.5 text-gray-900 transition rounded-full top-3 right-3 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-4 h-4" />
        </button>

        <img
          src={avatarUrl(foto, 512)}
          alt={nama || 'Foto profil'}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none' }}
          className="w-full max-h-[70vh] mx-auto rounded-2xl select-none object-contain"
        />

        {nama && (
          <p className="mt-4 text-sm font-bold break-words text-gray-800 dark:text-gray-200">{nama}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
