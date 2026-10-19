/**
 * Aturan tunggal tentang siapa yang boleh melihat tiket apa.
 *
 * Dipakai bersama oleh controller tiket (daftar, balas, ekspor) supaya aturan
 * privasi tidak tercecer di banyak endpoint dan tidak pernah saling berbeda.
 */

export const TICKET_TARGETS = [
  'DPM',
  'BEM',
  'SISTEM_INFORMASI',
  'TEKNIK_MESIN',
  'TEKNIK_SIPIL',
] as const;

export type TicketTarget = (typeof TICKET_TARGETS)[number];

/** Keluhahan boleh diarahkan ke organisasi mana pun (termasuk BEM). */
export const KELUHAN_TARGETS: TicketTarget[] = [...TICKET_TARGETS];

/** Role pengurus -> organisasi yang secara bawaan boleh ia baca. */
export const ROLE_TARGET: Record<string, TicketTarget> = {
  PENGURUS_DPM: 'DPM',
  PENGURUS_BEM: 'BEM',
  PENGURUS_SISTEM_INFORMASI: 'SISTEM_INFORMASI',
  PENGURUS_TEKNIK_MESIN: 'TEKNIK_MESIN',
  PENGURUS_TEKNIK_SIPIL: 'TEKNIK_SIPIL',
};

/** Semua role yang dianggap "pengurus" (boleh mengelola tiket). */
export const OFFICER_ROLES: string[] = ['PENGURUS', ...Object.keys(ROLE_TARGET)];

/**
 * Role pengelola tingkat atas.
 * ADMIN = pengelola fakultas; SUPERADMIN = pengelola web yang satu tingkat di
 * atasnya. Keduanya diperlakukan sama pada hampir semua pemeriksaan, jadi
 * daftar ini dipakai bersama supaya tidak ada endpoint yang "lupa" SUPERADMIN.
 */
export const ADMIN_ROLES: string[] = ['ADMIN', 'SUPERADMIN'];

export const isAdminRole = (role: string | null | undefined): boolean =>
  !!role && ADMIN_ROLES.includes(role);

/** Role yang boleh ditetapkan admin pada seorang pengurus. */
export const ASSIGNABLE_ROLES: string[] = ['MAHASISWA', ...OFFICER_ROLES, 'ADMIN'];

export const isOfficer = (role: string): boolean => OFFICER_ROLES.includes(role);

/** Hanya ADMIN/SUPERADMIN dan PENGURUS DPM yang boleh mengaudit keluhan ke Excel. */
export const canExportKeluhan = (role: string): boolean =>
  isAdminRole(role) || role === 'PENGURUS_DPM';

/** Label organisasi untuk ditampilkan di UI maupun di berkas ekspor. */
export const TARGET_LABEL: Record<TicketTarget, string> = {
  DPM: 'DPM (Dewan Perwakilan Mahasiswa)',
  BEM: 'BEM (Badan Eksekutif Mahasiswa)',
  SISTEM_INFORMASI: 'Himpunan Sistem Informasi',
  TEKNIK_MESIN: 'Himpunan Teknik Mesin',
  TEKNIK_SIPIL: 'Himpunan Teknik Sipil',
};

export const isTicketTarget = (value: unknown): value is TicketTarget =>
  typeof value === 'string' && (TICKET_TARGETS as readonly string[]).includes(value);

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
export function ticketVisibilityWhere(user: { id: string; role: string }): Record<string, unknown> {
  if (isAdminRole(user.role) || user.role === 'PENGURUS') return {};
  if (user.role === 'MAHASISWA') return { senderId: user.id };

  const or: Record<string, unknown>[] = [
    { assignments: { some: { assigneeId: user.id, isActive: true } } },
  ];

  if (user.role === 'PENGURUS_DPM') {
    or.push({ type: 'KELUHAN' });
  } else if (user.role === 'PENGURUS_BEM') {
    or.push({ type: 'ASPIRASI' });
  } else if (ROLE_TARGET[user.role]) {
    or.push({ targetOrganization: ROLE_TARGET[user.role] });
  }

  return { OR: or };
}

/** Apakah pemilik sesi boleh membaca/membalas satu tiket tertentu. */
export function canAccessTicket(
  user: { id: string; role: string },
  ticket: { type: string; targetOrganization: string | null; senderId: string; assignments?: { assigneeId: string; isActive: boolean }[] }
): boolean {
  if (isAdminRole(user.role) || user.role === 'PENGURUS') return true;
  if (user.role === 'MAHASISWA') return ticket.senderId === user.id;
  if (ticket.assignments?.some((a) => a.isActive && a.assigneeId === user.id)) return true;
  if (user.role === 'PENGURUS_DPM') return ticket.type === 'KELUHAN';
  if (user.role === 'PENGURUS_BEM') return ticket.type === 'ASPIRASI';
  const target = ROLE_TARGET[user.role];
  return Boolean(target) && ticket.targetOrganization === target;
}
