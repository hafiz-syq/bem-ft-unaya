/**
 * Unit test tanpa server & tanpa database.
 *
 * Tiga kelompok yang diuji:
 *   A. lib/ticket-access — aturan privasi tiket murni (siapa boleh baca apa).
 *   B. Guard peran di controller kritis — memastikan penolakan 403 terjadi di
 *      DALAM controller SEBELUM query apa pun ke database, sehingga bila ada
 *      yang menghapus guard, test ini gagal (prisma akan tersentuh / next
 *      dipanggil) tanpa perlu server berjalan.
 *   B2. Push perpanjangan studi — body layar kunci generik; email dan
 *       Notification in-app tetap membawa nama, NIM, dan tanggal.
 *   B3. Header Cache-Control — pasangan endpoint personal (tanpa header, boleh
 *       terbaca luring) dan endpoint admin (tetap no-store). Query disulih,
 *       jadi tetap tanpa DB.
 *   C. Peta MIME -> ekstensi untuk lampiran/arsip (celah stored XSS P0.2).
 *   D. Gerbang retensi (B2.7) — penghapusan tidak boleh jalan tanpa flag.
 *   E. Nomor tiket sesudah hard delete (B2.6) — MAX hari itu, bukan count.
 *   F. Turunan totalPages untuk paginasi arsip surat & tempat sampah.
 *   G. Validasi login, nama berkas lampiran, dan daftar host SSRF.
 *   H. Flag Secure cookie sesi (dipaksa saat VERCEL_ENV ada).
 *   I. Pemuat pdfjs di student-import.service — gagal muat tidak boleh
 *      melempar saat module load (seluruh /api ikut mati kalau ia melempar).
 *   J. Keputusan "host ini boleh ditulis?" — satu sumber kebenaran untuk penahan
 *      suite uji DAN jalur tulis non-tes (skrip src/scripts, prisma migrate / db push).
 *
 * Plafon AUDIT-13 (konversi WebP inside 3200 dan batas 2.000 halaman PDF impor)
 * diuji di berkas sendiri: uji-unit-plafon.ts, agar berkas ini tidak membengkak.
 *
 * Jalankan: npm run test:unit   (dari folder backend)
 */

import './penahan-host-uji';
import {
  ADMIN_ROLES,
  ASSIGNABLE_ROLES,
  OFFICER_ROLES,
  ROLE_TARGET,
  TICKET_TARGETS,
  TARGET_LABEL,
  bolehMemoderasiTiket,
  canAccessTicket,
  canExportKeluhan,
  isAdminRole,
  isOfficer,
  isTicketTarget,
  ticketVisibilityWhere,
} from '../lib/ticket-access';
import { createPositionSlot, assignPosition } from '../controllers/position.controller';
import { processRequest } from '../controllers/data-request.controller';
import { getAuditLogs } from '../controllers/audit.controller';
import { loginSchema } from '../controllers/auth.controller';
import { EKSTENSI_DOKUMEN, ekstensiDokumen } from '../middlewares/upload.middleware';
import { namaAman, simpanLampiran } from '../lib/lampiran';
import { hostTidakAman, unduh } from '../lib/http';
import { pangkasRetensi } from '../services/retensi.service';
import { nomorTiketBerikutnya, setTicketModeration } from '../controllers/ticket.controller';
import { batasHalaman } from '../lib/paginasi';
import { cookieHarusSecure } from '../lib/cookies';
import { NAMA_ENV_TULIS, NAMA_ENV_UJI, adalahHostLokal, adalahHostUrlLokal, optInDinyalakan, sembunyikanKredensial } from '../lib/penahan-host';
import { getNotifications } from '../controllers/notification.controller';
import prisma from '../lib/prisma';
import { konversiGambarKeWebp, UPLOAD_LIMITS } from '../middlewares/upload.middleware';
import sharp from 'sharp';
import { simpanGambarMedia } from '../lib/gambar-media';
import { simpanFotoProfil } from '../lib/foto-profil';
import { requireAdmin } from '../controllers/student.controller';
import mahasiswaRouter from '../routes/student.routes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let lulus = 0;
const gagal: string[] = [];

function uji(nama: string, kondisi: boolean): void {
  if (kondisi) {
    lulus++;
    console.log(`  LULUS   ${nama}`);
  } else {
    gagal.push(nama);
    console.log(`  GAGAL   ${nama}`);
  }
}

/** Res palsu sederhana yang mencatat status, header & payload terakhir. */
function resPalsu(): {
  code: number | null;
  payload: unknown;
  header: Record<string, string>;
  status: (c: number) => unknown;
  json: (p: unknown) => unknown;
  setHeader: (k: string, v: string) => unknown;
} {
  const res = {
    code: null as number | null,
    payload: null as unknown,
    header: {} as Record<string, string>,
    status(c: number) { res.code = c; return res; },
    json(p: unknown) { res.payload = p; return res; },
    setHeader(k: string, v: string) { res.header[k.toLowerCase()] = v; return res; },
  };
  return res;
}

