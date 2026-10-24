import { Flag, MoonStar, PartyPopper } from 'lucide-react';
import { useSeasonalTheme } from '../contexts/SeasonalThemeContext';
import { LABEL_TEMA, type TemaMusiman } from '../lib/tema-musiman';

const IKON: Record<Exclude<TemaMusiman, 'NONE'>, typeof MoonStar> = {
  RAMADAN: MoonStar,
  LEBARAN: PartyPopper,
  NUSANTARA: Flag,
};

/**
 * Penanda kecil tema musiman yang sedang aktif.
 * Tidak merender apa pun pada tema netral, sehingga tidak mengubah tata letak
 * saat tidak ada perayaan.
 */
export default function SeasonalBadge({ className = '' }: { className?: string }) {
  const { tema } = useSeasonalTheme();
  if (tema === 'NONE') return null;

  const Ikon = IKON[tema];

  return (
    <span
      className={`musim-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm ${className}`}
      title={`Tema musiman aktif: ${LABEL_TEMA[tema]}`}
    >
      <Ikon className="w-3 h-3 shrink-0" aria-hidden="true" />
      Tema {LABEL_TEMA[tema]}
    </span>
  );
}
