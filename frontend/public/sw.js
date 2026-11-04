/*
 * Service worker BEM-FT UNAYA.
 *
 * Tugas:
 * 1. Menyajikan kerangka aplikasi + aset build saat jaringan lambat/putus.
 * 2. Menyimpan data GET API terakhir agar halaman tetap terbaca offline.
 * 3. Menerima Web Push dan membuka rute HashRouter yang benar saat diklik.
 * 4. Memutar antrean perubahan (IndexedDB) lewat Background Sync.
 *
 * Permintaan tulis (POST/PUT/PATCH/DELETE) tidak pernah di-cache; antreannya
 * ditangani aplikasi (lihat src/lib/offline.ts).
 */
// Naikkan tiap kali isi aset yang diprecache berubah (mis. ikon diganti) atau
// tiap kali rute penyimpanan berubah: sw.js dengan byte sama tidak memicu
// install ulang, dan cache lama hanya dibuang saat activate versi baru.
const VERSI = 'v6';
const CACHE_SHELL = `bem-ft-shell-${VERSI}`;
const CACHE_DATA = `bem-ft-data-${VERSI}`;
const CACHE_GAMBAR = `bem-ft-gambar-${VERSI}`;
const CACHE_AKTIF = [CACHE_SHELL, CACHE_DATA, CACHE_GAMBAR];

const SHELL_DASAR = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon-64.png',
  // Foto halaman utama. Disimpan sejak pemasangan supaya bagian sejarah
  // tidak kosong saat pengunjung langsung membuka aplikasi dalam mode offline.
  '/fakultas-teknik-blur.jpg',
  '/fakultas-teknik-480.webp',
  '/fakultas-teknik-900.webp',
];

// Endpoint yang tidak boleh disimpan di perangkat: sesi, status online,
// langganan push, dan endpoint internal/cron. /api/auth/me dikecualikan karena
// dibutuhkan agar pengguna tetap dikenali saat membuka aplikasi offline.
const API_TANPA_CACHE = ['/api/presence', '/api/push', '/api/internal', '/api/health'];

const DB_OFFLINE = 'bem-ft-offline';
const STORE_ANTREAN = 'antrean';
const TAG_SINKRON = 'bem-ft-sinkron';

// Cermin src/lib/offline-keputusan.ts: service worker tidak bisa mengimpor
// modul dari src, jadi plafon percobaan disimpan dua kali dan wajib diubah
// bersama.
const BATAS_PERCOBAAN = 5;

// --- Pemasangan & pembersihan cache -------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      await Promise.all(
        SHELL_DASAR.map((url) => cache.add(url).catch(() => undefined))
      );

      // Daftar aset ber-hash dibuat plugin Vite saat build. Bila tidak ada
      // (mis. build lama), aplikasi tetap berjalan dengan cache saat diakses.
      try {
        const respons = await fetch('/precache-manifest.json', { cache: 'reload' });
        if (respons.ok) {
          const daftar = await respons.json();
          if (Array.isArray(daftar)) {
            await Promise.all(
              daftar.map((url) => cache.add(url).catch(() => undefined))
            );
          }
        }
      } catch {
        // Pratinjau lokal tanpa manifest: abaikan.
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const kunci = await caches.keys();
      await Promise.all(
        kunci
          .filter((nama) => nama.startsWith('bem-ft-') && !CACHE_AKTIF.includes(nama))
          .map((nama) => caches.delete(nama))
      );
      await buangKedaluwarsaSekali();
      await self.clients.claim();
    })()
  );
});

// --- Pembatasan jumlah entri cache --------------------------------------

async function batasiCache(cache, batas) {
  try {
    const kunci = await cache.keys();
    if (kunci.length <= batas) return;
    await Promise.all(kunci.slice(0, kunci.length - batas).map((req) => cache.delete(req)));
  } catch {
    // Pembersihan bersifat pemeliharaan; kegagalannya tidak fatal.
  }
}

// --- Umur maksimum entri cache data & gambar -----------------------------
// Header `date` respons disimpan apa adanya oleh Cache API, jadi umur entri
// bisa dibaca tanpa field tambahan. Entri tanpa header dibiarkan: umur tidak
// diketahui, membuang buta akan menghapus data luring yang masih sah.
const UMUR_MAKS_DATA = 7 * 24 * 60 * 60 * 1000;