async function main(): Promise<void> {
  console.log('\n=== A. lib/ticket-access (aturan privasi murni) ===\n');

  uji('isAdminRole: ADMIN & SUPERADMIN benar', isAdminRole('ADMIN') && isAdminRole('SUPERADMIN'));
  uji('isAdminRole: MAHASISWA/PENGURUS/tamu salah', !isAdminRole('MAHASISWA') && !isAdminRole('PENGURUS') && !isAdminRole(null) && !isAdminRole(undefined));
  uji('ADMIN_ROLES persis [ADMIN, SUPERADMIN]', ADMIN_ROLES.length === 2 && ADMIN_ROLES.includes('ADMIN') && ADMIN_ROLES.includes('SUPERADMIN'));

  uji('isOfficer: semua OFFICER_ROLES benar', OFFICER_ROLES.every((r) => isOfficer(r)));
  uji('isOfficer: MAHASISWA/ADMIN salah', !isOfficer('MAHASISWA') && !isOfficer('ADMIN'));
  uji('setiap role di ROLE_TARGET termasuk OFFICER_ROLES', Object.keys(ROLE_TARGET).every((r) => OFFICER_ROLES.includes(r)));

  uji('canExportKeluhan: ADMIN & SUPERADMIN & PENGURUS_DPM benar', canExportKeluhan('ADMIN') && canExportKeluhan('SUPERADMIN') && canExportKeluhan('PENGURUS_DPM'));
  uji('canExportKeluhan: PENGURUS_BEM, PENGURUS, MAHASISWA salah', !canExportKeluhan('PENGURUS_BEM') && !canExportKeluhan('PENGURUS') && !canExportKeluhan('MAHASISWA'));

  uji('isTicketTarget menerima seluruh TICKET_TARGETS', TICKET_TARGETS.every((t) => isTicketTarget(t)));
  uji('isTicketTarget menolak nilai asing/bukan string', !isTicketTarget('bem') && !isTicketTarget('KABAR') && !isTicketTarget(42) && !isTicketTarget(null));
  uji('TARGET_LABEL melabeli seluruh TICKET_TARGETS', TICKET_TARGETS.every((t) => typeof TARGET_LABEL[t] === 'string' && TARGET_LABEL[t].length > 0));
  uji('ASSIGNABLE_ROLES = MAHASISWA + OFFICER + ADMIN', ASSIGNABLE_ROLES.includes('MAHASISWA') && ASSIGNABLE_ROLES.includes('ADMIN') && OFFICER_ROLES.every((r) => ASSIGNABLE_ROLES.includes(r)));

  // ticketVisibilityWhere
  const whereAdmin = ticketVisibilityWhere({ id: 'u1', role: 'ADMIN' });
  const wherePengurusLama = ticketVisibilityWhere({ id: 'u1', role: 'PENGURUS' });
  const whereMhs = ticketVisibilityWhere({ id: 'u1', role: 'MAHASISWA' });
  const whereDpm = ticketVisibilityWhere({ id: 'u1', role: 'PENGURUS_DPM' }) as { OR: Record<string, unknown>[] };
  const whereBem = ticketVisibilityWhere({ id: 'u1', role: 'PENGURUS_BEM' }) as { OR: Record<string, unknown>[] };
  const whereHimpunan = ticketVisibilityWhere({ id: 'u1', role: 'PENGURUS_TEKNIK_MESIN' }) as { OR: Record<string, unknown>[] };

  uji('visibility: ADMIN & PENGURUS lama melihat semua (where kosong)', Object.keys(whereAdmin).length === 0 && Object.keys(wherePengurusLama).length === 0);
  uji('visibility: MAHASISWA dibatasi senderId miliknya', (whereMhs as { senderId?: string }).senderId === 'u1');
  uji('visibility: PENGURUS_DPM OR = [ditugaskan, KELUHAN]', whereDpm.OR.length === 2 && JSON.stringify(whereDpm.OR[1]).includes('KELUHAN'));
  uji('visibility: PENGURUS_BEM OR = [ditugaskan, ASPIRASI]', whereBem.OR.length === 2 && JSON.stringify(whereBem.OR[1]).includes('ASPIRASI'));
  uji('visibility: pengurus himpunan OR = [ditugaskan, organisasinya]', whereHimpunan.OR.length === 2 && JSON.stringify(whereHimpunan.OR[1]).includes('TEKNIK_MESIN'));

  // canAccessTicket
  const tiketKeluhan = { type: 'KELUHAN', targetOrganization: 'DPM', senderId: 'u1' };
  const tiketAspirasi = { type: 'ASPIRASI', targetOrganization: 'BEM', senderId: 'u1' };
  const ditugaskan = { ...tiketKeluhan, assignments: [{ assigneeId: 'u2', isActive: true }] };
  const ditugaskanNonaktif = { ...tiketKeluhan, assignments: [{ assigneeId: 'u2', isActive: false }] };

  uji('akses: admin selalu bisa', canAccessTicket({ id: 'a', role: 'ADMIN' }, tiketKeluhan));
  uji('akses: mahasiswa hanya tiket miliknya', canAccessTicket({ id: 'u1', role: 'MAHASISWA' }, tiketKeluhan) && !canAccessTicket({ id: 'u9', role: 'MAHASISWA' }, tiketKeluhan));
  uji('akses: penugasan aktif membuka tiket; nonaktif tidak', canAccessTicket({ id: 'u2', role: 'PENGURUS_TEKNIK_MESIN' }, ditugaskan) && !canAccessTicket({ id: 'u2', role: 'PENGURUS_TEKNIK_MESIN' }, ditugaskanNonaktif));
  uji('akses: DPM baca keluhan, bukan aspirasi', canAccessTicket({ id: 'x', role: 'PENGURUS_DPM' }, tiketKeluhan) && !canAccessTicket({ id: 'x', role: 'PENGURUS_DPM' }, tiketAspirasi));
  uji('akses: BEM baca aspirasi, bukan keluhan', canAccessTicket({ id: 'x', role: 'PENGURUS_BEM' }, tiketAspirasi) && !canAccessTicket({ id: 'x', role: 'PENGURUS_BEM' }, tiketKeluhan));
  uji('akses: himpunan baca tiket ke organisasinya saja', canAccessTicket({ id: 'x', role: 'PENGURUS_TEKNIK_MESIN' }, { type: 'ASPIRASI', targetOrganization: 'TEKNIK_MESIN', senderId: 'u1' }) && !canAccessTicket({ id: 'x', role: 'PENGURUS_TEKNIK_MESIN' }, { type: 'ASPIRASI', targetOrganization: 'BEM', senderId: 'u1' }));

  // bolehMemoderasiTiket: hak TULIS (status + moderatedById) lebih ketat dari hak BACA.
  const tiketUntukModerasi = { ...tiketKeluhan, assignments: [] as { assigneeId: string; isActive: boolean }[] };
  uji('moderasi: admin selalu boleh', bolehMemoderasiTiket({ id: 'a', role: 'ADMIN' }, tiketUntukModerasi));
  uji('moderasi: penulis ditolak walau berhak membaca tiketnya',
    canAccessTicket({ id: 'u1', role: 'MAHASISWA' }, tiketUntukModerasi) &&
    !bolehMemoderasiTiket({ id: 'u1', role: 'MAHASISWA' }, tiketUntukModerasi));
  uji('moderasi: pengurus harus punya penugasan aktif',
    bolehMemoderasiTiket({ id: 'u2', role: 'PENGURUS_BEM' }, { ...tiketKeluhan, assignments: [{ assigneeId: 'u2', isActive: true }] }) &&
    !bolehMemoderasiTiket({ id: 'u2', role: 'PENGURUS_BEM' }, { ...tiketKeluhan, assignments: [{ assigneeId: 'u2', isActive: false }] }));
  uji('moderasi: pengurus tanpa penugasan ditolak meski boleh membaca',
    !bolehMemoderasiTiket({ id: 'u9', role: 'PENGURUS_BEM' }, { ...tiketKeluhan, assignments: [{ assigneeId: 'u2', isActive: true }] }));

  console.log('\n=== B. Guard peran di controller kritis (tolak SEBELUM query DB) ===\n');

  // Semua kasus di bawah memakai role NON-admin. Bila guard dihapus, controller
  // akan melanjutkan ke query prisma (tersentuh DB / memanggil next(error)),
  // sehingga assertions di sini gagal.
  const nonAdmin = { id: 'u-uji', role: 'MAHASISWA' };

  {
    const res = resPalsu();
    let nextDipanggil = false;
    await createPositionSlot({ user: nonAdmin, body: { organizationId: 'o', title: 'Jabatan' } }, res as never, (() => { nextDipanggil = true; }) as never);
    uji('createPositionSlot: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
  }

  {
    const res = resPalsu();
    let nextDipanggil = false;
    await assignPosition({ user: nonAdmin, body: { positionSlotId: 's', nim: '22140001' } }, res as never, (() => { nextDipanggil = true; }) as never);
    uji('assignPosition: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
  }

  {
    const res = resPalsu();
    let nextDipanggil = false;
    await processRequest({ user: nonAdmin, params: { id: 'x' }, body: { status: 'APPROVED' } }, res as never, (() => { nextDipanggil = true; }) as never);
    uji('processRequest: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
  }

  {
    const res = resPalsu();
    let nextDipanggil = false;
    await getAuditLogs({ user: nonAdmin, query: {} }, res as never, (() => { nextDipanggil = true; }) as never);
    uji('getAuditLogs: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
    uji('getAuditLogs: Cache-Control no-store ikut terpasang', res.header['cache-control'] === 'no-store');
  }

  {
    const res = resPalsu();
    let nextDipanggil = false;
    await getAuditLogs({ user: { id: 'u-uji', role: 'PENGURUS_BEM' }, query: {} }, res as never, (() => { nextDipanggil = true; }) as never);
    uji('getAuditLogs: PENGURUS ditolak 403 (khusus admin)', res.code === 403 && !nextDipanggil);
  }

  console.log('\n=== B2. Push perpanjangan studi: layar kunci generik, detail tetap di email & Notification ===\n');

  {
    const sumber = readFileSync(resolve(__dirname, '../lib/notifikasi-perpanjangan.helper.ts'), 'utf8');
    const potongPush = sumber.slice(sumber.indexOf('kirimPushKeBanyak'), sumber.indexOf('url:'));
    uji('push perpanjangan: body tidak lagi memakai `message`', !potongPush.includes('body: message'));
    uji('push perpanjangan: body generik tanpa nama/NIM/tanggal', potongPush.includes("body: 'Ada peringatan perpanjangan masa studi."));
    uji('Notification in-app masih menyimpan `message` lengkap', /pesan\.push\(message\)/.test(sumber) && /\n\s+message,\n/.test(sumber));
    uji('email masih dipakai jalur nama + NIM + tanggal', sumber.includes('student.profile.email,') && sumber.includes('student.nim,'));
  }

  console.log('\n=== B3. Cache-Control: endpoint personal boleh luring, endpoint admin tetap no-store ===\n');

  {
    // Delegasi disulih supaya blok ini tetap "tanpa DB" seperti seluruh suite.
    const delegateAsli = prisma.notification;
    Object.defineProperty(prisma, 'notification', {
      value: { findMany: async () => [] },
      configurable: true,
      writable: true,
    });
    const res = resPalsu();
    let nextDipanggil = false;
    await getNotifications({ user: { id: 'u-uji' } }, res as never, (() => { nextDipanggil = true; }) as never);
    Object.defineProperty(prisma, 'notification', { value: delegateAsli, configurable: true, writable: true });
    uji('getNotifications: 200 tanpa memanggil next (query tersulih, bukan DB)', res.code === 200 && !nextDipanggil);
    uji('getNotifications: TIDAK mengirim header Cache-Control', res.header['cache-control'] === undefined);
  }

  {
    // Serangan IRISAN A: penulis memublikasikan sekaligus menutup tiketnya sendiri.
    const res = resPalsu();
    let nextDipanggil = false;
    await setTicketModeration(
      { user: nonAdmin, params: { id: 'tiket-uji' }, body: { moderationStatus: 'PUBLISHED', status: 'SELESAI' } },
      res as never,
      (() => { nextDipanggil = true; }) as never
    );
    uji('setTicketModeration: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
  }

  console.log('\n=== C. Ekstensi lampiran diturunkan dari MIME, bukan nama berkas ===\n');

  uji(
    'setiap MIME yang diizinkan punya ekstensi kanoniknya sendiri',
    ['application/pdf|.pdf', 'application/msword|.doc',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document|.docx',
     'application/vnd.ms-excel|.xls',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|.xlsx',
     'application/vnd.ms-powerpoint|.ppt',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation|.pptx',
    ].every((pasang) => {
      const [mime, ekstensi] = pasang.split('|');
      return EKSTENSI_DOKUMEN[mime] === ekstensi && ekstensiDokumen(mime) === ekstensi;
    })
  );
  uji('MIME asing dipaksa .pdf, tidak pernah ikut nama berkas', ekstensiDokumen('text/html') === '.pdf' && ekstensiDokumen(undefined) === '.pdf');
  uji('parameter MIME diabaikan saat memetakan ekstensi', ekstensiDokumen('application/pdf; charset=binary') === '.pdf');
  uji('peta tidak memuat ekstensi yang bisa dieksekusi browser', !Object.values(EKSTENSI_DOKUMEN).some((e) => ['.html', '.htm', '.svg', '.xhtml', '.js'].includes(e)));

  // --- D. Gerbang retensi ------------------------------------------------
  // Sengaja hanya sisi "mati": membuka gerbang di sini akan benar-benar
  // menghapus baris di DATABASE_URL milik siapa pun yang menjalankan tes.
  const envRetensi = process.env.RETENSI_AKTIF;
  delete process.env.RETENSI_AKTIF;
  const retensiLepas = await pangkasRetensi();
  uji(
    'retensi: flag lepas => aktif=false dan semua hitungan nol',
    retensiLepas.aktif === false &&
      [
        retensiLepas.notifikasi,
        retensiLepas.auditLog,
        retensiLepas.errorLog,
        retensiLepas.pesanChat,
        retensiLepas.jejakTamu,
      ].every((n) => n === 0)
  );
  process.env.RETENSI_AKTIF = '0';
  uji('retensi: "0" tidak membuka gerbang', (await pangkasRetensi()).aktif === false);
  process.env.RETENSI_AKTIF = 'true';
  uji('retensi: hanya "1" yang membuka gerbang', (await pangkasRetensi()).aktif === false);
  if (envRetensi === undefined) delete process.env.RETENSI_AKTIF;
  else process.env.RETENSI_AKTIF = envRetensi;

  // --- E. Nomor tiket sesudah hard delete ---------------------------------
  // Baris 0001/0002/0004 hari ini (0003 sudah dihapus): maksimum = 4, jadi nomor
  // berikutnya 0005. Rumus lama memakai count = 3 dan menghasilkan 0004 yang sudah
  // dipakai -> P2002 -> 409 untuk semua pengguna sampai lewat tengah malam UTC.
  // Stub menggantikan $queryRaw supaya tes ini tetap tanpa database (job "statis"
  // CI tidak punya service MySQL).
  const stubTx = { $queryRaw: async () => [{ n: 4n }] } as never;
  uji(
    'nomor tiket: 0001/0002/0004 hari ini -> 0005, bukan 0004',
    (await nomorTiketBerikutnya(stubTx, '20261103')) === 'TKT-20261103-0005'
  );

  // --- F. Halaman arsip & tempat sampah (Item 5) ---------------------------
  // Paginasi keduanya aditif; yang rawan salah hitung cuma turunan totalPages.
  uji(
    'totalPages: 0/20 -> 0, 200/20 -> 10, 201/20 -> 11',
    batasHalaman(0, 20) === 0 && batasHalaman(200, 20) === 10 && batasHalaman(201, 20) === 11
  );

  // --- G. Validasi login, nama berkas lampiran, daftar host SSRF -----------
  uji(
    'loginSchema: NIM/password kosong dan non-string ditolak',
    !loginSchema.safeParse({}).success &&
      !loginSchema.safeParse({ nim: '  ', password: 'x' }).success &&
      !loginSchema.safeParse({ nim: { $gt: '' }, password: 'x' }).success
  );
  uji(
    'loginSchema: NIM 21 karakter / password 201 karakter ditolak, yang wajar diterima',
    !loginSchema.safeParse({ nim: '1'.repeat(21), password: 'x' }).success &&
      !loginSchema.safeParse({ nim: '22140001', password: 'x'.repeat(201) }).success &&
      loginSchema.safeParse({ nim: '22140001', password: 'Rahasia123' }).success
  );

  uji(
    'namaAman: nama baik dipertahankan, traversal & pemisah jalur diganti',
    namaAman('berkas-2026.v2') === 'berkas-2026.v2' &&
      namaAman('../../bem-ft-unaya/x') === 'lampiran' &&
      namaAman('a/b') === 'lampiran' &&
      namaAman('..') === 'lampiran' &&
      namaAman('') === 'lampiran'
  );

  uji(
    'hostTidakAman menutup rentang yang daftar lama image-convert lewatkan',
    hostTidakAman('169.254.169.254') && hostTidakAman('100.64.0.1') && hostTidakAman('172.20.0.1') &&
      !hostTidakAman('8.8.8.8') && !hostTidakAman('res.cloudinary.com')
  );

  // Bentuk desimal (2130706433) dan pendek (127.1) bukan dotted-quad, jadi
  // pemeriksaan literal saja meloloskannya. Yang menahan adalah resolusi +
  // pemeriksaan setiap jawaban; kalau resolver menolak bentuk itu sejak awal
  // (EBADNAME) hasilnya tetap penolakan, jadi kedua pesan sama-sama sah.
  {
    let alasan: string | null = null;
    try {
      await unduh('http://2130706433/', { timeout: 3000 });
    } catch (error) {
      alasan = (error as Error).message;
    }
    uji(
      'unduh: bentuk IP non-dotted-quad menuju loopback ditolak sebelum fetch',
      alasan !== null && /internal\/private|tidak dapat di-resolve/.test(alasan)
    );
  }

  // --- H. Flag Secure pada cookie sesi --------------------------------------
  {
    const reqPalsu = (secure: boolean, forwarded?: string) =>
      ({ secure, get: () => forwarded }) as never;
    const VERCEL_ENV = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV;
    const httpPolos = !cookieHarusSecure(reqPalsu(false));
    const headerHttps = cookieHarusSecure(reqPalsu(false, 'https'));
    const tlsLangsung = cookieHarusSecure(reqPalsu(true));
    process.env.VERCEL_ENV = 'production';
    const dipaksaDiVercel = cookieHarusSecure(reqPalsu(false));
    if (VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = VERCEL_ENV;
    uji(
      'cookieHarusSecure: ikut protokol di luar Vercel, dipaksa aman selama VERCEL_ENV ada',
      httpPolos && headerHttps && tlsLangsung && dipaksaDiVercel
    );
  }

  // --- I. Pemuat pdfjs tidak boleh melempar saat module load ----------------
  {
    // Risiko yang dijaga: sejak 4.x kedua build pdfjs adalah `.mjs`, dan
    // `require()` ESM hanya sinkron pada Node >=20.19 / >=22.12. Kalau runtime
    // (mis. Vercel, yang versinya tidak dipinjam di vercel.json) lebih tua,
    // KEDUA cabang muatPdfJs() gagal. Service ini ikut ter-impor rantai rute,
    // jadi satu lemparan di top-level module akan mematikan SELURUH /api.
    // Loader sekarang menahan kegagalan itu, dan yang gagal hanya fiturnya.
    const Modul = require('module') as { _load: (...a: unknown[]) => unknown };
    const muatAsli = Modul._load;
    const jalurLayanan = require.resolve('../services/student-import.service');
    delete require.cache[jalurLayanan];
    delete require.cache[require.resolve('../lib/prisma')];

    let tahan: unknown = null;
    let pesanSaatDipakai: string | null = null;
    try {
      Modul._load = function (permintaan: unknown, ...lainnya: unknown[]) {
        if (typeof permintaan === 'string' && permintaan.startsWith('pdfjs-dist/')) {
          throw Object.assign(new Error('require() of ES Module is not supported'), {
            code: 'ERR_REQUIRE_ESM',
          });
        }
        return muatAsli.call(Modul, permintaan, ...lainnya);
      };
      tahan = require('../services/student-import.service');
    } catch {
      tahan = null; // modul load melempar -> persis yang tidak boleh terjadi
    } finally {
      Modul._load = muatAsli;
    }

    const layanan = tahan as { parsingPdfMahasiswa?: (b: Buffer) => Promise<unknown> } | null;
    if (layanan && typeof layanan.parsingPdfMahasiswa === 'function') {
      try {
        await layanan.parsingPdfMahasiswa(Buffer.from('%PDF-1.4\n%%EOF\n'));
      } catch (error) {
        pesanSaatDipakai = (error as Error).message;
      }
    }
    delete require.cache[jalurLayanan];

    uji(
      'student-import.service: loader pdfjs yang gagal TOTAL tidak melempar saat module load, dan baru gagal saat fiturnya dipakai',
      layanan !== null &&
        typeof layanan.parsingPdfMahasiswa === 'function' &&
        pesanSaatDipakai !== null &&
        /pdfjs-dist/.test(pesanSaatDipakai)
    );
  }

  console.log('\n=== J. Keputusan host boleh ditulis (satu sumber kebenaran) ===\n');

  uji('J1 DATABASE_URL kosong dianggap boleh (job statis CI jalan tanpa basis data)', adalahHostLokal(''));

  uji(
    'J2 host mesin ini diterima: localhost, 127.0.0.1, [::1], ::1, dan tanpa port',
    adalahHostLokal('mysql://root@localhost:3306/bem_ft_uji') &&
      adalahHostLokal('mysql://root@127.0.0.1:3306/bem_ft_uji') &&
      adalahHostLokal('mysql://root@[::1]:3306/bem_ft_uji') &&
      adalahHostLokal('mysql://root@::1:3306/bem_ft_uji') &&
      adalahHostLokal('mysql://root@127.0.0.1/bem_ft_uji')
  );

  uji(
    'J3 host jauh ditolak (aivencloud & contoh jauh)',
    !adalahHostLokal('mysql://avnadmin@db.i.aivencloud.com:14316/defaultdb') &&
      !adalahHostLokal('mysql://avnadmin@jauh-sekali.example.com:14316/defaultdb')
  );

  uji(
    'J4 userinfo/hostname mirip tidak menyulundupkan verdict lokal (gagal tertutup)',
    !adalahHostLokal('mysql://root@127.0.0.1@jauh-sekali.example.com:14316/defaultdb') &&
      !adalahHostLokal('mysql://root@meniru-127.0.0.1.example.com:14316/defaultdb')
  );

  uji(
    'J5 opt-in hanya nilai "1"; 0/kosong/undefined/bukan-angka tidak membuka',
    optInDinyalakan('1') &&
      optInDinyalakan(' 1 ') &&
      !optInDinyalakan('0') &&
      !optInDinyalakan('true') &&
      !optInDinyalakan('') &&
      !optInDinyalakan(undefined)
  );

  uji(
    'J6 pesan galat menyensor kredensial sebelum ditampilkan',
    (() => {
      const tersensor = sembunyikanKredensial('mysql://pengguna:sandi-uji@jauh-sekali.example.com:14316/defaultdb');
      return !tersensor.includes('sandi-uji') && tersensor.includes('***@');
    })()
  );

  uji(
    'J7 nama opt-in suite uji dan jalur tulis berbeda (UJI_BOLEH_PRODUKSI tidak membuka skrip tulis)',
    NAMA_ENV_UJI === 'UJI_BOLEH_PRODUKSI' && NAMA_ENV_TULIS === 'TULIS_BOLEH_JAUH'
  );

  // AUDIT-16 K1: keputusan host untuk sisi HTTP (API_URL). Pure function atas
  // string — tidak menyentuh server mana pun.
  uji(
    'J8 hostname API_URL: localhost/127.0.0.1/[::1] lolos; host jauh, mirip, dan URL rusak ditolak',
    adalahHostUrlLokal('http://localhost:3000/api') &&
      adalahHostUrlLokal('http://127.0.0.1:3411/api') &&
      adalahHostUrlLokal('http://[::1]:3000/api') &&
      adalahHostUrlLokal('http://localhost/api') &&
      !adalahHostUrlLokal('https://api.bem-ft-unaya.example.com/api') &&
      !adalahHostUrlLokal('http://localhost.meniru.example.com/api') &&
      !adalahHostUrlLokal('http://127.0.0.1.meniru.example.com/api') &&
      !adalahHostUrlLokal('bukan-url') &&
      // kontrol bahwa regex userinfo TIDAK dipakai untuk URL http: bentuk ini
      // lolos di fungsi baru, padahal adalahHostLokal memberinya false.
      !adalahHostLokal('http://localhost:3000/api')
  );

  console.log('\n=== C1. Laporan komentar ber-login punya limiter per pengguna ===\n');

  {
    // Rantainya yang diuji, bukan perilaku express-rate-limit (sudah terbukti
    // HTTP: laporan ke-11 dibalas 429 di staging). Dua assert sumber ini jatuh
    // kalau limiter itu dilepas atau berkuncinya dipindah kembali ke IP.
    const sumber = readFileSync(resolve(__dirname, '../routes/public-comment.routes.ts'), 'utf8');
    uji(
      'POST /:commentId/report memakai limiter setelah requireAuth dan sebelum controller',
      /router\.post\('\/:commentId\/report',\s*requireAuth,\s*batasLaporanLogin,\s*reportComment\)/.test(sumber)
    );
    uji(
      'limiter laporan login berkunci id pengguna, bukan IP kampus yang dibagi bersama',
      /batasLaporanLogin[\s\S]{0,400}keyGenerator: \(req: any\) => req\.user\?\.id \|\| ipKeyGenerator\(req\.ip\)/.test(sumber)
    );
  }

  console.log('\n=== D3. Batas ukuran punya angka untuk semua field unggahan ===\n');

  {
    // Perilaku aslinya terbukti lewat HTTP di staging (6 kasus: images, file,
    // foto, tiket, dokumen, impor). Assert sumber ini menjaga agar kunci
    // "images" tidak dilepas lagi sehingga pesan kembali tanpa angka.
    const sumber = readFileSync(resolve(__dirname, '../app.ts'), 'utf8');
    uji(
      'field "images" dipetakan ke kunci UPLOAD_LIMITS yang benar',
      /const kunciBatas = err\.field === 'images' \? 'file' : err\.field;[\s\S]{0,220}\[kunciBatas\]/.test(sumber)
    );
    uji(
      'setiap nama field multer di routes punya kunci batas',
      (() => {
        const batasSrc = readFileSync(resolve(__dirname, '../middlewares/upload.middleware.ts'), 'utf8');
        const kunci = new Set(
          (batasSrc.match(/^\s{2}(\w+): \d+ \* 1024 \* 1024/mg) || []).map((s) => s.trim().split(':')[0])
        );
        // "dokumen" & "pdfImpor" dibaca lewat cabang URL, "images" lewat kunciBatas.
        const field = ['foto', 'file', 'images'];
        const adaLangsung = field.filter((f) => kunci.has(f));
        return adaLangsung.includes('foto') && adaLangsung.includes('file') && sumber.includes("'images' ? 'file'");
      })()
    );
  }

  console.log('\n=== D2. Penyebab galat sharp tercatat, teks klien tetap ===\n');

  {
    // Perilaku sungguhan: konversi dijalankan tanpa DB & tanpa Cloudinary.
    const req = {
      files: {
        file: [
          {
            buffer: Buffer.from('ini sama sekali bukan gambar\n'.repeat(10)),
            mimetype: 'image/png',
            originalname: 'uji-d2.png',
            fieldname: 'file',
            size: 290,
          },
        ],
      },
    };

    const catatanLog: string[] = [];
    const consoleErrorAsli = console.error;
    console.error = (...argumen: unknown[]) => catatanLog.push(argumen.map(String).join(' '));
    const galat: any = await new Promise((selesai) =>
      konversiGambarKeWebp(req as any, {} as any, selesai as any)
    );
    console.error = consoleErrorAsli;

    uji(
      'konversi gagal dibalas 400 dengan kalimat lama yang tidak berubah',
      galat?.statusCode === 400 &&
        /Gambar "uji-d2\.png" tidak dapat diproses\. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain \(bukan SVG\)\./.test(String(galat?.message))
    );
    uji(
      'penyebab asli sharp tetap sampai ke log server (tidak lagi dibuang)',
      catatanLog.some((s) => s.includes('[webp]') && /unsupported image format|exceeds pixel limit/i.test(s))
    );
  }

  console.log('\n=== D1. Artefak hasil konversi tidak boleh melebihi batas jalur ===\n');

  {
    // Perilaku sungguhan, tanpa DB & tanpa Cloudinary.
    // Bahan: kotak-catur 4000x3000 (12 MP). PNG-nya hanya ~185 KB, tetapi
    // WebP q82 hasil konversi terukur ~3,94 MB sejak plafon 3200 (penurunan
    // 4000->3200 pada pola kaku memunculkan moire) — tetap lebih besar dari
    // UPLOAD_LIMITS.foto (2 MB). Rasio ekspansi ditentukan pemakai, jadi yang
    // ditahan adalah ukuran hasil konversi, bukan hanya berkas yang masuk.
    const lebar = 4000;
    const tinggi = 3000;
    const blok = (warna: number) => Buffer.alloc(6, warna); // 2 piksel satu warna
    const baris = (mulaiPutih: boolean) => {
      const bagian: Buffer[] = [];
      for (let x = 0; x < lebar / 4; x++) {
        bagian.push(blok(mulaiPutih ? 255 : 0), blok(mulaiPutih ? 0 : 255));
      }
      return Buffer.concat(bagian);
    };
    const barisA = baris(true);
    const barisB = baris(false);
    const kotakPng = await sharp(
      Buffer.concat(Array.from({ length: tinggi }, (_, y) => (y % 4 < 2 ? barisA : barisB))),
      { raw: { width: lebar, height: tinggi, channels: 3 } }
    )
      .png()
      .toBuffer();

    const berkas = {
      buffer: kotakPng,
      mimetype: 'image/png',
      originalname: 'uji-d1.png',
      fieldname: 'foto',
      size: kotakPng.length,
    };
    const galat: any = await new Promise((selesai) =>
      konversiGambarKeWebp({ files: { foto: [berkas] } } as any, {} as any, selesai as any, UPLOAD_LIMITS.foto)
    );

    uji(
      'artefak WebP di atas batas jalur ditolak dengan galat multer yang sudah ada',
      galat?.name === 'MulterError' && galat?.code === 'LIMIT_FILE_SIZE' && galat?.field === 'foto'
    );
    uji(
      'berkas yang ditolak tidak diganti, jadi artefak besarnya tidak sampai ke Cloudinary',
      berkas.mimetype === 'image/png' && berkas.buffer.equals(kotakPng)
    );

    // Kontrol: gambar wajar tetap lolos dan memang berubah menjadi WebP.
    const gradasi = Buffer.alloc(1200 * 800 * 3);
    for (let y = 0; y < 800; y++) {
      for (let x = 0; x < 1200; x++) {
        const i = (y * 1200 + x) * 3;
        gradasi[i] = Math.round((x * 255) / 1199);
        gradasi[i + 1] = Math.round((y * 255) / 799);
        gradasi[i + 2] = Math.round(((x + y) * 255) / 1999);
      }
    }
    const fotoJpg = await sharp(gradasi, { raw: { width: 1200, height: 800, channels: 3 } })
      .jpeg({ quality: 80 })
      .toBuffer();
    const foto = {
      buffer: fotoJpg,
      mimetype: 'image/jpeg',
      originalname: 'uji-d1-foto.jpg',
      fieldname: 'foto',
      size: fotoJpg.length,
    };
    const hasilFoto: any = await new Promise((selesai) =>
      konversiGambarKeWebp({ files: { foto: [foto] } } as any, {} as any, selesai as any, UPLOAD_LIMITS.foto)
    );

    uji(
      'gambar wajar tetap lolos dan hasilnya WebP di bawah batas',
      hasilFoto === undefined &&
        foto.mimetype === 'image/webp' &&
        foto.size <= UPLOAD_LIMITS.foto
    );
  }

  console.log('\n=== E1. Penyebab galat sharp tercatat di SEMUA situs konversi gambar ===\n');

  {
    // Empat situs menyimpan gambar dengan pola try/catch yang sama. Middleware
    // sudah ditutup di D2; tiga sisanya (galeri/cover, lampiran, foto profil)
    // membuang penyebab asli sharp dan melempar galat ber-status 400, jadi
    // cabang pencatatan app.ts (hanya untuk >=500) tidak pernah menyentuhnya.
    // Semua dipanggil langsung tanpa DB & tanpa Cloudinary: kegagalan terjadi
    // sebelum jalur unggah/disk.
    const PESAN_LAMA =
      'Gambar "uji-e1.png" tidak dapat diproses. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).';
    const bahanRusak = Buffer.from('ini sama sekali bukan gambar\n'.repeat(10));
    const situs: { nama: string; label: string; jalan: () => Promise<unknown> }[] = [
      {
        nama: 'lib/gambar-media.ts (galeri & cover CMS)',
        label: '[webp]',
        jalan: () =>
          simpanGambarMedia({
            buffer: bahanRusak,
            mimetype: 'image/png',
            originalname: 'uji-e1.png',
          } as any),
      },
      {
        nama: 'lib/lampiran.ts (lampiran tiket & arsip dokumen)',
        label: '[webp]',
        jalan: () =>
          simpanLampiran({
            buffer: bahanRusak,
            mimetype: 'image/png',
            originalname: 'uji-e1.png',
          } as any),
      },
      {
        nama: 'lib/foto-profil.ts (foto profil, jalur AVIF)',
        label: '[avif]',
        jalan: () =>
          simpanFotoProfil({
            buffer: bahanRusak,
            originalname: 'uji-e1.png',
          }),
      },
    ];

    const consoleErrorAsli = console.error;
    for (const situsItem of situs) {
      const catatanLog: string[] = [];
      console.error = (...argumen: unknown[]) => catatanLog.push(argumen.map(String).join(' '));
      let galat: any;
      try {
        await situsItem.jalan();
      } catch (e) {
        galat = e;
      }
      console.error = consoleErrorAsli;

      uji(
        `${situsItem.nama}: teks klien byte-identik dengan kalimat lama dan tetap 400`,
        galat?.message === PESAN_LAMA && galat?.statusCode === 400
      );
      uji(
        `${situsItem.nama}: penyebab asli sharp sampai ke log server`,
        catatanLog.some(
          (s) => s.includes(situsItem.label) && /unsupported image format|exceeds pixel limit/i.test(s)
        )
      );
    }
  }

  console.log('\n=== M. Pengelolaan akun mahasiswa khusus admin (AUDIT-14 I1) ===\n');

  const layerStatus = (mahasiswaRouter as any).stack?.find(
    (l: any) => l.route?.path === '/:id/status' && l.route?.methods?.patch
  );
  const tumpukanStatus: any[] = layerStatus?.route?.stack ?? [];

  uji(
    'M1 tumpukan rute PATCH /:id/status memuat requireAdmin sebagai fungsi middleware (bukan hanya teks sumber)',
    tumpukanStatus.some((h) => h.handle === requireAdmin)
  );

  uji(
    'M2 handler terakhir PATCH /:id/status tetap updateStudentStatus, jadi perbaikannya hanya di tumpukan',
    tumpukanStatus.length > 0 &&
      tumpukanStatus[tumpukanStatus.length - 1]?.handle?.name === 'updateStudentStatus'
  );

  const cobaRequireAdmin = (role: string) => {
    let kode: number | undefined;
    let diteruskan = false;
    requireAdmin(
      { user: { role } } as any,
      { status: (c: number) => { kode = c; return { json: () => undefined }; } } as any,
      () => { diteruskan = true; }
    );
    return { kode, diteruskan };
  };

  const pengurus = cobaRequireAdmin('PENGURUS_TEKNIK_SIPIL');
  uji(
    'M3 requireAdmin menolak pengurus prodi lain dengan 403 tanpa memanggil next()',
    pengurus.kode === 403 && !pengurus.diteruskan
  );

  const admin = cobaRequireAdmin('ADMIN');
  uji(
    'M4 requireAdmin meloloskan ADMIN ke next() tanpa menyentuh res.status',
    admin.diteruskan && admin.kode === undefined
  );

  console.log(`\n--- RINGKASAN UNIT TEST ---\nLulus: ${lulus}\nGagal: ${gagal.length}\n`);
  if (gagal.length > 0) {
    console.log('GAGAL:');
    gagal.forEach((g) => console.log(`  - ${g}`));
    process.exit(1);
  }
  console.log('HASIL: SEMUA UNIT TEST LULUS');
}

main().catch((error) => {
  console.error('Unit test gagal dijalankan:', error);
  process.exit(1);
});
