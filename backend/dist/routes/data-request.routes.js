"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const data_request_controller_1 = require("../controllers/data-request.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.requireAuth, data_request_controller_1.getRequests);
router.post('/', auth_middleware_1.requireAuth, data_request_controller_1.createRequest);
// Endpoint khusus Admin/Pengurus untuk meninjau pengajuan
router.put('/:id/process', auth_middleware_1.requireAuth, data_request_controller_1.processRequest);
exports.default = router;