// Dua cache, satu plafon umur: CACHE_GAMBAR berisi unggahan/foto profil milik
// orang lain, jadi tidak boleh menua tanpa batas seperti aset build.
async function buangDataKedaluwarsa() {
  for (const nama of [CACHE_DATA, CACHE_GAMBAR]) {
    try {
      const cache = await caches.open(nama);
      const sekarang = Date.now();
      for (const permintaan of await cache.keys()) {
        const tersimpan = await cache.match(permintaan);
        const tanggal = tersimpan ? Date.parse(tersimpan.headers.get('date') || '') : NaN;
        if (Number.isFinite(tanggal) && sekarang - tanggal > UMUR_MAKS_DATA) {
          await cache.delete(permintaan);
        }
      }
    } catch {
      // Pembersihan bersifat pemeliharaan; kegagalannya tidak fatal.
    }
  }
}

// --- Satu pemindaian umur per umur service worker ------------------------
// Pemindaian dulu hanya jalan di activate, jadi perangkat yang service
// worker-nya tidak pernah mendapat versi baru menyimpan data pribadi selamanya.
// Toleransinya satu pemindaian penuh per umur SW — bukan jadwal: SW tidur saat
// halaman tertutup, dan membangunkannya lewat timer hanya menambah lalu lintas.
let sudahBuangKedaluwarsa = false;

async function buangKedaluwarsaSekali() {
  if (sudahBuangKedaluwarsa) return;
  sudahBuangKedaluwarsa = true;
  await buangDataKedaluwarsa();
}

// --- Strategi fetch -----------------------------------------------------

const bukanApiSesi = (pathname) =>
  pathname === '/api/auth/me' || !pathname.startsWith('/api/auth/');

async function ambilDataApi(event) {
  const { request } = event;
  event.waitUntil(buangKedaluwarsaSekali());

  try {
    const respons = await fetch(request);
    const tipe = respons.headers.get('content-type') || '';
    const tanpaSimpan = /no-store/i.test(respons.headers.get('cache-control') || '');

    if (respons.ok && tipe.includes('application/json') && !tanpaSimpan) {
      const salinan = respons.clone();
      const cache = await caches.open(CACHE_DATA);
      await cache.put(request, salinan);
      void batasiCache(cache, 120);
    }

    return respons;
  } catch {
    const tersimpan = await caches.match(request, { cacheName: CACHE_DATA });
    if (tersimpan) {
      const headers = new Headers(tersimpan.headers);
      headers.set('X-Dari-Cache', '1');
      return new Response(await tersimpan.blob(), {
        status: tersimpan.status,
        statusText: tersimpan.statusText,
        headers,
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Anda sedang offline dan data ini belum pernah dimuat di perangkat.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'X-Offline': '1' },
      }
    );
  }
}

async function ambilGambar(event) {
  const { request } = event;
  event.waitUntil(buangKedaluwarsaSekali());
  const cache = await caches.open(CACHE_GAMBAR);
  const tersimpan = await cache.match(request);
  if (tersimpan) return tersimpan;

  try {
    const respons = await fetch(request);
    // no-store juga berlaku untuk gambar: foto profil tidak boleh tertinggal.
    // shortcut: respons opaque (tanpa CORS, mis. Cloudinary) tidak mengekspos
    // header, jadi no-store-nya tidak terbaca dan entri tetap disimpan; naik
    // level ke permintaan mode 'cors' begitu penyedia mengizinkan pembacaan.
    const tanpaSimpan = /no-store/i.test(respons.headers.get('cache-control') || '');
    if (!tanpaSimpan && (respons.ok || respons.type === 'opaque')) {
      await cache.put(request, respons.clone()).catch(() => undefined);
      void batasiCache(cache, 80);
    }
    return respons;
  } catch {
    return tersimpan || Response.error();
  }
}

