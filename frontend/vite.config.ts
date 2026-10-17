import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dengarkan semua antarmuka jaringan (0.0.0.0), bukan hanya localhost,
    // supaya aplikasi bisa dibuka dari HP / komputer lain di jaringan kampus
    // lewat alamat LAN, mis. http://192.168.1.10:5173
    host: true,
    port: 5173,
    // Catatan: Vite sudah menerima Host header berupa alamat IP (192.168.x.x,
    // 10.x.x.x, ::1, dst.) dan localhost secara bawaan. Jika suatu saat dev server
    // dipasang di balik nama host kustom (mis. bem-ft.local), tambahkan di sini
    // dengan bentuk "bem-ft.local" atau ".local" untuk seluruh subdomainnya.
  },
})
