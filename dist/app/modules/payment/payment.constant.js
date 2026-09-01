"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_AMOUNT_TOLERANCE = exports.TERMINAL_SUCCESS_STATUS = exports.ACTIVE_PAYMENT_STATUSES = void 0;
const payment_interface_1 = require("./payment.interface");
exports.ACTIVE_PAYMENT_STATUSES = [
    payment_interface_1.PaymentStatus.INITIATED,
    payment_interface_1.PaymentStatus.PENDING,
    payment_interface_1.PaymentStatus.VALID,
];
exports.TERMINAL_SUCCESS_STATUS = payment_interface_1.PaymentStatus.VALID;
exports.PAYMENT_AMOUNT_TOLERANCE = 1;
