/**
 * ITERASI-AUDIT-5: sisa data pribadi di ponsel setelah pengguna logout.
 *
 * public/sw.js dimuat di sandbox node:vm lewat siapkanSwLuring() dan Cache
 * Storage palsunya dibagikan dengan modul halaman (src/lib/offline.ts), jadi
 * jalur penyimpanan service worker bisa dites tanpa browser. Yang dijaga di
 * sini: foto galeri tidak boleh masuk cache kerangka (S6), pembersihan logout
 * benar-benar menghapusnya, umur entri gambar ditegakkan (S8), tujuan klik push
 * tetap di domain sendiri (S9), dan pemindaian umur berjalan meski service
 * worker tidak pernah update (S7).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASAL_APLIKASI,
  buatPermintaanPalsu,
  buatResponsPalsu,
  imporOffline,
  pasangIdbPalsu,
  pasangNavigatorSw,
  siapkanSwLuring,
} from './alat-bantu-luring.ts';

const FOTOKUI = { 'content-type': 'image/jpeg' };

/** Tanggal HTTP `n` jam lalu, sesuai header `date` yang dibaca sw.js. */
const jamLalu = (jam: number) => new Date(Date.now() - jam * 3600_000).toUTCString();

const muatJalurGambar = async () =>
  await siapkanSwLuring({
    respons: () => buatResponsPalsu({ headers: { ...FOTOKUI, date: jamLalu(0) } }),
  });

test('a. /uploads masuk cache gambar, bukan cache kerangka (S6)', async () => {
  const sw = await muatJalurGambar();
  const foto = `${ASAL_APLIKASI}/uploads/galeri/foto-1.jpg`;

  const { respons } = await sw.kirim('fetch', {
    request: buatPermintaanPalsu(foto, { destination: 'image' }),
  });

  assert.equal(respons?.status, 200, 'foto tetap disajikan ke halaman');
  assert.deepEqual(
    sw.store.urls(sw.baca('CACHE_GAMBAR') as string),
    [foto],
    'foto galeri tersimpan di cache gambar'
  );
  assert.deepEqual(
    sw.store.urls(sw.baca('CACHE_SHELL') as string),
    [],
    'cache kerangka tidak boleh menampung unggahan pengguna'
  );
});

test('b. pembersihan logout tidak meninggalkan unggahan di cache mana pun', async () => {
  const sw = await muatJalurGambar();
  const foto = `${ASAL_APLIKASI}/uploads/galeri/foto-1.jpg`;
  const asetStatik = `${ASAL_APLIKASI}/assets/app-abc123.js`;

  await sw.kirim('fetch', { request: buatPermintaanPalsu(foto, { destination: 'image' }) });
  await sw.kirim('fetch', { request: buatPermintaanPalsu(asetStatik, { destination: 'script' }) });

  pasangIdbPalsu(new Map());
  pasangNavigatorSw();
  await (await imporOffline()).bersihkanCacheOffline();

  assert.deepEqual(
    sw.store.urlsSemua().filter((url) => url.includes('/uploads/')),
    [],
    'tidak ada satu pun cache yang masih menyimpan foto unggahan'
  );
  assert.equal(
    sw.store.has(sw.baca('CACHE_GAMBAR') as string),
    false,
    'buktinya: cache gambar dibuang, bukan sekadar dikosongkan'
  );
  assert.deepEqual(
    sw.store.urls(sw.baca('CACHE_SHELL') as string),
    [asetStatik],
    'kerangka + aset build tetap tersimpan agar aplikasi masih terbuka luring'
  );
});

test('c. umur entri gambar ditegakkan bersama entri data (S8)', async () => {
  const sw = await siapkanSwLuring();
  const umur = sw.baca('UMUR_MAKS_DATA') as number;
  const lebihTua = new Date(Date.now() - umur - 3600_000).toUTCString();
  const lebihMuda = new Date(Date.now() - umur / 2).toUTCString();

  const gambar = await sw.store.open(sw.baca('CACHE_GAMBAR') as string);
  const data = await sw.store.open(sw.baca('CACHE_DATA') as string);
  const fotoTua = `${ASAL_APLIKASI}/uploads/galeri/tua.jpg`;
  const fotoMuda = `${ASAL_APLIKASI}/uploads/galeri/muda.jpg`;
  const jsonTua = `${ASAL_APLIKASI}/api/notifications?tua`;
  const jsonMuda = `${ASAL_APLIKASI}/api/notifications?muda`;

  await gambar.put(buatPermintaanPalsu(fotoTua), buatResponsPalsu({ headers: { ...FOTOKUI, date: lebihTua } }));
  await gambar.put(buatPermintaanPalsu(fotoMuda), buatResponsPalsu({ headers: { ...FOTOKUI, date: lebihMuda } }));
  await data.put(
    buatPermintaanPalsu(jsonTua),
    buatResponsPalsu({ headers: { 'content-type': 'application/json', date: lebihTua } })
  );
  await data.put(
    buatPermintaanPalsu(jsonMuda),
    buatResponsPalsu({ headers: { 'content-type': 'application/json', date: lebihMuda } })
  );

  await (sw.konteks.buangDataKedaluwarsa as () => Promise<void>)();

  assert.deepEqual(gambar.urls(), [fotoMuda], 'foto profil berumur > 7 hari dibuang');
  assert.deepEqual(data.urls(), [jsonMuda], 'entri data masih ikut dibuang (regresi)');
});

