"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pastikanFolderUploads = exports.folderUploads = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Satu sumber kebenaran folder penyimpanan berkas unggahan.
 *
 * Default-nya `backend/uploads` seperti sebelumnya. Di server produksi setel
 * `UPLOAD_DIR` ke folder persisten (mis. `/var/lib/bem-ft/uploads`) supaya foto
 * profil, cover CMS, dan lampiran tiket tidak hilang saat aplikasi di-deploy
 * ulang atau container dibuat baru — filesystem container bersifat sementara.
 *
 * Nilainya dibaca saat fungsi dipanggil, bukan saat modul dimuat, agar isi
 * `.env` sudah tersedia pada semua jalur (server, skrip CLI, pengujian).
 */
const folderUploads = () => process.env.UPLOAD_DIR ? path_1.default.resolve(process.env.UPLOAD_DIR) : path_1.default.join(__dirname, '../../uploads');
exports.folderUploads = folderUploads;
/** Folder uploads yang dijamin sudah ada. */
const pastikanFolderUploads = () => {
    const folder = (0, exports.folderUploads)();
    if (!fs_1.default.existsSync(folder))
        fs_1.default.mkdirSync(folder, { recursive: true });
    return folder;
};
exports.pastikanFolderUploads = pastikanFolderUploads;
