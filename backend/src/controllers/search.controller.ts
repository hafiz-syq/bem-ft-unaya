import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isAdminRole, OFFICER_ROLES, ticketVisibilityWhere } from '../lib/ticket-access';

interface HasilCari {
  tipe: 'mahasiswa' | 'tiket' | 'organisasi' | 'posisi' | 'halaman';
  id: string;
  judul: string;
  keterangan: string;
  url: string;
}

const HALAMAN: { judul: string; keterangan: string; url: string; kata: string[] }[] = [
  { judul: 'Dashboard', keterangan: 'Ringkasan aktivitas dan statistik', url: '/dashboard', kata: ['dashboard', 'beranda', 'statistik'] },
  { judul: 'Profil Saya', keterangan: 'Data akun dan foto profil', url: '/profile', kata: ['profil', 'akun', 'foto'] },
  { judul: 'Layanan Tiket', keterangan: 'Aspirasi dan keluhan mahasiswa', url: '/tickets', kata: ['tiket', 'aspirasi', 'keluhan'] },
  { judul: 'Buku Tamu', keterangan: 'Pesan dan suara publik', url: '/buku-tamu', kata: ['buku tamu', 'pesan', 'publik'] },
  { judul: 'Pengumuman', keterangan: 'Pengumuman resmi organisasi', url: '/pengumuman', kata: ['pengumuman', 'informasi', 'berita'] },
  { judul: 'Data Mahasiswa', keterangan: 'Kelola akun mahasiswa dan pengurus', url: '/students', kata: ['mahasiswa', 'data', 'akun', 'nim'] },
  { judul: 'Arsip Surat', keterangan: 'Surat dan proposal kepengurusan', url: '/dokumen', kata: ['surat', 'proposal', 'arsip', 'dokumen'] },
  { judul: 'Laporan Bulanan', keterangan: 'Unduh rekap bulanan', url: '/dashboard', kata: ['laporan', 'rekap', 'bulanan', 'excel'] },
];

/** Pencarian global untuk command palette (Ctrl/⌘+K). */
export const globalSearch = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      res.status(200).json({ data: [] });
      return;
    }

    const admin = isAdminRole(req.user.role);
    const staff = admin || OFFICER_ROLES.includes(req.user.role);
    const hasil: HasilCari[] = [];

    if (staff) {
      const mahasiswa = await prisma.user.findMany({
        where: {
          deletedAt: null,
          role: { notIn: admin && req.user.role === 'SUPERADMIN' ? ['SUPERADMIN'] : ['ADMIN', 'SUPERADMIN'] },
          OR: [{ nim: { contains: q } }, { profile: { nama: { contains: q } } }],
        },
        take: 6,
        select: {
          id: true,
          nim: true,
          role: true,
          profile: { select: { nama: true, program_studi: true } },
        },
      });
      for (const m of mahasiswa) {
        hasil.push({
          tipe: 'mahasiswa',
          id: m.id,
          judul: m.profile?.nama || m.nim,
          keterangan: `${m.nim} • ${m.profile?.program_studi || m.role}`,
          url: `/students?search=${encodeURIComponent(m.nim)}`,
        });
      }
    }

    const tiket = await prisma.ticket.findMany({
      where: {
        AND: [
          ticketVisibilityWhere(req.user) as any,
          { OR: [{ ticket_no: { contains: q } }, { title: { contains: q } }] },
        ],
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { id: true, ticket_no: true, title: true, status: true },
    });
    for (const t of tiket) {
      hasil.push({
        tipe: 'tiket',
        id: t.id,
        judul: `#${t.ticket_no}`,
        keterangan: `${t.title} • ${t.status}`,
        url: `/tickets?search=${encodeURIComponent(t.ticket_no)}`,
      });
    }

    if (admin) {
      const [organisasi, posisi] = await Promise.all([
        prisma.organization.findMany({
          where: { isActive: true, name: { contains: q } },
          take: 5,
          select: { id: true, name: true },
        }),
        prisma.positionSlot.findMany({
          where: { isActive: true, title: { contains: q } },
          take: 5,
          select: {
            id: true,
            title: true,
            organization: { select: { name: true } },
          },
        }),
      ]);

      for (const o of organisasi) {
        hasil.push({
          tipe: 'organisasi',
          id: o.id,
          judul: o.name,
          keterangan: 'Master Organisasi',
          url: '/organizations',
        });
      }
      for (const p of posisi) {
        hasil.push({
          tipe: 'posisi',
          id: p.id,
          judul: p.title,
          keterangan: p.organization.name,
          url: '/positions',
        });
      }
    }

    const qKecil = q.toLowerCase();
    for (const h of HALAMAN) {
      if (h.judul.toLowerCase().includes(qKecil) || h.kata.some((k) => k.includes(qKecil))) {
        hasil.push({
          tipe: 'halaman',
          id: h.url,
          judul: h.judul,
          keterangan: h.keterangan,
          url: h.url,
        });
      }
    }

    // Deduplikasi halaman yang sama (mis. dua kata kunci menunjuk dashboard).
    const unik = hasil.filter(
      (item, i, semua) => semua.findIndex((x) => x.tipe === item.tipe && x.id === item.id) === i
    );

    res.status(200).json({ data: unik.slice(0, 20) });
  } catch (error) {
    next(error);
  }
};
