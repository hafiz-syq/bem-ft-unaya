"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ringkasanPenolakanCors = exports.MAKS_BARIS_RINGKASAN = exports.flushPenolakanCors = exports.catatPenolakanCors = exports.JENDELA_KUMPUL_MS = exports.AKSI_CORS_DITOLAK = void 0;
exports.startPemantauanCors = startPemantauanCors;
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("./audit.service");
/**
 * Pencatat penolakan CORS.
 *
 * Tujuan: percobaan memanggil API dari origin web yang tidak dikenal tidak
 * hilang begitu saja saat terminal dibersihkan, sehingga polanya bisa ditinjau
 * dari dashboard admin.
 *
 * Kenapa dikumpulkan dulu di memori, bukan langsung ditulis ke database:
 * 1. Penolakan berasal dari luar dan bisa dibanjiri. Satu baris database per
 *    permintaan membuat penyerang bisa membebani database hanya dengan
 *    mengirim permintaan ber-origin palsu.
 * 2. Permintaan preflight (OPTIONS) dan permintaan sesungguhnya dari origin yang
 *    sama akan menyatu menjadi satu catatan berisi jumlah kejadian.
 * 3. Callback CORS bersifat sinkron. Menulis database di dalamnya berarti
 *    permintaan yang seharusnya langsung ditolak justru menunggu database.
 *
 * Jadi penolakan ditampung di memori selama JENDELA_KUMPUL_MS, lalu ditulis
 * berkelompok oleh pengatur waktu. Ukuran penampung dibatasi supaya memori
 * tidak bisa dihabiskan dari luar.
 */
/** Jenis aksi pada tabel AuditLog untuk penolakan origin. */
exports.AKSI_CORS_DITOLAK = 'CORS_DITOLAK';
/** Lama penolakan ditampung sebelum ditulis ke database. */
exports.JENDELA_KUMPUL_MS = 60 * 1000;
/** Batas jumlah origin berbeda yang dirinci dalam satu jendela. */
const MAKS_ORIGIN = 200;
/** Batas contoh (path/IP/user-agent) yang disimpan per origin. */
const MAKS_CONTOH = 5;
/** entityId di database bertipe VARCHAR(191), jadi origin panjang dipotong. */
const MAKS_PANJANG_ENTITY = 190;
/** User-agent dipotong supaya metadata tetap ringkas. */
const MAKS_PANJANG_UA = 120;
const penampung = new Map();
/** Jumlah penolakan yang tidak lagi dirinci karena batas origin tercapai. */
let diLuarBatas = 0;
let timer = null;
/** Mengambil path tanpa query string, agar nilai sensitif tidak ikut tercatat. */
const pathAman = (req) => {
    const metode = req.method || 'GET';
    const url = (req.originalUrl || req.url || '/').split('?')[0];
    return `${metode} ${url}`.slice(0, 190);
};
const potong = (nilai, maks) => nilai.length > maks ? `${nilai.slice(0, maks - 1)}…` : nilai;
/**
 * Menampung satu penolakan. Aman dipanggil dari middleware: tidak menulis
 * database dan tidak pernah melempar error, sehingga permintaan yang ditolak
 * tetap dibalas secepat biasa.
 */
