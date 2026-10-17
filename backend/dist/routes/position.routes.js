"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// position.routes.ts
const express_1 = require("express");
const position_controller_1 = require("../controllers/position.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.requireAuth, position_controller_1.getPositions);
router.post('/slots', auth_middleware_1.requireAuth, position_controller_1.createPositionSlot);
router.post('/assign', auth_middleware_1.requireAuth, position_controller_1.assignPosition);
router.delete('/:id', auth_middleware_1.requireAuth, position_controller_1.removePosition);
exports.default = router;
