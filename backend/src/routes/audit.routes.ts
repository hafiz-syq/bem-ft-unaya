import { Router } from 'express';
import { getAuditLogs, hapusLogAudit, hapusLogAuditMassal } from '../controllers/audit.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Hanya admin yang bisa melihat log aktivitas
router.get('/', requireAuth, getAuditLogs);

// Hapus massal log lama (ADMIN ke atas; "semua" hanya SUPERADMIN, dijaga di controller).
router.delete('/', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), hapusLogAuditMassal);

// Hapus satu log (SUPERADMIN saja).
router.delete('/:id', requireAuth, requireRole(['SUPERADMIN']), hapusLogAudit);

export default router;