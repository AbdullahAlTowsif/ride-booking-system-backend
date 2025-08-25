"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRoutes = void 0;
const express_1 = require("express");
const alert_controller_1 = require("./alert.controller");
const router = (0, express_1.Router)();
router.post("/", alert_controller_1.AlertController.createAlert);
exports.AlertRoutes = router;
