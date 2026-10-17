import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

/**
 * Tombol pengalih tema.
 * `className` opsional dipakai halaman yang perlu menempatkannya secara absolut
 * (mis. halaman Login).
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { tema, gantiTema } = useTheme();
  return (
    <button
      onClick={gantiTema}
      className={`flex items-center gap-1.5 text-sm font-bold text-gray-600 dark:text-gray-400 transition hover:text-amber-500 dark:hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded px-1 ${className}`}
      aria-label={tema === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
      title={tema === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
    >
      {tema === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="hidden sm:inline">{tema === 'dark' ? 'Terang' : 'Gelap'}</span>
    </button>
  );
}

export { ThemeToggle };