async function ambilAset(event) {
  const { request } = event;
  const tersimpan = await caches.match(request);

  const dariJaringan = fetch(request)
    .then((respons) => {
      if (respons.ok) {
        const salinan = respons.clone();
        void caches.open(CACHE_SHELL).then((cache) => cache.put(request, salinan)).catch(() => undefined);
      }
      return respons;
    })
    .catch(() => tersimpan || Response.error());

  return tersimpan || dariJaringan;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Data API: network-first, fallback ke data terakhir di perangkat.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    if (API_TANPA_CACHE.some((awalan) => url.pathname.startsWith(awalan))) return;
    if (!bukanApiSesi(url.pathname)) return;
    event.respondWith(ambilDataApi(event));
    return;
  }

  // Gambar dari Cloudinary/domain lain ikut disimpan agar galeri terbaca offline.
  if (url.origin !== self.location.origin) {
    if (request.destination === 'image') event.respondWith(ambilGambar(event));
    return;
  }

  // Unggahan milik pengguna masuk cache gambar, bukan kerangka: yang pertama
  // dibuang saat logout/ganti akun, yang kedua tidak.
  if (url.pathname.startsWith('/uploads/')) {
    if (request.destination === 'image') event.respondWith(ambilGambar(event));
    return;
  }

  // Navigasi: coba jaringan, lalu kerangka aplikasi tersimpan.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((respons) => {
          const salinan = respons.clone();
          void caches.open(CACHE_SHELL).then((cache) => cache.put('/index.html', salinan)).catch(() => undefined);
          return respons;
        })
        .catch(async () => {
          const index = await caches.match('/index.html');
          return index || caches.match('/');
        })
    );
    return;
  }

  // Aset statis & gambar: cache dulu, perbarui di latar belakang.
  const asetBoleh = ['script', 'style', 'font', 'image'].includes(request.destination) ||
    url.pathname.startsWith('/assets/');
  if (asetBoleh) event.respondWith(ambilAset(event));
});

// --- Notifikasi Web Push ------------------------------------------------

/**
 * Mengubah tujuan notifikasi menjadi rute HashRouter, mis. /dashboard menjadi
 * /#/dashboard. Tanpa ini, klik notifikasi membuka /dashboard (tanpa hash) dan
 * React Router tidak menemukan halamannya.
 */
function keRuteHash(nilai) {
  try {
    const url = new URL(nilai || '/dashboard', self.location.origin);
    if (url.hash) return url.href;
    return `${self.location.origin}/#${url.pathname}${url.search}`;
  } catch {
    return `${self.location.origin}/#/dashboard`;
  }
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'BEM-FT UNAYA',
    body: 'Ada informasi baru untuk Anda.',
    url: '/dashboard',
  };

  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const tujuan = keRuteHash(data.url);
  event.waitUntil(
    self.registration.showNotification(data.title || 'BEM-FT UNAYA', {
      body: data.body || 'Ada informasi baru untuk Anda.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: tujuan },
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      vibrate: [80, 40, 80],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tujuan = event.notification.data?.url || keRuteHash('/dashboard');

  event.waitUntil(
    (async () => {
      const daftar = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const klien of daftar) {
        if (klien.url === tujuan && 'focus' in klien) return klien.focus();
      }

      const klien = daftar.find((c) => 'focus' in c);
      if (klien) {
        await klien.focus();
        if ('navigate' in klien) {
          const hasil = await klien.navigate(tujuan);
          return hasil?.focus?.();
        }
        return undefined;
      }

      return self.clients.openWindow ? self.clients.openWindow(tujuan) : undefined;
    })()
  );
});

// --- Pesan dari halaman -------------------------------------------------

self.addEventListener('message', (event) => {
  const tipe = event.data?.type;
  if (tipe === 'BERSIHKAN_CACHE_DATA') {
    event.waitUntil(
      Promise.all([caches.delete(CACHE_DATA), caches.delete(CACHE_GAMBAR)]).then(() => undefined)
    );
  }
  if (tipe === 'SINKRON_ANTREAN') {
    event.waitUntil(sinkronkanAntrean());
  }
  if (tipe === 'PRACACHE_GAMBAR') {
    const daftar = Array.isArray(event.data?.urls) ? event.data.urls : [];
    event.waitUntil(simpanGambar(daftar));
  }
});

/**
 * Menyimpan gambar yang sedang tampil di halaman (termasuk foto Cloudinary)
 * segera setelah servis pekerja terpasang. Halaman mengirim daftar URL-nya
 * sendiri karena aset dari API/CMS tidak dapat diketahui saat build.
 */
async function simpanGambar(daftar) {
  const cache = await caches.open(CACHE_GAMBAR);

  await Promise.all(
    daftar.map(async (nilai) => {
      try {
        const url = new URL(String(nilai), self.location.origin);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

        const request = new Request(url.href, {
          mode: url.origin === self.location.origin ? 'same-origin' : 'no-cors',
        });

        // Lewati gambar yang sudah tersimpan di cache mana pun (mis. foto
        // landing dari daftar precache) agar tidak tersimpan dua kali.
        if (await caches.match(request)) return;

        const respons = await fetch(request);
        if (respons.ok || respons.type === 'opaque') await cache.put(request, respons);
      } catch {
        // Satu gambar gagal disimpan tidak boleh menghentikan yang lain.
      }
    })
  );

  void batasiCache(cache, 80);
}

// --- Sinkronisasi antrean offline --------------------------------------