const catatPenolakanCors = (origin, req) => {
    try {
        const asal = origin && origin.trim() ? origin.trim() : '(origin tidak dikirim)';
        const sekarang = new Date();
        const path = pathAman(req);
        let kumpulan = penampung.get(asal);
        if (!kumpulan) {
            // Batas tercapai: tetap dihitung, tapi tidak lagi dirinci per origin.
            if (penampung.size >= MAKS_ORIGIN) {
                diLuarBatas += 1;
                return;
            }
            kumpulan = {
                jumlah: 0,
                pertama: sekarang,
                terakhir: sekarang,
                terakhirMethodPath: path,
                paths: new Map(),
                ips: new Set(),
                userAgents: new Set(),
            };
            penampung.set(asal, kumpulan);
        }
        kumpulan.jumlah += 1;
        kumpulan.terakhir = sekarang;
        kumpulan.terakhirMethodPath = path;
        if (kumpulan.paths.size < MAKS_CONTOH || kumpulan.paths.has(path)) {
            kumpulan.paths.set(path, (kumpulan.paths.get(path) ?? 0) + 1);
        }
        if (kumpulan.ips.size < MAKS_CONTOH && req.ip) {
            kumpulan.ips.add(req.ip);
        }
        const ua = req.get?.('user-agent');
        if (ua && kumpulan.userAgents.size < MAKS_CONTOH) {
            kumpulan.userAgents.add(potong(ua, MAKS_PANJANG_UA));
        }
    }
    catch (error) {
        // Pencatatan tidak boleh sampai menganggu penolakan permintaan itu sendiri.
        console.error('[pemantauan cors] Gagal menampung penolakan:', error);
    }
};
exports.catatPenolakanCors = catatPenolakanCors;
/** Menulis semua penolakan yang tertampung ke AuditLog. Mengembalikan jumlah baris. */
const flushPenolakanCors = async () => {
    if (penampung.size === 0 && diLuarBatas === 0)
        return 0;
    // Salinan diambil lebih dulu supaya penolakan baru yang datang saat penulisan
    // berlangsung masuk ke jendela berikutnya, bukan hilang.
    const gelombang = Array.from(penampung.entries());
    const diLuarBatasGelombang = diLuarBatas;
    penampung.clear();
    diLuarBatas = 0;
    let tertulis = 0;
    for (const [origin, kumpulan] of gelombang) {
        const contohPath = Array.from(kumpulan.paths.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([path, jumlah]) => (jumlah > 1 ? `${path} (${jumlah}x)` : path));
        await (0, audit_service_1.logSystemActivity)(exports.AKSI_CORS_DITOLAK, 'CORS', `Menolak ${kumpulan.jumlah} permintaan dari origin tidak dikenal: ${origin} ` +
            `(terakhir ${kumpulan.terakhirMethodPath})`, potong(origin, MAKS_PANJANG_ENTITY), {
            origin,
            jumlah: kumpulan.jumlah,
            permintaanPertama: kumpulan.pertama.toISOString(),
            permintaanTerakhir: kumpulan.terakhir.toISOString(),
            terakhirMethodPath: kumpulan.terakhirMethodPath,
            contohPath,
            contohIp: Array.from(kumpulan.ips),
            contohUserAgent: Array.from(kumpulan.userAgents),
            jendelaKumpulMs: exports.JENDELA_KUMPUL_MS,
        });
        tertulis += 1;
    }
    if (diLuarBatasGelombang > 0) {
        await (0, audit_service_1.logSystemActivity)(exports.AKSI_CORS_DITOLAK, 'CORS', `Menolak ${diLuarBatasGelombang} permintaan dari origin lain yang tidak dirinci karena ` +
            `melebihi batas ${MAKS_ORIGIN} origin per jendela.`, '(di luar batas rincian)', { jumlah: diLuarBatasGelombang, diLuarBatas: true, jendelaKumpulMs: exports.JENDELA_KUMPUL_MS });
        tertulis += 1;
    }
    return tertulis;
};
exports.flushPenolakanCors = flushPenolakanCors;
/**
 * Menjalankan penulisan berkala. Dipanggil sekali saat server hidup.
 * Aman dipanggil berulang kali: timer kedua tidak akan dibuat.
 */
function startPemantauanCors() {
    if (timer)
        return;
    const tulis = () => (0, exports.flushPenolakanCors)().catch((error) => console.error('[pemantauan cors] Gagal menulis catatan penolakan:', error));
    timer = setInterval(tulis, exports.JENDELA_KUMPUL_MS);
    // Jangan menahan proses tetap hidup hanya karena timer ini.
    timer.unref?.();
}
/** Batas baris terbaru yang dibaca untuk ringkasan, agar dashboard tetap ringan. */
exports.MAKS_BARIS_RINGKASAN = 500;
const ambilJumlahMetadata = (metadata) => {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        const nilai = metadata.jumlah;
        if (typeof nilai === 'number' && Number.isFinite(nilai))
            return nilai;
    }
    return 0;
};
/** Ringkasan penolakan `hari` terakhir untuk dashboard admin. */
const ringkasanPenolakanCors = async (hari = 7) => {
    const sejak = new Date(Date.now() - hari * 24 * 60 * 60 * 1000);
    const baris = await prisma_1.default.auditLog.findMany({
        where: { action: exports.AKSI_CORS_DITOLAK, createdAt: { gte: sejak } },
        select: { entityId: true, metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: exports.MAKS_BARIS_RINGKASAN,
    });
    const perOrigin = new Map();
    let permintaan = 0;
    let terakhir = null;
    for (const catatan of baris) {
        // metadata.jumlah kosong pada data lama, jadi dihitung satu permintaan.
        const jumlah = ambilJumlahMetadata(catatan.metadata) || 1;
        const asal = catatan.entityId || '(tidak diketahui)';
        const waktu = catatan.createdAt;
        permintaan += jumlah;
        if (!terakhir || waktu > terakhir)
            terakhir = waktu;
        const sebelumnya = perOrigin.get(asal);
        if (sebelumnya) {
            sebelumnya.permintaan += jumlah;
            if (waktu > sebelumnya.terakhir)
                sebelumnya.terakhir = waktu;
        }
        else {
            perOrigin.set(asal, { permintaan: jumlah, terakhir: waktu });
        }
    }
    const teratas = Array.from(perOrigin.entries())
        .map(([origin, nilai]) => ({
        origin,
        permintaan: nilai.permintaan,
        terakhir: nilai.terakhir.toISOString(),
    }))
        .sort((a, b) => b.permintaan - a.permintaan)
        .slice(0, 5);
    return {
        hari,
        kejadian: baris.length,
        permintaan,
        originUnik: perOrigin.size,
        terakhir: terakhir ? terakhir.toISOString() : null,
        teratas,
        terpotong: baris.length >= exports.MAKS_BARIS_RINGKASAN,
    };
};
exports.ringkasanPenolakanCors = ringkasanPenolakanCors;
