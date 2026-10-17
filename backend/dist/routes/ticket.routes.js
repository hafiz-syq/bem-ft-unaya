"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ticket_controller_1 = require("../controllers/ticket.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Rute statis WAJIB di atas rute dinamis (/:id) agar tidak tertimpa.
router.get('/public', ticket_controller_1.getPublicTickets);
router.get('/assignees', auth_middleware_1.requireAuth, ticket_controller_1.getAssignees);
router.get('/export/keluhan', auth_middleware_1.requireAuth, ticket_controller_1.exportKeluhanExcel);
router.get('/', auth_middleware_1.requireAuth, ticket_controller_1.getTickets);
router.post('/', auth_middleware_1.requireAuth, upload_middleware_1.uploadAttachment.single('file'), ticket_controller_1.createTicket);
router.post('/:id/replies', auth_middleware_1.requireAuth, ticket_controller_1.replyTicket);
router.post('/:id/assign', auth_middleware_1.requireAuth, ticket_controller_1.assignTicket);
router.put('/:id/moderation', auth_middleware_1.requireAuth, ticket_controller_1.setTicketModeration);
exports.default = router;