function bukaDb() {
  return new Promise((resolve, reject) => {
    const permintaan = indexedDB.open(DB_OFFLINE, 1);
    permintaan.onupgradeneeded = () => {
      const db = permintaan.result;
      if (!db.objectStoreNames.contains(STORE_ANTREAN)) {
        db.createObjectStore(STORE_ANTREAN, { keyPath: 'id' });
      }
    };
    permintaan.onsuccess = () => resolve(permintaan.result);
    permintaan.onerror = () => reject(permintaan.error);
  });
}

function bacaSemuaAntrean() {
  return bukaDb()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          const permintaan = db
            .transaction(STORE_ANTREAN, 'readonly')
            .objectStore(STORE_ANTREAN)
            .getAll();
          permintaan.onsuccess = () => resolve(permintaan.result || []);
          permintaan.onerror = () => reject(permintaan.error);
        })
    )
    .catch(() => []);
}

function hapusAntreanSw(id) {
  return bukaDb()
    .then(
      (db) =>
        new Promise((resolve) => {
          const permintaan = db
            .transaction(STORE_ANTREAN, 'readwrite')
            .objectStore(STORE_ANTREAN)
            .delete(id);
          permintaan.onsuccess = () => resolve();
          permintaan.onerror = () => resolve();
        })
    )
    .catch(() => undefined);
}

/** Naikkan penghitung percobaan gagal tanpa mengubah isi entri. */
function catatPercobaanSw(item) {
  return bukaDb()
    .then(
      (db) =>
        new Promise((resolve) => {
          const permintaan = db
            .transaction(STORE_ANTREAN, 'readwrite')
            .objectStore(STORE_ANTREAN)
            .put({ ...item, coba: (item.coba ?? 0) + 1 });
          permintaan.onsuccess = () => resolve();
          permintaan.onerror = () => resolve();
        })
    )
    .catch(() => undefined);
}

/**
 * Keputusan untuk 4xx yang bukan 400/422 (sesi kedaluwarsa, peran berubah,
 * limiter). 'hentikan' = 5xx/jaringan, entri tidak boleh disalahkan.
 */
function keputusanTahanSw(status, coba) {
  if (status === undefined || status < 400 || status >= 500) return 'hentikan';
  return coba + 1 >= BATAS_PERCOBAAN ? 'buang' : 'catat';
}

async function sinkronkanAntrean() {
  // Bila ada tab terbuka, biarkan halaman memutar antrean (sesi & UI-nya aktif).
  const daftarKlien = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (daftarKlien.length > 0) {
    for (const klien of daftarKlien) klien.postMessage({ type: 'SINKRON_ANTREAN' });
    return;
  }

  const antrean = (await bacaSemuaAntrean()).sort((a, b) => a.createdAt - b.createdAt);
  let selesai = 0;
  let gagal = 0;

  for (const item of antrean) {
    try {
      const respons = await fetch(item.url, {
        method: item.method,
        credentials: 'include',
        headers: item.data !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: item.data !== undefined ? JSON.stringify(item.data) : undefined,
      });

      if (respons.ok) {
        await hapusAntreanSw(item.id);
        selesai += 1;
      } else if (respons.status === 400 || respons.status === 422) {
        // Isi data benar-benar tidak valid (satu-satunya yang layak dibuang):
        // pengulangan dengan body yang sama akan ditolak lagi.
        await hapusAntreanSw(item.id);
        gagal += 1;
      } else {
        // 4xx lain (401 sesi kedaluwarsa, 403 peran, 429 limiter) dan 5xx/jaringan
        // adalah keadaan sementara — entri BERTAHAN. Sengaja berhenti, bukan
        // lanjut, supaya urutan tidak kacau. Plafon coba dicermin dari
        // src/lib/offline-keputusan.ts supaya tab tertutup pun tidak memutar
        // entri selamanya; ubah keduanya sekaligus.
        const keputusan = keputusanTahanSw(respons.status, item.coba ?? 0);
        if (keputusan === 'buang') await hapusAntreanSw(item.id);
        else if (keputusan === 'catat') await catatPercobaanSw(item);
        break;
      }
    } catch {
      break;
    }
  }

  if (selesai > 0) {
    await self.registration.showNotification('Data tersinkronisasi', {
      body: `${selesai} perubahan yang dibuat saat offline berhasil dikirim.`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'sinkron-offline',
      data: { url: keRuteHash('/dashboard') },
    });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === TAG_SINKRON) event.waitUntil(sinkronkanAntrean());
});
