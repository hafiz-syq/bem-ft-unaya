/**
 * Cerminan aturan role & organisasi dari backend.
 * Disimpan di satu berkas supaya label dan hak akses di UI tidak berbeda-beda
 * antar halaman.
 */

export const ROLE_MAHASISWA = 'MAHASISWA';
export const ROLE_ADMIN = 'ADMIN';

/** Pengurus lama (generik) + lima role pengurus spesifik organisasi. */
export const OFFICER_ROLES = [
  'PENGURUS',
  'PENGURUS_DPM',
  'PENGURUS_BEM',
  'PENGURUS_SISTEM_INFORMASI',
  'PENGURUS_TEKNIK_MESIN',
  'PENGURUS_TEKNIK_SIPIL',
] as const;

export const ROLE_LABEL: Record<string, string> = {
  MAHASISWA: 'Mahasiswa',
  PENGURUS: 'Pengurus (Umum)',
  PENGURUS_DPM: 'Pengurus DPM',
  PENGURUS_BEM: 'Pengurus BEM',
  PENGURUS_SISTEM_INFORMASI: 'Pengurus Sistem Informasi',
  PENGURUS_TEKNIK_MESIN: 'Pengurus Teknik Mesin',
  PENGURUS_TEKNIK_SIPIL: 'Pengurus Teknik Sipil',
  ADMIN: 'Administrator',
};

/** Role yang boleh ditetapkan admin pada seorang mahasiswa/pengurus. */
export const ASSIGNABLE_ROLES = [
  'MAHASISWA',
  ...OFFICER_ROLES,
  'ADMIN',
] as const;

export const isOfficer = (role?: string | null): boolean =>
  !!role && (OFFICER_ROLES as readonly string[]).includes(role);

/** Pengurus DAN admin dianggap staf (boleh mengelola tiket). */
export const isStaff = (role?: string | null): boolean => isOfficer(role) || role === ROLE_ADMIN;

/** Hanya admin & pengurus DPM yang boleh mengaudit keluhan ke Excel. */
export const canExportKeluhan = (role?: string | null): boolean =>
  role === ROLE_ADMIN || role === 'PENGURUS_DPM';

// --- Tujuan tiket ---
export const TICKET_TARGETS = [
  'DPM',
  'BEM',
  'SISTEM_INFORMASI',
  'TEKNIK_MESIN',
  'TEKNIK_SIPIL',
] as const;

export type TicketTarget = (typeof TICKET_TARGETS)[number];

export const TARGET_LABEL: Record<string, string> = {
  DPM: 'DPM (Dewan Perwakilan Mahasiswa)',
  BEM: 'BEM (Badan Eksekutif Mahasiswa)',
  SISTEM_INFORMASI: 'Himpunan Sistem Informasi',
  TEKNIK_MESIN: 'Himpunan Teknik Mesin',
  TEKNIK_SIPIL: 'Himpunan Teknik Sipil',
};

export const targetLabel = (target?: string | null): string =>
  target ? TARGET_LABEL[target] ?? target : '-';
