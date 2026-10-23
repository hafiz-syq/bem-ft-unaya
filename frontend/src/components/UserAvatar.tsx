import { assetUrl } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { useProfileDialog } from '../contexts/ProfileDialogContext';

interface Props {
  userId?: string | null;
  nama?: string | null;
  foto?: string | null;
  /** Ukuran mengikuti skala Tailwind yang dipakai di halaman-halaman aplikasi. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** Warna latar inisial; sesuaikan dengan konteks kartu. */
  tone?: 'amber' | 'blue' | 'neutral';
}

const UKURAN: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
};

const NADA: Record<NonNullable<Props['tone']>, string> = {
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
};

/**
 * Avatar pengguna. Bila `userId` tersedia dan pengunjung sudah login, avatar
 * menjadi tombol yang membuka dialog profil; selain itu hanya tampilan biasa
 * (tamu tidak boleh melihat profil pengguna lain).
 */
export default function UserAvatar({ userId, nama, foto, size = 'md', className = '', tone = 'amber' }: Props) {
  const { user } = useAuth();
  const { bukaProfil } = useProfileDialog();

  const inisial = (nama || '?').substring(0, 2).toUpperCase();
  const bisaDibuka = Boolean(user && userId);

  const isi = (
    <>
      {foto ? (
        <img src={assetUrl(foto)} alt={nama || 'Foto profil'} className="object-cover w-full h-full" loading="lazy" />
      ) : (
        inisial
      )}
    </>
  );

  const kelas = `inline-flex items-center justify-center overflow-hidden font-bold rounded-full shrink-0 ${UKURAN[size]} ${NADA[tone]} ${className}`;

  if (!bisaDibuka) {
    return <span className={kelas} aria-hidden={!nama}>{isi}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        // Kartu di sekitarnya kadang bisa diklik; jangan sampai ikut terpicu.
        e.stopPropagation();
        bukaProfil(userId as string);
      }}
      title={nama ? `Lihat profil ${nama}` : 'Lihat profil'}
      aria-label={nama ? `Lihat profil ${nama}` : 'Lihat profil pengguna'}
      className={`${kelas} transition ring-2 ring-transparent hover:ring-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`}
    >
      {isi}
    </button>
  );
}
