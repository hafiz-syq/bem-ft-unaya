import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

/**
 * Verifikasi aturan akses halaman Data Mahasiswa untuk peran NON-ADMIN.
 *
 * Pengujian dilakukan lewat HTTP (bukan memanggil controller langsung) supaya
 * hasilnya mencerminkan yang benar-benar dialami klien:
 *
 *   1. Tanpa login            -> GET /students        = 401, /students/export = 401
 *   2. Pengurus biasa         -> GET /students        = 200, /students/export = 403
 *   3. Mahasiswa              -> GET /students        = 403, /students/export = 403
 *   4. Keduanya               -> PATCH /students/:id/role = 403 (hanya admin)
 *   5. (opsional) Admin       -> GET /students/export = 200 + berkas CSV,
 *                                bila ADMIN_NIM & ADMIN_PASSWORD disetel.
 *
 * Untuk ekspor, yang diperiksa bukan hanya kode 403, tetapi juga bahwa isi
 * balasannya BUKAN data CSV — jadi terbukti tidak ada data mahasiswa yang bocor
 * ke peran non-admin.
 *
 * NIM 99990001 (mahasiswa uji) dan 99990002 (pengurus uji) DISEDIAKAN untuk
 * skrip ini; jangan dipakai untuk akun asli. Keduanya dibuat di awal dan
 * dihapus lagi di akhir — termasuk bila pengujian gagal — sehingga isi basis
 * data kembali seperti semula setelah skrip selesai.
 *
 * Cara pakai (server dev harus sudah jalan):
 *   npm run verifikasi:akses
 *   API_URL=http://192.168.1.10:3000/api npm run verifikasi:akses
 *   ADMIN_NIM=adminHafiz ADMIN_PASSWORD=... npm run verifikasi:akses
 *
 * Catatan: endpoint login dibatasi 5 permintaan / 5 menit / IP (lihat
 * routes/auth.routes.ts). Skrip ini memakai 2 login (3 bila kredensial admin
 * diberikan), jadi jalankan ulang setelah jendela pembatasan lewat bila
 * muncul balasan 429.
 */

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

const NIM_MAHASISWA = '99990001';
const NIM_PENGURUS = '99990002';
const SANDI_UJI = 'UjiNonAdmin123';

let jumlahGagal = 0;

/** Membandingkan hasil nyata dengan yang diharapkan, lalu mencetak LULUS/GAGAL. */
function periksa(nama: string, dapat: unknown, harus: unknown): void {
  const lulus = dapat === harus;
  if (!lulus) jumlahGagal++;
  console.log(`${lulus ? '  LULUS' : '  GAGAL'}  ${nama.padEnd(52)} dapat: ${String(dapat).padEnd(6)} harus: ${harus}`);
}

/** Rangkai seluruh cookie dari balasan (dipakai untuk membawa sesi login). */
function cookieDari(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

async function minta(path: string, opsi: { method?: string; cookie?: string; body?: unknown } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: opsi.method ?? 'GET',
    headers: {
      ...(opsi.cookie ? { cookie: opsi.cookie } : {}),
      ...(opsi.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(opsi.body ? { body: JSON.stringify(opsi.body) } : {}),
  });
  return { status: res.status, body: await res.text() };
}

/** Login lalu kembalikan cookie sesinya. */
async function login(nim: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nim, password }),
  });

  if (!res.ok) {
    throw new Error(
      `Login ${nim} gagal (HTTP ${res.status}). ` +
        (res.status === 429
          ? 'Batas 5 login / 5 menit tercapai — jalankan ulang setelah jendelanya lewat.'
          : await res.text())
    );
  }

  return cookieDari(res);
}

/** Buat (atau segarkan) akun uji. NIM 9999000x disediakan untuk skrip ini. */
async function siapkanAkun(nim: string, nama: string, role: Role): Promise<string> {
  const password_hash = await bcrypt.hash(SANDI_UJI, 10);
  const akun = await prisma.user.upsert({
    where: { nim },
    update: { password_hash, role, first_login: false, isActive: true },
    create: {
      nim,
      password_hash,
      role,
      first_login: false,
      isActive: true,
      profile: { create: { nama, nim, program_studi: 'TEKNIK SIPIL' } },
    },
    select: { id: true },
  });
  return akun.id;
}

/** Hapus akun uji beserta profilnya (urutan mengikuti foreign key). */
async function hapusAkun(id: string): Promise<void> {
  await prisma.studentProfile.deleteMany({ where: { userId: id } });
  await prisma.user.deleteMany({ where: { id } });
}

