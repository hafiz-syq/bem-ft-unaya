"use strict";
/**
 * Aturan tunggal tentang siapa yang boleh melihat tiket apa.
 *
 * Dipakai bersama oleh controller tiket (daftar, balas, ekspor) supaya aturan
 * privasi tidak tercecer di banyak endpoint dan tidak pernah saling berbeda.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTicketTarget = exports.TARGET_LABEL = exports.canExportKeluhan = exports.isOfficer = exports.ASSIGNABLE_ROLES = exports.OFFICER_ROLES = exports.ROLE_TARGET = exports.KELUHAN_TARGETS = exports.TICKET_TARGETS = void 0;
exports.ticketVisibilityWhere = ticketVisibilityWhere;
exports.canAccessTicket = canAccessTicket;
exports.TICKET_TARGETS = [
    'DPM',
    'BEM',
    'SISTEM_INFORMASI',
    'TEKNIK_MESIN',
    'TEKNIK_SIPIL',
];
/** Keluhahan boleh diarahkan ke organisasi mana pun (termasuk BEM). */
exports.KELUHAN_TARGETS = [...exports.TICKET_TARGETS];
/** Role pengurus -> organisasi yang secara bawaan boleh ia baca. */
exports.ROLE_TARGET = {
    PENGURUS_DPM: 'DPM',
    PENGURUS_BEM: 'BEM',
    PENGURUS_SISTEM_INFORMASI: 'SISTEM_INFORMASI',
    PENGURUS_TEKNIK_MESIN: 'TEKNIK_MESIN',
    PENGURUS_TEKNIK_SIPIL: 'TEKNIK_SIPIL',
};
/** Semua role yang dianggap "pengurus" (boleh mengelola tiket). */
exports.OFFICER_ROLES = ['PENGURUS', ...Object.keys(exports.ROLE_TARGET)];
/** Role yang boleh ditetapkan admin pada seorang pengurus. */
exports.ASSIGNABLE_ROLES = ['MAHASISWA', ...exports.OFFICER_ROLES, 'ADMIN'];
const isOfficer = (role) => exports.OFFICER_ROLES.includes(role);
exports.isOfficer = isOfficer;
/** Hanya ADMIN dan PENGURUS DPM yang boleh mengaudit data keluhan ke Excel. */
const canExportKeluhan = (role) => role === 'ADMIN' || role === 'PENGURUS_DPM';
exports.canExportKeluhan = canExportKeluhan;
/** Label organisasi untuk ditampilkan di UI maupun di berkas ekspor. */
exports.TARGET_LABEL = {
    DPM: 'DPM (Dewan Perwakilan Mahasiswa)',
    BEM: 'BEM (Badan Eksekutif Mahasiswa)',
    SISTEM_INFORMASI: 'Himpunan Sistem Informasi',
    TEKNIK_MESIN: 'Himpunan Teknik Mesin',
    TEKNIK_SIPIL: 'Himpunan Teknik Sipil',
};
const isTicketTarget = (value) => typeof value === 'string' && exports.TICKET_TARGETS.includes(value);
exports.isTicketTarget = isTicketTarget;
/**
 * Kondisi Prisma `where` yang membatasi daftar tiket sesuai hak baca pemilik sesi.
 *
 * Aturan:
 * - ADMIN dan PENGURUS (role lama) melihat seluruh tiket.
 * - MAHASISWA hanya tiket miliknya sendiri.
 * - PENGURUS BEM membaca seluruh ASPIRASI; PENGURUS DPM membaca seluruh KELUHAN.
 * - Pengurus himpunan membaca tiket yang ditujukan ke organisasinya.
 * - Siapa pun yang ditugaskan pada sebuah tiket selalu bisa membaca tiket itu.
 */
function ticketVisibilityWhere(user) {
    if (user.role === 'ADMIN' || user.role === 'PENGURUS')
        return {};
    if (user.role === 'MAHASISWA')
        return { senderId: user.id };
    const or = [
        { assignments: { some: { assigneeId: user.id, isActive: true } } },
    ];
    if (user.role === 'PENGURUS_DPM') {
        or.push({ type: 'KELUHAN' });
    }
    else if (user.role === 'PENGURUS_BEM') {
        or.push({ type: 'ASPIRASI' });
    }
    else if (exports.ROLE_TARGET[user.role]) {
        or.push({ targetOrganization: exports.ROLE_TARGET[user.role] });
    }
    return { OR: or };
}
/** Apakah pemilik sesi boleh membaca/membalas satu tiket tertentu. */
function canAccessTicket(user, ticket) {
    if (user.role === 'ADMIN' || user.role === 'PENGURUS')
        return true;
    if (user.role === 'MAHASISWA')
        return ticket.senderId === user.id;
    if (ticket.assignments?.some((a) => a.isActive && a.assigneeId === user.id))
        return true;
    if (user.role === 'PENGURUS_DPM')
        return ticket.type === 'KELUHAN';
    if (user.role === 'PENGURUS_BEM')
        return ticket.type === 'ASPIRASI';
    const target = exports.ROLE_TARGET[user.role];
    return Boolean(target) && ticket.targetOrganization === target;
}
