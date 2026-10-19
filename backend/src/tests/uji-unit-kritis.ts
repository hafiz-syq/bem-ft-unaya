/**
 * Unit test tanpa server & tanpa database.
 *
 * Dua kelompok yang diuji:
 *   A. lib/ticket-access — aturan privasi tiket murni (siapa boleh baca apa).
 *   B. Guard peran di controller kritis — memastikan penolakan 403 terjadi di
 *      DALAM controller SEBELUM query apa pun ke database, sehingga bila ada
 *      yang menghapus guard, test ini gagal (prisma akan tersentuh / next
 *      dipanggil) tanpa perlu server berjalan.
 *
 * Jalankan: npm run test:unit   (dari folder backend)
 */

import {
  ADMIN_ROLES,
  ASSIGNABLE_ROLES,
  OFFICER_ROLES,
  ROLE_TARGET,
  TICKET_TARGETS,
  TARGET_LABEL,
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

/** Res palsu sederhana yang mencatat status & payload terakhir. */
function resPalsu(): { code: number | null; payload: unknown; status: (c: number) => unknown; json: (p: unknown) => unknown } {
  const res = {
    code: null as number | null,
    payload: null as unknown,
    status(c: number) { res.code = c; return res; },
    json(p: unknown) { res.payload = p; return res; },
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
  }

  {
    const res = resPalsu();
    let nextDipanggil = false;
    await getAuditLogs({ user: { id: 'u-uji', role: 'PENGURUS_BEM' }, query: {} }, res as never, (() => { nextDipanggil = true; }) as never);
    uji('getAuditLogs: PENGURUS ditolak 403 (khusus admin)', res.code === 403 && !nextDipanggil);
  }

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
