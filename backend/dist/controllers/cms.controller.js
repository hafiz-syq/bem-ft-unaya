"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicStructure = exports.updateSiteSettings = exports.getSiteSettings = exports.deleteGallery = exports.updateGallery = exports.createGallery = exports.getGalleries = exports.deleteAgenda = exports.updateAgenda = exports.createAgenda = exports.getAgendaIcs = exports.getAgendas = exports.deleteContent = exports.updateContent = exports.createContent = exports.getContentById = exports.getContents = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("../services/audit.service");
const account_lifecycle_service_1 = require("../services/account-lifecycle.service");
/** Kunci pengaturan situs yang boleh diubah admin. */
const ALLOWED_SETTINGS = ['visi', 'misi'];
const isSettingKey = (value) => ALLOWED_SETTINGS.includes(value);
/** Mengambil semua file yang diunggah dari field 'images' maupun 'file'. */
const ambilFile = (req) => {
    const map = (req.files || {});
    const dariImages = Array.isArray(map.images) ? map.images : [];
    const dariFile = Array.isArray(map.file) ? map.file : [];
    const tunggal = req.file ? [req.file] : [];
    return [...dariImages, ...dariFile, ...tunggal];
};
// ================= KONTEN (BERITA / ARTIKEL / PROGRAM) =================
const getContents = async (req, res, next) => {
    try {
        const { type } = req.query;
        const whereCondition = type ? { type: String(type), status: 'PUBLISHED' } : { status: 'PUBLISHED' };
        const contents = await prisma_1.default.content.findMany({
            where: whereCondition,
            include: {
                author: { select: { nim: true, role: true, profile: { select: { nama: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ data: contents });
    }
    catch (error) {
        next(error);
    }
};
exports.getContents = getContents;
const getContentById = async (req, res, next) => {
    try {
        const content = await prisma_1.default.content.findUnique({
            where: { id: req.params.id },
            include: { author: { select: { profile: { select: { nama: true } } } } }
        });
        if (!content) {
            res.status(404).json({ message: 'Konten tidak ditemukan' });
            return;
        }
        res.status(200).json({ data: content });
    }
    catch (error) {
        next(error);
    }
};
exports.getContentById = getContentById;
const createContent = async (req, res, next) => {
    try {
        const { type, title, content } = req.body;
        const gambarBaru = ambilFile(req)[0];
        if (!type || !title || !content) {
            res.status(400).json({ message: 'Semua kolom wajib diisi.' });
            return;
        }
        const imagePath = gambarBaru ? `/uploads/${gambarBaru.filename}` : null;
        const newContent = await prisma_1.default.content.create({
            data: { type, title, content, image: imagePath, authorId: req.user.id }
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'CREATE_CONTENT', 'Content', `Menerbitkan ${type} "${title}"`, newContent.id);
        res.status(201).json({ message: 'Konten berhasil dipublikasikan!', data: newContent });
    }
    catch (error) {
        next(error);
    }
};
exports.createContent = createContent;
/** Mengubah konten (berita, artikel, program kerja) yang sudah ada. */
const updateContent = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { type, title, content } = req.body;
        const gambarBaru = ambilFile(req)[0];
        const lama = await prisma_1.default.content.findUnique({ where: { id } });
        if (!lama) {
            res.status(404).json({ message: 'Konten tidak ditemukan.' });
            return;
        }
        const data = {};
        if (type)
            data.type = type;
        if (title !== undefined)
            data.title = title;
        if (content !== undefined)
            data.content = content;
        if (gambarBaru)
            data.image = `/uploads/${gambarBaru.filename}`;
        if (req.body.removeImage === 'true')
            data.image = null;
        const updated = await prisma_1.default.content.update({ where: { id }, data });
        await (0, audit_service_1.logActivity)(req.user.id, 'UPDATE_CONTENT', 'Content', `Memperbarui konten "${updated.title}"`, id);
        res.status(200).json({ message: 'Konten berhasil diperbarui.', data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.updateContent = updateContent;
const deleteContent = async (req, res, next) => {
    try {
        const lama = await prisma_1.default.content.findUnique({ where: { id: req.params.id } });
        await prisma_1.default.content.delete({ where: { id: req.params.id } });
        await (0, audit_service_1.logActivity)(req.user.id, 'DELETE_CONTENT', 'Content', `Menghapus konten "${lama?.title ?? req.params.id}"`, req.params.id);
        res.status(200).json({ message: 'Konten berhasil dihapus.' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteContent = deleteContent;
// ================= AGENDA =================
const WARNA_AGENDA_BAWAAN = '#F59E0B';
const POLA_WARNA = /^#[0-9a-fA-F]{6}$/;
/** Tanggal agenda disimpan apa adanya dari input `YYYY-MM-DD` (UTC tengah malam). */
const bacaTanggal = (nilai) => {
    if (!nilai)
        return null;
    const tanggal = new Date(String(nilai));
    return Number.isNaN(tanggal.getTime()) ? null : tanggal;
};
/**
 * Menormalkan rentang agenda.
 * `endDate` yang sama dengan tanggal mulai disimpan sebagai NULL supaya agenda
 * satu hari tidak dianggap multi-hari oleh kalender.
 */
const rentangAgenda = (mulai, selesai) => {
    if (!selesai)
        return { ok: true, endDate: null };
    if (selesai < mulai) {
        return { ok: false, pesan: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' };
    }
    return { ok: true, endDate: selesai.getTime() === mulai.getTime() ? null : selesai };
};
const bacaWarna = (nilai) => {
    if (nilai === undefined || nilai === null || nilai === '')
        return WARNA_AGENDA_BAWAAN;
    const warna = String(nilai).trim();
    return POLA_WARNA.test(warna) ? warna.toUpperCase() : null;
};
const getAgendas = async (req, res, next) => {
    try {
        const agendas = await prisma_1.default.agenda.findMany({
            orderBy: { date: 'asc' },
            include: { author: { select: { profile: { select: { nama: true } } } } }
        });
        res.status(200).json({ data: agendas });
    }
    catch (error) {
        next(error);
    }
};
exports.getAgendas = getAgendas;
// ================= AGENDA → BERKAS KALENDER (.ics) =================
// Semua pengunjung bisa mengunduh agenda sebagai berkas kalender standar
// (RFC 5545) untuk ditambahkan ke Google Calendar / Outlook / HP.
/** Karakter yang wajib di-escape dalam teks iCalendar. */
const escapeIcs = (teks) => String(teks ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
/** Lipat baris > 75 oktet dengan kelanjutan spasi (aturan iCalendar). */
const lipatIcs = (baris) => {
    if (baris.length <= 75)
        return baris;
    const bagian = [];
    let sisa = baris;
    while (sisa.length > 74) {
        bagian.push(sisa.slice(0, 74));
        sisa = ' ' + sisa.slice(74);
    }
    bagian.push(sisa);
    return bagian.join('\r\n');
};
/** Angka dua digit. */
const duaDigit = (n) => String(n).padStart(2, '0');
/**
 * Waktu agenda ("HH:MM" WIB, tanpa zona yang bergeser) menjadi bentuk UTC
 * iCalendar `YYYYMMDDTHHMMSSZ` (+ menit offset untuk DTEND).
 */
const waktuIcsUtc = (tanggal, jamText, tambahMenit = 0) => {
    const [t, m] = (jamText || '').split(':').map((v) => parseInt(v, 10) || 0);
    const d = new Date(`${String(tanggal).slice(0, 10)}T00:00:00Z`);
    d.setUTCMinutes(d.getUTCMinutes() + t * 60 + m + tambahMenit);
    return `${d.getUTCFullYear()}${duaDigit(d.getUTCMonth() + 1)}${duaDigit(d.getUTCDate())}T${duaDigit(d.getUTCHours())}${duaDigit(d.getUTCMinutes())}00Z`;
};
/** GET /api/cms/agendas/calendar.ics — seluruh agenda sebagai berkas .ics. */
const getAgendaIcs = async (req, res, next) => {
    try {
        const agendas = await prisma_1.default.agenda.findMany({ orderBy: { date: 'asc' } });
        const sekarang = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
        const baris = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//BEM FT UNAYA//Agenda//ID',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Agenda BEM FT UNAYA',
        ];
        for (const a of agendas) {
            const mulai = waktuIcsUtc(String(a.date), a.time || '00:00');
            // DTEND: multi-hari memakai akhir endDate (23:59 WIB); satu agenda:
            // asumsi ±2 jam dari mulai karena server hanya menyimpan jam mulai.
            const akhir = a.endDate
                ? waktuIcsUtc(String(a.endDate), '23:59')
                : waktuIcsUtc(String(a.date), a.time || '00:00', 120);
            baris.push('BEGIN:VEVENT', `UID:agenda-${a.id}@bem-ft-unaya`, `DTSTAMP:${sekarang}`, `DTSTART:${mulai}`, `DTEND:${akhir}`, `SUMMARY:${escapeIcs(a.title)}`, `DESCRIPTION:${escapeIcs(a.description || '')}`, `LOCATION:${escapeIcs(a.location || '')}`, `CATEGORIES:BEM FT UNAYA`, 'END:VEVENT');
        }
        baris.push('END:VCALENDAR');
        const isi = baris.map(lipatIcs).join('\r\n') + '\r\n';
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="agenda-bem-ft-unaya.ics"');
        res.status(200).send(isi);
    }
    catch (error) {
        next(error);
    }
};
exports.getAgendaIcs = getAgendaIcs;
const createAgenda = async (req, res, next) => {
    try {
        const { title, description, date, endDate, color, time, location, registrationLink, socialMediaLink } = req.body;
        if (!title || !date || !time || !location || !description) {
            res.status(400).json({ message: 'Semua kolom wajib diisi.' });
            return;
        }
        const mulai = bacaTanggal(date);
        if (!mulai) {
            res.status(400).json({ message: 'Tanggal mulai tidak valid.' });
            return;
        }
        const selesai = bacaTanggal(endDate);
        if (endDate && !selesai) {
            res.status(400).json({ message: 'Tanggal selesai tidak valid.' });
            return;
        }
        const rentang = rentangAgenda(mulai, selesai);
        if (!rentang.ok) {
            res.status(400).json({ message: rentang.pesan });
            return;
        }
        const warna = bacaWarna(color);
        if (!warna) {
            res.status(400).json({ message: 'Warna harus berupa kode heksadesimal, misalnya #F59E0B.' });
            return;
        }
        const newAgenda = await prisma_1.default.agenda.create({
            data: {
                title, description, date: mulai, endDate: rentang.endDate, color: warna, time, location,
                registrationLink: registrationLink || null,
                socialMediaLink: socialMediaLink || null,
                authorId: req.user.id
            }
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'CREATE_AGENDA', 'Agenda', `Membuat agenda "${title}"`, newAgenda.id);
        res.status(201).json({ message: 'Agenda berhasil dibuat', data: newAgenda });
    }
    catch (error) {
        next(error);
    }
};
exports.createAgenda = createAgenda;
const updateAgenda = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, date, endDate, color, time, location, registrationLink, socialMediaLink } = req.body;
        const lama = await prisma_1.default.agenda.findUnique({ where: { id } });
        if (!lama) {
            res.status(404).json({ message: 'Agenda tidak ditemukan.' });
            return;
        }
        const data = {};
        if (title !== undefined)
            data.title = title;
        if (description !== undefined)
            data.description = description;
        // Rentang divalidasi terhadap nilai baru yang benar-benar akan disimpan,
        // bukan hanya field yang dikirim, supaya mengubah salah satu ujung rentang
        // tidak menghasilkan agenda dengan tanggal selesai mendahului tanggal mulai.
        if (date !== undefined || endDate !== undefined) {
            const mulai = date !== undefined ? bacaTanggal(date) : lama.date;
            if (!mulai) {
                res.status(400).json({ message: 'Tanggal mulai tidak valid.' });
                return;
            }
            const selesai = endDate === undefined ? lama.endDate : bacaTanggal(endDate);
            if (endDate && !selesai) {
                res.status(400).json({ message: 'Tanggal selesai tidak valid.' });
                return;
            }
            const rentang = rentangAgenda(mulai, selesai);
            if (!rentang.ok) {
                res.status(400).json({ message: rentang.pesan });
                return;
            }
            data.date = mulai;
            data.endDate = rentang.endDate;
        }
        if (color !== undefined) {
            const warna = bacaWarna(color);
            if (!warna) {
                res.status(400).json({ message: 'Warna harus berupa kode heksadesimal, misalnya #F59E0B.' });
                return;
            }
            data.color = warna;
        }
        if (time !== undefined)
            data.time = time;
        if (location !== undefined)
            data.location = location;
        if (registrationLink !== undefined)
            data.registrationLink = registrationLink || null;
        if (socialMediaLink !== undefined)
            data.socialMediaLink = socialMediaLink || null;
        if (req.body.status)
            data.status = req.body.status;
        const updated = await prisma_1.default.agenda.update({ where: { id }, data });
        await (0, audit_service_1.logActivity)(req.user.id, 'UPDATE_AGENDA', 'Agenda', `Memperbarui agenda "${updated.title}"`, id);
        res.status(200).json({ message: 'Agenda berhasil diperbarui.', data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.updateAgenda = updateAgenda;
const deleteAgenda = async (req, res, next) => {
    try {
        const lama = await prisma_1.default.agenda.findUnique({ where: { id: req.params.id } });
        await prisma_1.default.agenda.delete({ where: { id: req.params.id } });
        await (0, audit_service_1.logActivity)(req.user.id, 'DELETE_AGENDA', 'Agenda', `Menghapus agenda "${lama?.title ?? req.params.id}"`, req.params.id);
        res.status(200).json({ message: 'Agenda dihapus' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAgenda = deleteAgenda;
// ================= GALERI =================
const getGalleries = async (req, res, next) => {
    try {
        const galleries = await prisma_1.default.gallery.findMany({
            orderBy: { createdAt: 'desc' },
            // images ikut dikirim supaya frontend bisa menampilkan carousel.
            include: { images: { orderBy: { order: 'asc' } } }
        });
        res.status(200).json({ data: galleries });
    }
    catch (error) {
        next(error);
    }
};
exports.getGalleries = getGalleries;
/**
 * Membuat satu postingan galeri yang boleh memuat BANYAK foto sekaligus.
 * Foto pertama otomatis menjadi cover (kolom `url`) agar tampilan lama tetap jalan.
 */
const createGallery = async (req, res, next) => {
    try {
        const { title, category, activity, year } = req.body;
        const files = ambilFile(req);
        if (!title) {
            res.status(400).json({ message: 'Judul galeri wajib diisi.' });
            return;
        }
        if (files.length === 0) {
            res.status(400).json({ message: 'Minimal satu foto wajib diunggah.' });
            return;
        }
        const urls = files.map((f) => `/uploads/${f.filename}`);
        const newGallery = await prisma_1.default.gallery.create({
            data: {
                title,
                category: category || 'FOTO',
                activity: activity || null,
                year: parseInt(year) || new Date().getFullYear(),
                url: urls[0],
                uploaderId: req.user.id,
                images: { create: urls.map((url, index) => ({ url, order: index })) }
            },
            include: { images: { orderBy: { order: 'asc' } } }
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'CREATE_GALLERY', 'Gallery', `Mengunggah galeri "${title}" dengan ${urls.length} foto`, newGallery.id);
        res.status(201).json({
            message: `Galeri berhasil diunggah (${urls.length} foto).`,
            data: newGallery
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createGallery = createGallery;
/** Mengubah metadata galeri, menambah foto baru, dan/atau menghapus foto tertentu. */
const updateGallery = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, category, activity, year } = req.body;
        const files = ambilFile(req);
        const lama = await prisma_1.default.gallery.findUnique({
            where: { id },
            include: { images: { orderBy: { order: 'asc' } } }
        });
        if (!lama) {
            res.status(404).json({ message: 'Galeri tidak ditemukan.' });
            return;
        }
        // Daftar id foto yang ingin dibuang (dikirim sebagai JSON string dari form data).
        let hapusIds = [];
        if (req.body.removeImageIds) {
            try {
                const parsed = JSON.parse(req.body.removeImageIds);
                if (Array.isArray(parsed))
                    hapusIds = parsed.map(String);
            }
            catch {
                hapusIds = String(req.body.removeImageIds).split(',').filter(Boolean);
            }
        }
        const urlsBaru = files.map((f) => `/uploads/${f.filename}`);
        const urlsTersisa = lama.images
            .filter((img) => !hapusIds.includes(img.id))
            .map((img) => img.url);
        const semuaUrl = [...urlsTersisa, ...urlsBaru];
        if (semuaUrl.length === 0) {
            res.status(400).json({ message: 'Galeri harus menyisakan minimal satu foto.' });
            return;
        }
        const updated = await prisma_1.default.$transaction(async (tx) => {
            if (hapusIds.length > 0) {
                await tx.galleryImage.deleteMany({ where: { id: { in: hapusIds }, galleryId: id } });
            }
            if (urlsBaru.length > 0 || hapusIds.length > 0) {
                // Tulis ulang daftar foto agar urutannya selalu konsisten.
                await tx.galleryImage.deleteMany({ where: { galleryId: id } });
                await tx.galleryImage.createMany({
                    data: semuaUrl.map((url, index) => ({ galleryId: id, url, order: index }))
                });
            }
            return tx.gallery.update({
                where: { id },
                data: {
                    ...(title !== undefined ? { title } : {}),
                    ...(category !== undefined ? { category } : {}),
                    ...(activity !== undefined ? { activity: activity || null } : {}),
                    ...(year !== undefined ? { year: parseInt(year) || lama.year } : {}),
                    url: semuaUrl[0]
                },
                include: { images: { orderBy: { order: 'asc' } } }
            });
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'UPDATE_GALLERY', 'Gallery', `Memperbarui galeri "${updated.title}"`, id);
        res.status(200).json({ message: 'Galeri berhasil diperbarui.', data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.updateGallery = updateGallery;
const deleteGallery = async (req, res, next) => {
    try {
        const lama = await prisma_1.default.gallery.findUnique({ where: { id: req.params.id } });
        // GalleryImage terhapus otomatis lewat onDelete: Cascade.
        await prisma_1.default.gallery.delete({ where: { id: req.params.id } });
        await (0, audit_service_1.logActivity)(req.user.id, 'DELETE_GALLERY', 'Gallery', `Menghapus galeri "${lama?.title ?? req.params.id}"`, req.params.id);
        res.status(200).json({ message: 'Galeri dihapus' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteGallery = deleteGallery;
// ================= PENGATURAN SITUS (VISI & MISI) =================
const getSiteSettings = async (req, res, next) => {
    try {
        const rows = await prisma_1.default.siteSetting.findMany();
        const data = {};
        rows.forEach((r) => { data[r.key] = r.value; });
        // Nilai bawaan supaya halaman publik tidak kosong sebelum admin mengisinya.
        if (data.visi === undefined) {
            data.visi =
                'Menjadi Fakultas Teknik yang unggul, inovatif, dan berdaya saing global ' +
                    'dalam pengembangan ilmu pengetahuan dan teknologi.';
        }
        if (data.misi === undefined) {
            data.misi = [
                'Menyelenggarakan pendidikan teknik yang berkualitas dan adaptif terhadap perkembangan teknologi.',
                'Mengembangkan penelitian dan inovasi di bidang teknik yang bermanfaat bagi masyarakat.',
                'Meningkatkan pengabdian kepada masyarakat melalui penerapan teknologi yang solutif.'
            ].join('\n');
        }
        res.status(200).json({ data });
    }
    catch (error) {
        next(error);
    }
};
exports.getSiteSettings = getSiteSettings;
const updateSiteSettings = async (req, res, next) => {
    try {
        const entries = Object.entries(req.body || {});
        const valid = entries.filter(([key]) => isSettingKey(key));
        if (valid.length === 0) {
            res.status(400).json({ message: 'Tidak ada pengaturan yang valid untuk disimpan.' });
            return;
        }
        for (const [key, value] of valid) {
            await prisma_1.default.siteSetting.upsert({
                where: { key },
                create: { key, value: String(value ?? '') },
                update: { value: String(value ?? '') }
            });
        }
        await (0, audit_service_1.logActivity)(req.user.id, 'UPDATE_SETTINGS', 'SiteSetting', `Memperbarui teks situs: ${valid.map(([k]) => k).join(', ')}`);
        res.status(200).json({ message: 'Pengaturan situs berhasil disimpan.' });
    }
    catch (error) {
        next(error);
    }
};
exports.updateSiteSettings = updateSiteSettings;
// ================= STRUKTUR ORGANISASI (PUBLIK) =================
const getPublicStructure = async (req, res, next) => {
    try {
        const structure = await prisma_1.default.organization.findMany({
            where: { isActive: true },
            include: {
                positionSlots: {
                    where: { isActive: true },
                    include: {
                        department: { select: { name: true } },
                        positions: {
                            where: { isActive: true },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        nim: true,
                                        foto: true,
                                        profile: {
                                            // email SENGAJA tidak diambil: biodata pengurus yang tampil
                                            // ke publik tidak boleh menyertakan alamat email.
                                            // no_hp ikut diambil karena diminta tampil di kartu biodata.
                                            select: { nama: true, program_studi: true, no_hp: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        // Angkatan dihitung di server supaya logika NIM hanya hidup di satu tempat.
        const data = structure.map((org) => ({
            ...org,
            positionSlots: org.positionSlots.map((slot) => ({
                ...slot,
                positions: slot.positions.map((pos) => ({
                    ...pos,
                    user: {
                        ...pos.user,
                        angkatan: (0, account_lifecycle_service_1.hitungAngkatan)(pos.user.nim)
                    }
                }))
            }))
        }));
        res.status(200).json({ data });
    }
    catch (error) {
        next(error);
    }
};
exports.getPublicStructure = getPublicStructure;
