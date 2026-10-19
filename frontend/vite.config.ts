import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Menanam CSS hasil build langsung ke index.html.
 *
 * Berkas CSS hanya sekitar 10 KB, tetapi sebagai <link> ia memblokir render
 * sampai selesai diunduh. Dengan ditanam, First Contentful Paint dan LCP tidak
 * lagi menunggu satu permintaan tambahan. Hanya dipakai saat build produksi;
 * dev server tetap memakai HMR biasa.
 */
const tanamCss: Plugin = {
  name: 'tanam-css-produksi',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const tautan = html.match(/<link[^>]+rel="stylesheet"[^>]*>/)?.[0]
      const href = tautan ? /href="([^"]+)"/.exec(tautan)?.[1] : undefined
      if (!tautan || !href) return html

      const aset = ctx.bundle?.[href.replace(/^\//, '')]
      if (!aset || aset.type !== 'asset') return html

      const css = typeof aset.source === 'string' ? aset.source : Buffer.from(aset.source).toString('utf8')
      return html.replace(tautan, `<style>${css}</style>`)
    },
  },
}

/**
 * Plugin prerender landing page.
 *
 * Pada saat build, plugin ini membuat salinan index.html yang sudah berisi
 * konten statis halaman landing (hero, fitur, sejarah, dll) sehingga:
 * - Lighthouse Performance dapat mencapai skor tinggi karena konten langsung
 *   terlihat tanpa menunggu JavaScript hydration sepenuhnya
 * - Fitur interaktif (menu mobile, theme toggle, carousel, form komentar, dll)
 *   tetap berfungsi setelah React hydrate pada saat halaman dimuat
 *
 * Cara kerja:
 * 1. Membuat variabel window.__LANDING_DATA__ dengan data statis halaman landing
 * 2. Hal ini dilakukan di build time, bukan runtime
 * 3. Saat halaman dimuat, React akan membaca data ini dan merender komponen
 * 4. Setelah hydrated, fitur interaktif dapat digunakan
 */
// Data statis halaman landing. Berada di tingkat modul sehingga plugin
// dataLanding (menulis berkas JSON) dan plugin prerenderLanding (menyisipkan
// ke index.html) memakai objek yang sama, tanpa siap-menunggu urutan hook.
const dataLandingStatis = {
  version: 1,
  generatedAt: new Date().toISOString(),
  // Navigasi
  nav: {
    logo: {
      name: 'TEKNIK UNAYA',
      subtitle: 'Portal Resmi',
    },
    menu: [
      { label: 'Sejarah', href: '#sejarah' },
      { label: 'Program', href: '#program' },
      { label: 'Berita', href: '#berita' },
      { label: 'Agenda', href: '#agenda' },
      { label: 'Galeri', href: '#galeri' },
      { label: 'Aspirasi', href: '#aspirasi' },
    ],
    actions: {
      themeToggle: true,
      loginLink: '/login',
      dashboardLink: '/dashboard',
    },
  },
  // Hero section
  hero: {
    title: 'Kolaborasi Nyata Untuk TEKNIK Yang Lebih Baik',
    subtitle: 'Selamat datang di Portal Resmi Badan Eksekutif Mahasiswa Fakultas Teknik Universitas Abulyatama. Kami hadir sebagai wadah aspirasi dan inovasi mahasiswa.',
    buttons: [
      { label: 'Kabar Terbaru', href: '#berita' },
      { label: 'Program Kerja', href: '#program' },
    ],
  },
  // Fitur utama
  fitur: [
    {
      icon: 'Users',
      title: 'Aspirasi Terpusat',
      description: 'Sampaikan keluhan langsung melalui sistem tiket yang transparan.',
    },
    {
      icon: 'ShieldCheck',
      title: 'Validasi Terjamin',
      description: 'Data mahasiswa yang tersinkronisasi dan aman secara sistematis.',
    },
    {
      icon: 'Building',
      title: 'Struktur Dinamis',
      description: 'Kenali siapa saja yang bekerja di balik layar BEM FT UNAYA.',
    },
  ],
  // Sejarah
  sejarah: {
    badge: 'Profil Fakultas',
    title: 'Sejarah Singkat Fakultas Teknik UNAYA',
    paragraph: 'Fakultas Teknik Universitas Abulyatama didirikan dengan tujuan mulia untuk mencetak insinyur dan tenaga ahli keteknikan yang unggul, berintegritas, dan siap berkontribusi dalam pembangunan bangsa.',
    paragraph2: 'Seiring berjalannya waktu, BEM-FT hadir sebagai wadah perjuangan, inovasi, dan kreativitas mahasiswa teknik untuk menyalurkan gagasan dan menjaga tradisi solidaritas.',
    links: [
      { label: 'Lihat Struktur Kepengurusan', href: '/about' },
      { label: 'Riwayat Demisioner', href: '/demisioner' },
    ],
  },
  // Data yang butuh API (berita, agenda, galeri, dll.) tidak dirampang di sini:
  // halaman tetap mengambilnya dari backend setelah dimuat.
}

