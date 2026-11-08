/**
 * Tampilan sementara saat potongan halaman sedang diunduh. Dipakai dua
 * tempat: batas Suspense di App (saat layout ikut dimuat) dan batas Suspense
 * di dalam DashboardLayout (saat hanya halaman berganti, menu samping tetap
 * terpasang).
 */
export default function MemuatHalaman() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-live="polite">
      <span className="w-10 h-10 border-4 rounded-full border-amber-200 border-t-amber-500 animate-spin" />
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
