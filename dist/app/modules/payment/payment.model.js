"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = require("mongoose");
const payment_interface_1 = require("./payment.interface");
const paymentSchema = new mongoose_1.Schema({
    rider: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    ride: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Ride",
        required: true,
    },
    driver: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ["BDT"],
        default: "BDT",
    },
    tranId: {
        type: String,
        required: true,
        unique: true,
    },
    valId: {
        type: String,
    },
    status: {
        type: String,
        enum: Object.values(payment_interface_1.PaymentStatus),
        default: payment_interface_1.PaymentStatus.INITIATED,
    },
    paidAt: {
        type: Date,
    },
    ipnReceivedAt: {
        type: Date,
    },
    verifiedAt: {
        type: Date,
    },
    raw: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
    versionKey: false,
});
paymentSchema.index({ ride: 1 });
paymentSchema.index({ ride: 1, status: 1 });
exports.Payment = (0, mongoose_1.model)("Payment", paymentSchema);