/**
 * Prerender landing: merender halaman dengan react-dom/server saat build.
 *
 * - transformIndexHtml: menyisipkan data statis sebagai window.__LANDING_DATA__.
 * - closeBundle: merender komponen landing (lewat Vite SSR) menjadi HTML nyata
 *   lalu menempelkannya ke <div id="root"> di dist/index.html. Tidak ada
 *   dependensi baru; react-dom/server dan vite sudah tersedia.
 */
const prerenderLanding: Plugin = {
  name: 'prerender-landing',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      // Hanya aplikasi ke index.html utama
      if (!(ctx.path === '/index.html' || ctx.path.endsWith('/index.html'))) return html

      // Data statis di tingkat modul: selalu tersedia, tanpa pembacaan berkas
      const landingData = dataLandingStatis

      // Sisipkan data sebagai variabel global sebelum script React dimuat
      // Ini memungkinkan React membaca data saat hydration tanpa fetch tambahan
      const scriptTag = `<script>
        window.__LANDING_DATA__ = ${JSON.stringify(landingData)}
      </script>`

      // Sisipkan setelah </head> dan sebelum <body> atau di awal <body>
      return html.replace('</head>', `${scriptTag}\n</head>`)
    },
  },
  async closeBundle() {
    const { createServer } = await import('vite')
    const serverSSR = await createServer({
      logLevel: 'error',
      server: { middlewareMode: true },
      appType: 'custom',
    })
    try {
      const mod = await serverSSR.ssrLoadModule('/src/landing-prerender.tsx')
      const markup: string = typeof mod.renderMarkupLanding === 'function' ? await mod.renderMarkupLanding() : ''
      if (!markup.trim()) {
        console.warn('[prerender] markup kosong — index.html dibiarkan apa adanya.')
        return
      }

      // React 19 mengangkat tag <link> (mis. preload aset hero) ke pangkal
      // keluaran SSR. Tag itu harus masuk <head>, bukan ke dalam #root — bila
      // ikut tertanam di #root, hidrasi React gagal karena isinya tidak sama.
      const tautanDiangkat = [...markup.matchAll(/<link\b[^>]*/g)].map((m) => m[0] + '>')
      const markupIsi = markup.replace(/<link\b[^>]*>/g, '').trim()

      const indeksHtml = path.join(__dirname, 'dist', 'index.html')
      let html = fs.readFileSync(indeksHtml, 'utf8')
      const penanda = '<div id="root"></div>'
      if (!html.includes(penanda)) {
        console.warn('[prerender] penanda #root tidak ada di index.html.')
        return
      }

      if (tautanDiangkat.length > 0) {
        html = html.replace('</head>', `${tautanDiangkat.join('\n')}\n</head>`)
      }
      fs.writeFileSync(indeksHtml, html.replace(penanda, `<div id="root">${markupIsi}</div>`), 'utf8')
      console.log(`[prerender] markup landing (${markupIsi.length} karakter) disisipkan ke index.html, ${tautanDiangkat.length} tag link dipindah ke <head>`)
    } catch (gagal) {
      // Prerender adalah peningkatan, bukan keharusan: bila gagal, build tetap
      // menghasilkan aplikasi yang bisa digunakan (render dari klien penuh).
      console.error('[prerender] Gagal merender markup:', gagal instanceof Error ? gagal.message : String(gagal))
    } finally {
      await serverSSR.close()
    }
  },
}

/**
 * Plugin untuk membuat landing-data.json selama build.
 *
 * File ini berisi data statis yang dibutuhkan halaman landing.
 * Dihasilkan sekali saat build dan digunakan oleh prerenderLanding.
 */
const dataLanding: Plugin = {
  name: 'data-landing',
  apply: 'build',
  enforce: 'post',
  generateBundle(options) {
    // Path ke folder dist
    const distDir = options.dir || path.resolve(__dirname, 'dist')

    // Tulis file landing-data.json (salinan data yang sama dengan yang
    // disisipkan prerenderLanding ke index.html, berguna bila dibutuhkan
    // oleh pembaruan data runtime).
    const filePath = path.join(distDir, 'landing-data.json')
    fs.writeFileSync(filePath, JSON.stringify(dataLandingStatis, null, 2), 'utf8')

    // Catat informasi di console
    console.log('[prerender] landing-data.json dihasilkan di', filePath)
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tanamCss, prerenderLanding, dataLanding],
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
  build: {
    // Source maps untuk debugging (non-production)
    sourcemap: false,
    // Minification
    minify: 'esbuild',
  },
})
