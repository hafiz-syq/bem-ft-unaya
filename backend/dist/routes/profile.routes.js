"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profile_controller_1 = require("../controllers/profile.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Endpoint untuk mengambil profil diri sendiri (biodata lengkap + foto)
router.get('/me', auth_middleware_1.requireAuth, profile_controller_1.getMyProfile);
// Endpoint untuk mengubah email pribadi (tersedia untuk semua pengguna yang login)
router.put('/me', auth_middleware_1.requireAuth, profile_controller_1.updateMyEmail);
// Endpoint untuk mengunggah / mengganti foto profil (semua role)
router.post('/me/photo', auth_middleware_1.requireAuth, upload_middleware_1.uploadPhoto.single('foto'), profile_controller_1.uploadMyPhoto);
exports.default = router;