async function main(): Promise<void> {
  const akunUji: string[] = [];
  console.log(`\n=== VERIFIKASI AKSES DATA MAHASISWA (NON-ADMIN) ===\nAPI: ${API_URL}\n`);

  try {
    const idMahasiswa = await siapkanAkun(NIM_MAHASISWA, 'UJI Non-Admin Mahasiswa', Role.MAHASISWA);
    const idPengurus = await siapkanAkun(NIM_PENGURUS, 'UJI Non-Admin Pengurus', Role.PENGURUS_BEM);
    akunUji.push(idMahasiswa, idPengurus);

    // ── 1. Tanpa login ────────────────────────────────────────────────────
    console.log('Tanpa login:');
    periksa('GET /students tanpa sesi', (await minta('/students?limit=1')).status, 401);
    const eksporAnonim = await minta('/students/export');
    periksa('GET /students/export tanpa sesi', eksporAnonim.status, 401);
    periksa('Tidak ada isi CSV untuk tamu', eksporAnonim.body.includes('Program Studi'), false);

    // ── 2. Pengurus biasa ─────────────────────────────────────────────────
    console.log('\nPengurus biasa (PENGURUS_BEM):');
    const cookiePengurus = await login(NIM_PENGURUS, SANDI_UJI);
    periksa('GET /students', (await minta('/students?limit=1', { cookie: cookiePengurus })).status, 200);
    const eksporPengurus = await minta('/students/export', { cookie: cookiePengurus });
    periksa('GET /students/export', eksporPengurus.status, 403);
    periksa('Balasan ekspor menyebut Forbidden', eksporPengurus.body.includes('Forbidden'), true);
    periksa('Tidak ada isi CSV untuk pengurus', eksporPengurus.body.includes('Program Studi'), false);
    const rolePengurus = await minta(`/students/${idPengurus}/role`, {
      method: 'PATCH',
      cookie: cookiePengurus,
      body: { role: 'ADMIN' },
    });
    periksa('PATCH /students/:id/role (naikkan role)', rolePengurus.status, 403);

    // ── 3. Mahasiswa ──────────────────────────────────────────────────────
    console.log('\nMahasiswa (MAHASISWA):');
    const cookieMahasiswa = await login(NIM_MAHASISWA, SANDI_UJI);
    const daftarMahasiswa = await minta('/students?limit=1', { cookie: cookieMahasiswa });
    periksa('GET /students', daftarMahasiswa.status, 403);
    periksa('Balasan daftar menyebut pengurus/admin', daftarMahasiswa.body.includes('Hanya pengurus dan admin'), true);
    const eksporMahasiswa = await minta('/students/export', { cookie: cookieMahasiswa });
    periksa('GET /students/export', eksporMahasiswa.status, 403);
    periksa('Tidak ada isi CSV untuk mahasiswa', eksporMahasiswa.body.includes('Program Studi'), false);
    const roleMahasiswa = await minta(`/students/${idPengurus}/role`, {
      method: 'PATCH',
      cookie: cookieMahasiswa,
      body: { role: 'ADMIN' },
    });
    periksa('PATCH /students/:id/role (naikkan role)', roleMahasiswa.status, 403);

    // ── 4. Pembanding: admin (opsional) ───────────────────────────────────
    if (process.env.ADMIN_NIM && process.env.ADMIN_PASSWORD) {
      console.log('\nAdmin (pembanding):');
      const cookieAdmin = await login(process.env.ADMIN_NIM, process.env.ADMIN_PASSWORD);
      const eksporAdmin = await minta('/students/export', { cookie: cookieAdmin });
      periksa('GET /students/export', eksporAdmin.status, 200);
      periksa('Balasan berisi header CSV', eksporAdmin.body.startsWith('No,NIM,Nama'), true);
    } else {
      console.log('\nAdmin (pembanding): dilewati — setel ADMIN_NIM & ADMIN_PASSWORD untuk menguji.');
    }
  } finally {
    // Selalu bersihkan, walau pengujian gagal di tengah jalan.
    for (const id of akunUji) await hapusAkun(id);
    if (akunUji.length > 0) {
      console.log(`\nAkun uji dihapus kembali: ${NIM_MAHASISWA}, ${NIM_PENGURUS}`);
    }
  }

  console.log(
    jumlahGagal === 0
      ? '\nHASIL: SEMUA PEMERIKSAAN LULUS\n'
      : `\nHASIL: ${jumlahGagal} PEMERIKSAAN GAGAL\n`
  );
  if (jumlahGagal > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('\nERROR:', e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
