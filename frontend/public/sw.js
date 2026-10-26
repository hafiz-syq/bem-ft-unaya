/*
 * Service worker BEM-FT UNAYA.
 *
 * Dua tugas: (1) menyajikan kerangka aplikasi saat jaringan lambat/putus, dan
 * (2) menerima notifikasi Web Push lalu membuka halaman yang relevan saat
 * diklik. API, unggahan, dan permintaan non-GET tidak pernah di-cache.
 */
const CACHE = 'bem-ft-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const salinan = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', salinan)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Aset ber-hash: ambil dari cache dulu, perbarui di latar belakang.
  event.respondWith(
    caches.match(request).then((cached) => {
      const jaringan = fetch(request)
        .then((response) => {
          if (response.ok) {
            const salinan = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, salinan)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || jaringan;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'BEM-FT UNAYA', body: 'Ada informasi baru untuk Anda.', url: '/dashboard' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (error) {
    // Payload bukan JSON: pakai teks mentah bila ada.
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'BEM-FT UNAYA', {
      body: data.body || 'Ada informasi baru untuk Anda.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard' },
      vibrate: [80, 40, 80],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tujuan = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === tujuan && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(tujuan);
      return undefined;
    })
  );
});
