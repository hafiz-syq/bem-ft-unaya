/**
 * Cerminan aturan role & organisasi dari backend.
 * Disimpan di satu berkas supaya label dan hak akses di UI tidak berbeda-beda
 * antar halaman.
 */

export const ROLE_MAHASISWA = 'MAHASISWA';
export const ROLE_ADMIN = 'ADMIN';
/** Pengelola web: satu tingkat di atas admin, tidak pernah bisa dinonaktifkan. */
export const ROLE_SUPERADMIN = 'SUPERADMIN';

/** Semua role yang dianggap pengelola (admin fakultas & pengelola web). */
export const ADMIN_ROLES = [ROLE_ADMIN, ROLE_SUPERADMIN] as const;

export const isAdminRole = (role?: string | null): boolean =>
  !!role && (ADMIN_ROLES as readonly string[]).includes(role);

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
  // Bukan role akun: dipakai khusus komentar galeri yang dikirim tamu.
  TAMU: 'Tamu',
  MAHASISWA: 'Mahasiswa',
  PENGURUS: 'Pengurus (Umum)',
  PENGURUS_DPM: 'Pengurus DPM',
  PENGURUS_BEM: 'Pengurus BEM',
  PENGURUS_SISTEM_INFORMASI: 'Pengurus Sistem Informasi',
  PENGURUS_TEKNIK_MESIN: 'Pengurus Teknik Mesin',
  PENGURUS_TEKNIK_SIPIL: 'Pengurus Teknik Sipil',
  ADMIN: 'Administrator',
  SUPERADMIN: 'Superadmin (Pengelola Web)',
};

/**
 * Role yang boleh ditetapkan admin pada seorang mahasiswa/pengurus.
 * SUPERADMIN tidak ada di sini: role itu hanya bisa ditetapkan sesama
 * SUPERADMIN (dijaga juga di backend).
 */
export const ASSIGNABLE_ROLES = [
  'MAHASISWA',
  ...OFFICER_ROLES,
  'ADMIN',
] as const;

export const isOfficer = (role?: string | null): boolean =>
  !!role && (OFFICER_ROLES as readonly string[]).includes(role);

/**
 * Akun yang login minimal berperan MAHASISWA.
 * Dipakai untuk fitur yang hanya boleh dilihat mahasiswa ke atas (mis. tautan
 * pendaftaran agenda); tamu tidak punya role sehingga selalu ditolak.
 */
export const isMahasiswaOrAbove = (role?: string | null): boolean =>
  !!role && (role === ROLE_MAHASISWA || isOfficer(role) || isAdminRole(role));

/** Pengurus DAN admin dianggap staf (boleh mengelola tiket). */
export const isStaff = (role?: string | null): boolean => isOfficer(role) || isAdminRole(role);

/** Hanya admin/superadmin & pengurus DPM yang boleh mengaudit keluhan ke Excel. */
export const canExportKeluhan = (role?: string | null): boolean =>
  isAdminRole(role) || role === 'PENGURUS_DPM';

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
