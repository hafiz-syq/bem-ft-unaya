"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const ticket_access_1 = require("../lib/ticket-access");
const position_controller_1 = require("../controllers/position.controller");
const data_request_controller_1 = require("../controllers/data-request.controller");
const audit_controller_1 = require("../controllers/audit.controller");
let lulus = 0;
const gagal = [];
function uji(nama, kondisi) {
    if (kondisi) {
        lulus++;
        console.log(`  LULUS   ${nama}`);
    }
    else {
        gagal.push(nama);
        console.log(`  GAGAL   ${nama}`);
    }
}
/** Res palsu sederhana yang mencatat status & payload terakhir. */
function resPalsu() {
    const res = {
        code: null,
        payload: null,
        status(c) { res.code = c; return res; },
        json(p) { res.payload = p; return res; },
    };
    return res;
}
async function main() {
    console.log('\n=== A. lib/ticket-access (aturan privasi murni) ===\n');
    uji('isAdminRole: ADMIN & SUPERADMIN benar', (0, ticket_access_1.isAdminRole)('ADMIN') && (0, ticket_access_1.isAdminRole)('SUPERADMIN'));
    uji('isAdminRole: MAHASISWA/PENGURUS/tamu salah', !(0, ticket_access_1.isAdminRole)('MAHASISWA') && !(0, ticket_access_1.isAdminRole)('PENGURUS') && !(0, ticket_access_1.isAdminRole)(null) && !(0, ticket_access_1.isAdminRole)(undefined));
    uji('ADMIN_ROLES persis [ADMIN, SUPERADMIN]', ticket_access_1.ADMIN_ROLES.length === 2 && ticket_access_1.ADMIN_ROLES.includes('ADMIN') && ticket_access_1.ADMIN_ROLES.includes('SUPERADMIN'));
    uji('isOfficer: semua OFFICER_ROLES benar', ticket_access_1.OFFICER_ROLES.every((r) => (0, ticket_access_1.isOfficer)(r)));
    uji('isOfficer: MAHASISWA/ADMIN salah', !(0, ticket_access_1.isOfficer)('MAHASISWA') && !(0, ticket_access_1.isOfficer)('ADMIN'));
    uji('setiap role di ROLE_TARGET termasuk OFFICER_ROLES', Object.keys(ticket_access_1.ROLE_TARGET).every((r) => ticket_access_1.OFFICER_ROLES.includes(r)));
    uji('canExportKeluhan: ADMIN & SUPERADMIN & PENGURUS_DPM benar', (0, ticket_access_1.canExportKeluhan)('ADMIN') && (0, ticket_access_1.canExportKeluhan)('SUPERADMIN') && (0, ticket_access_1.canExportKeluhan)('PENGURUS_DPM'));
    uji('canExportKeluhan: PENGURUS_BEM, PENGURUS, MAHASISWA salah', !(0, ticket_access_1.canExportKeluhan)('PENGURUS_BEM') && !(0, ticket_access_1.canExportKeluhan)('PENGURUS') && !(0, ticket_access_1.canExportKeluhan)('MAHASISWA'));
    uji('isTicketTarget menerima seluruh TICKET_TARGETS', ticket_access_1.TICKET_TARGETS.every((t) => (0, ticket_access_1.isTicketTarget)(t)));
    uji('isTicketTarget menolak nilai asing/bukan string', !(0, ticket_access_1.isTicketTarget)('bem') && !(0, ticket_access_1.isTicketTarget)('KABAR') && !(0, ticket_access_1.isTicketTarget)(42) && !(0, ticket_access_1.isTicketTarget)(null));
    uji('TARGET_LABEL melabeli seluruh TICKET_TARGETS', ticket_access_1.TICKET_TARGETS.every((t) => typeof ticket_access_1.TARGET_LABEL[t] === 'string' && ticket_access_1.TARGET_LABEL[t].length > 0));
    uji('ASSIGNABLE_ROLES = MAHASISWA + OFFICER + ADMIN', ticket_access_1.ASSIGNABLE_ROLES.includes('MAHASISWA') && ticket_access_1.ASSIGNABLE_ROLES.includes('ADMIN') && ticket_access_1.OFFICER_ROLES.every((r) => ticket_access_1.ASSIGNABLE_ROLES.includes(r)));
    // ticketVisibilityWhere
    const whereAdmin = (0, ticket_access_1.ticketVisibilityWhere)({ id: 'u1', role: 'ADMIN' });
    const wherePengurusLama = (0, ticket_access_1.ticketVisibilityWhere)({ id: 'u1', role: 'PENGURUS' });
    const whereMhs = (0, ticket_access_1.ticketVisibilityWhere)({ id: 'u1', role: 'MAHASISWA' });
    const whereDpm = (0, ticket_access_1.ticketVisibilityWhere)({ id: 'u1', role: 'PENGURUS_DPM' });
    const whereBem = (0, ticket_access_1.ticketVisibilityWhere)({ id: 'u1', role: 'PENGURUS_BEM' });
    const whereHimpunan = (0, ticket_access_1.ticketVisibilityWhere)({ id: 'u1', role: 'PENGURUS_TEKNIK_MESIN' });
    uji('visibility: ADMIN & PENGURUS lama melihat semua (where kosong)', Object.keys(whereAdmin).length === 0 && Object.keys(wherePengurusLama).length === 0);
    uji('visibility: MAHASISWA dibatasi senderId miliknya', whereMhs.senderId === 'u1');
    uji('visibility: PENGURUS_DPM OR = [ditugaskan, KELUHAN]', whereDpm.OR.length === 2 && JSON.stringify(whereDpm.OR[1]).includes('KELUHAN'));
    uji('visibility: PENGURUS_BEM OR = [ditugaskan, ASPIRASI]', whereBem.OR.length === 2 && JSON.stringify(whereBem.OR[1]).includes('ASPIRASI'));
    uji('visibility: pengurus himpunan OR = [ditugaskan, organisasinya]', whereHimpunan.OR.length === 2 && JSON.stringify(whereHimpunan.OR[1]).includes('TEKNIK_MESIN'));
    // canAccessTicket
    const tiketKeluhan = { type: 'KELUHAN', targetOrganization: 'DPM', senderId: 'u1' };
    const tiketAspirasi = { type: 'ASPIRASI', targetOrganization: 'BEM', senderId: 'u1' };
    const ditugaskan = { ...tiketKeluhan, assignments: [{ assigneeId: 'u2', isActive: true }] };
    const ditugaskanNonaktif = { ...tiketKeluhan, assignments: [{ assigneeId: 'u2', isActive: false }] };
    uji('akses: admin selalu bisa', (0, ticket_access_1.canAccessTicket)({ id: 'a', role: 'ADMIN' }, tiketKeluhan));
    uji('akses: mahasiswa hanya tiket miliknya', (0, ticket_access_1.canAccessTicket)({ id: 'u1', role: 'MAHASISWA' }, tiketKeluhan) && !(0, ticket_access_1.canAccessTicket)({ id: 'u9', role: 'MAHASISWA' }, tiketKeluhan));
    uji('akses: penugasan aktif membuka tiket; nonaktif tidak', (0, ticket_access_1.canAccessTicket)({ id: 'u2', role: 'PENGURUS_TEKNIK_MESIN' }, ditugaskan) && !(0, ticket_access_1.canAccessTicket)({ id: 'u2', role: 'PENGURUS_TEKNIK_MESIN' }, ditugaskanNonaktif));
    uji('akses: DPM baca keluhan, bukan aspirasi', (0, ticket_access_1.canAccessTicket)({ id: 'x', role: 'PENGURUS_DPM' }, tiketKeluhan) && !(0, ticket_access_1.canAccessTicket)({ id: 'x', role: 'PENGURUS_DPM' }, tiketAspirasi));
    uji('akses: BEM baca aspirasi, bukan keluhan', (0, ticket_access_1.canAccessTicket)({ id: 'x', role: 'PENGURUS_BEM' }, tiketAspirasi) && !(0, ticket_access_1.canAccessTicket)({ id: 'x', role: 'PENGURUS_BEM' }, tiketKeluhan));
    uji('akses: himpunan baca tiket ke organisasinya saja', (0, ticket_access_1.canAccessTicket)({ id: 'x', role: 'PENGURUS_TEKNIK_MESIN' }, { type: 'ASPIRASI', targetOrganization: 'TEKNIK_MESIN', senderId: 'u1' }) && !(0, ticket_access_1.canAccessTicket)({ id: 'x', role: 'PENGURUS_TEKNIK_MESIN' }, { type: 'ASPIRASI', targetOrganization: 'BEM', senderId: 'u1' }));
    console.log('\n=== B. Guard peran di controller kritis (tolak SEBELUM query DB) ===\n');
    // Semua kasus di bawah memakai role NON-admin. Bila guard dihapus, controller
    // akan melanjutkan ke query prisma (tersentuh DB / memanggil next(error)),
    // sehingga assertions di sini gagal.
    const nonAdmin = { id: 'u-uji', role: 'MAHASISWA' };
    {
        const res = resPalsu();
        let nextDipanggil = false;
        await (0, position_controller_1.createPositionSlot)({ user: nonAdmin, body: { organizationId: 'o', title: 'Jabatan' } }, res, (() => { nextDipanggil = true; }));
        uji('createPositionSlot: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
    }
    {
        const res = resPalsu();
        let nextDipanggil = false;
        await (0, position_controller_1.assignPosition)({ user: nonAdmin, body: { positionSlotId: 's', nim: '22140001' } }, res, (() => { nextDipanggil = true; }));
        uji('assignPosition: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
    }
    {
        const res = resPalsu();
        let nextDipanggil = false;
        await (0, data_request_controller_1.processRequest)({ user: nonAdmin, params: { id: 'x' }, body: { status: 'APPROVED' } }, res, (() => { nextDipanggil = true; }));
        uji('processRequest: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
    }
    {
        const res = resPalsu();
        let nextDipanggil = false;
        await (0, audit_controller_1.getAuditLogs)({ user: nonAdmin, query: {} }, res, (() => { nextDipanggil = true; }));
        uji('getAuditLogs: MAHASISWA ditolak 403 tanpa query DB', res.code === 403 && !nextDipanggil);
    }
    {
        const res = resPalsu();
        let nextDipanggil = false;
        await (0, audit_controller_1.getAuditLogs)({ user: { id: 'u-uji', role: 'PENGURUS_BEM' }, query: {} }, res, (() => { nextDipanggil = true; }));
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
