import { usePresence } from '../contexts/PresenceContext';

interface Props {
  userId?: string | null;
  /** Ukuran titik; `sm` untuk avatar kecil, `md` untuk avatar besar. */
  size?: 'sm' | 'md';
  /** Posisi titik mengikuti sudut avatar pembungkusnya. */
  className?: string;
}

const UKURAN = {
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3.5 h-3.5 border-[3px]',
} as const;

/**
 * Titik hijau penanda pengguna yang sedang membuka situs.
 *
 * Warna hijau dipakai karena menjadi tanda "aktif" yang lazim dan tetap
 * terbaca di mode terang maupun gelap. Komponen ini hanya dirender ketika
 * pengguna benar-benar online, sehingga tidak ada titik abu-abu yang
 * membingungkan.
 */
export default function StatusOnline({ userId, size = 'sm', className = '' }: Props) {
  const { online } = usePresence();

  if (!userId || !online.has(userId)) return null;

  return (
    <span
      className={`absolute bottom-0 right-0 ${UKURAN[size]} rounded-full bg-green-500 border-white dark:border-gray-900 ${className}`}
      title="Sedang online"
      aria-label="Sedang online"
      role="status"
    />
  );
}
