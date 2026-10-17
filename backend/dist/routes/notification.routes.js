"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.requireAuth, notification_controller_1.getNotifications);
router.put('/read-all', auth_middleware_1.requireAuth, notification_controller_1.markAllAsRead);
exports.default = router;