test('d. gambar bertanda no-store tidak disimpan, opaque tetap boleh', async () => {
  const tanpaSimpan = await siapkanSwLuring({
    respons: () =>
      buatResponsPalsu({ headers: { ...FOTOKUI, date: jamLalu(0), 'cache-control': 'no-store' } }),
  });
  const urlTanpaSimpan = `${ASAL_APLIKASI}/uploads/profil/a.jpg`;
  await tanpaSimpan.kirim('fetch', {
    request: buatPermintaanPalsu(urlTanpaSimpan, { destination: 'image' }),
  });
  assert.deepEqual(
    tanpaSimpan.store.urls(tanpaSimpan.baca('CACHE_GAMBAR') as string),
    [],
    'no-store berlaku juga untuk gambar'
  );
  assert.deepEqual(
    tanpaSimpan.store.urls(tanpaSimpan.baca('CACHE_SHELL') as string),
    [],
    'dan tidak boleh mendarat di cache kerangka lewat rute lain'
  );

  const opaque = await siapkanSwLuring({
    respons: () => buatResponsPalsu({ status: 0, body: '', type: 'opaque' }),
  });
  const urlOpaque = 'https://res.cloudinary.test/demo/foto.jpg';
  const { respons } = await opaque.kirim('fetch', {
    request: buatPermintaanPalsu(urlOpaque, { destination: 'image' }),
  });
  assert.equal(respons?.type, 'opaque', 'respons lintas domain tanpa CORS tetap disajikan');
  assert.deepEqual(
    opaque.store.urls(opaque.baca('CACHE_GAMBAR') as string),
    [urlOpaque],
    'entri opaque masih boleh disimpan (lihat anotasi shortcut di sw.js)'
  );
});

test('e. pemindaian umur berjalan walau service worker tidak pernah update (S7)', async () => {
  // Responsnya bukan JSON, jadi jalur data tidak menambah entri baru: berapa
  // kali cache data dipindai menjadi ukuran yang pasti untuk `kirim` di bawah.
  const sw = await siapkanSwLuring({
    respons: () => buatResponsPalsu({ headers: { 'content-type': 'text/plain', date: jamLalu(0) } }),
  });
  const umur = sw.baca('UMUR_MAKS_DATA') as number;
  const data = await sw.store.open(sw.baca('CACHE_DATA') as string);
  const tua = `${ASAL_APLIKASI}/api/lama`;
  const muda = `${ASAL_APLIKASI}/api/baru`;
  await data.put(
    buatPermintaanPalsu(tua),
    buatResponsPalsu({
      headers: {
        'content-type': 'application/json',
        date: new Date(Date.now() - umur - 3600_000).toUTCString(),
      },
    })
  );
  await data.put(
    buatPermintaanPalsu(muda),
    buatResponsPalsu({ headers: { 'content-type': 'application/json', date: jamLalu(0) } })
  );

  // Peristiwa activate TIDAK dikirim: inilah kondisi perangkat yang service
  // worker-nya tidak pernah mendapat versi baru.
  for (let i = 0; i < 3; i += 1) {
    await sw.kirim('fetch', { request: buatPermintaanPalsu(`${ASAL_APLIKASI}/api/uji-${i}`) });
  }

  assert.equal(data.jumlahMatch, 2, 'tepat satu pemindaian penuh (2 entri) untuk 3 permintaan');
  assert.deepEqual(data.urls(), [muda], 'entri kedaluwarsa benar-benar hilang');
});

test('f. keRuteHash menolak tujuan push dari domain lain (S9)', async () => {
  const sw = await siapkanSwLuring();
  const keRuteHash = sw.konteks.keRuteHash as (nilai?: string) => string;

  // Cabang bertanda hash mengembalikan href apa adanya: inilah jalan keluar dari
  // aplikasi di jendela standalone tanpa address bar.
  assert.equal(keRuteHash('https://luar.example/#/terkirim'), `${ASAL_APLIKASI}/#/dashboard`);
  assert.equal(keRuteHash('https://luar.example/x'), `${ASAL_APLIKASI}/#/dashboard`);
  assert.equal(keRuteHash('http://app.test.other/students'), `${ASAL_APLIKASI}/#/dashboard`);
  assert.equal(keRuteHash('/students'), `${ASAL_APLIKASI}/#/students`, 'tujuan lokal tidak berubah');
  assert.equal(keRuteHash(undefined), `${ASAL_APLIKASI}/#/dashboard`);
});
